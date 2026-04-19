// JARVIS Executive Summary — daily cached LLM summary of user's day.
// 1x/day automatic generation + manual refresh via ?force=true.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-2.5-flash"; // Lovable AI Gateway default — do not change without approval.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Invalid token" }, 401);
    const user = userData.user;

    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";
    const today = new Date().toISOString().slice(0, 10);

    // 1) Cache hit?
    if (!force) {
      const { data: cached } = await supabase
        .from("jarvis_executive_summaries")
        .select("summary_text, generated_at, context_snapshot")
        .eq("user_id", user.id)
        .eq("summary_date", today)
        .maybeSingle();
      if (cached?.summary_text) {
        return json({
          summary: cached.summary_text,
          generated_at: cached.generated_at,
          cached: true,
        });
      }
    }

    // 2) Gather context in parallel
    const [whoopJ, whoopW, tasksRes, projectsRes, contactsRes, checkinRes] = await Promise.all([
      supabase.from("jarvis_whoop_data").select("recovery_score, hrv, sleep_hours, strain, sleep_performance, data_date")
        .eq("user_id", user.id).order("data_date", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("whoop_data").select("recovery_score, hrv, sleep_hours, strain, sleep_performance, data_date")
        .eq("user_id", user.id).order("data_date", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("tasks").select("title, priority, type, completed, created_at")
        .eq("user_id", user.id).eq("completed", false).order("created_at", { ascending: false }).limit(15),
      supabase.from("business_projects").select("name, status, current_step, need_summary, time_horizon")
        .eq("user_id", user.id).neq("status", "closed").order("updated_at", { ascending: false }).limit(8),
      supabase.from("people_contacts").select("name, personality_profile, wa_id")
        .eq("user_id", user.id).eq("in_strategic_network", true).not("personality_profile", "is", null).limit(20),
      supabase.from("check_ins").select("energy, mood, focus, available_time, day_mode, date")
        .eq("user_id", user.id).order("date", { ascending: false }).limit(1).maybeSingle(),
    ]);

    // Pick freshest health row with metrics
    const pickHealth = () => {
      const j = whoopJ.data;
      const w = whoopW.data;
      const hasMetrics = (r: any) => r && (r.recovery_score != null || r.hrv != null || r.sleep_hours != null);
      if (hasMetrics(j) && hasMetrics(w)) return j!.data_date >= w!.data_date ? j : w;
      if (hasMetrics(j)) return j;
      if (hasMetrics(w)) return w;
      return null;
    };
    const health = pickHealth();

    // Pending contact actions
    const pendingContacts: { name: string; action: string }[] = [];
    const todayDate = new Date(); todayDate.setHours(23, 59, 59, 999);
    for (const c of contactsRes.data || []) {
      const pp = c.personality_profile as any;
      for (const scope of ["profesional", "personal", "familiar"]) {
        const pa = pp?.[scope]?.proxima_accion;
        if (pa?.que) {
          const cuando = pa.cuando ? new Date(pa.cuando) : null;
          if (!cuando || cuando <= todayDate) {
            pendingContacts.push({ name: c.name, action: String(pa.que).slice(0, 80) });
            break;
          }
        }
      }
      if (pendingContacts.length >= 5) break;
    }

    const context = {
      health: health
        ? { recovery: health.recovery_score, hrv: health.hrv, sleep_h: health.sleep_hours, strain: health.strain, date: health.data_date }
        : null,
      check_in: checkinRes.data || null,
      tasks_pending: (tasksRes.data || []).map(t => ({ title: t.title, priority: t.priority, type: t.type })),
      projects_active: (projectsRes.data || []).map(p => ({ name: p.name, status: p.status, step: p.current_step, horizon: p.time_horizon })),
      pending_contacts: pendingContacts,
    };

    // 3) LLM call
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const systemPrompt = `Eres JARVIS, asistente personal de Agustín. Tono: inteligente, directo, ligeramente irónico/sarcástico cuando aporta valor, nunca pesado.
Genera un RESUMEN EJECUTIVO del día en 4-6 frases (máx 90 palabras). Combina:
- Estado físico (recovery, sueño, HRV) — interpreta si está fresco/cansado/forzando
- Top 2-3 prioridades reales del día
- Estado de proyectos activos relevantes
- Contactos pendientes críticos
- Inferencia de presión/ánimo (sin inventar — si no hay datos, dilo)

Reglas estrictas:
- NO listas con bullets. Prosa fluida.
- NO repitas el saludo (ya está en la UI).
- Si un dato falta, no lo inventes — sáltalo o dilo en una frase corta.
- Habla en segunda persona ("tienes", "te conviene") o impersonal.
- Una pizca de ironía si el contexto lo permite ("recovery 38, así que hoy no salvas el mundo, salvas tu agenda").`;

    const userPrompt = `CONTEXTO HOY (${today}):\n${JSON.stringify(context, null, 2)}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("[exec-summary] AI gateway error:", aiRes.status, errText);
      if (aiRes.status === 429) return json({ error: "Rate limit. Intenta en un minuto." }, 429);
      if (aiRes.status === 402) return json({ error: "Créditos AI agotados." }, 402);
      return json({ error: "AI gateway failed" }, 500);
    }

    const aiJson = await aiRes.json();
    const summary = aiJson?.choices?.[0]?.message?.content?.trim();
    if (!summary) return json({ error: "Empty AI response" }, 500);

    // 4) Cache it (upsert)
    const { error: upsertErr } = await supabase
      .from("jarvis_executive_summaries")
      .upsert({
        user_id: user.id,
        summary_date: today,
        summary_text: summary,
        context_snapshot: context,
        model_used: MODEL,
        generated_at: new Date().toISOString(),
      }, { onConflict: "user_id,summary_date" });

    if (upsertErr) console.warn("[exec-summary] upsert warning:", upsertErr.message);

    return json({ summary, generated_at: new Date().toISOString(), cached: false });
  } catch (e) {
    console.error("[exec-summary] fatal:", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
