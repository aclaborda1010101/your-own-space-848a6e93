// Daily Context Brief — generates LLM-driven contextual recommendations
// for health and nutrition, cached 1x/day per scope. Force=true regenerates.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-2.5-flash";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Invalid token" }, 401);
    const user = userData.user;

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const scope = (body.scope || url.searchParams.get("scope") || "health") as string;
    const force = body.force === true || url.searchParams.get("force") === "true";

    if (!["health", "nutrition"].includes(scope)) {
      return json({ error: "Invalid scope" }, 400);
    }

    const today = new Date().toISOString().slice(0, 10);

    // Cache check
    if (!force) {
      const { data: cached } = await sb
        .from("daily_briefs")
        .select("content, generated_at, context_snapshot")
        .eq("user_id", user.id)
        .eq("scope", scope)
        .eq("brief_date", today)
        .maybeSingle();
      if (cached?.content) {
        return json({
          content: cached.content,
          generated_at: cached.generated_at,
          cached: true,
        });
      }
    }

    // Gather context (Whoop from both sources, tasks, recent meals)
    const [whoopJ, whoopW, tasksRes, mealsRes, prefsRes] = await Promise.all([
      sb.from("jarvis_whoop_data")
        .select("recovery_score, hrv, sleep_hours, strain, sleep_performance, resting_hr, data_date")
        .eq("user_id", user.id).order("data_date", { ascending: false }).limit(7),
      sb.from("whoop_data")
        .select("recovery_score, hrv, sleep_hours, strain, sleep_performance, resting_hr, data_date")
        .eq("user_id", user.id).order("data_date", { ascending: false }).limit(7),
      sb.from("tasks").select("title, priority, type, completed, created_at")
        .eq("user_id", user.id).eq("completed", false)
        .in("priority", ["P0", "P1"]).order("created_at", { ascending: false }).limit(10),
      sb.from("meal_history").select("meal_type, meal_name, recipe_data, was_completed, energy_after, date")
        .eq("user_id", user.id).order("date", { ascending: false }).limit(20),
      sb.from("nutrition_preferences").select("diet_type, goals, calories_target, proteins_target, carbs_target, fats_target, restrictions, allergies")
        .eq("user_id", user.id).maybeSingle(),
    ]);

    // Pick latest Whoop with metrics from either source
    const allWhoop = [...(whoopJ.data || []), ...(whoopW.data || [])]
      .filter(r => r.recovery_score != null || r.hrv != null || r.sleep_hours != null)
      .sort((a, b) => (b.data_date || "").localeCompare(a.data_date || ""));
    const latestWhoop = allWhoop[0] || null;
    const recentWhoop = allWhoop.slice(0, 7);

    const tasks = tasksRes.data || [];
    const meals = mealsRes.data || [];
    const prefs = prefsRes.data;

    // Build prompt
    const whoopBlock = latestWhoop
      ? `RECOVERY: ${latestWhoop.recovery_score ?? "—"}%, HRV: ${latestWhoop.hrv ?? "—"}ms, SUEÑO: ${latestWhoop.sleep_hours ?? "—"}h, STRAIN: ${latestWhoop.strain ?? "—"}, FC reposo: ${latestWhoop.resting_hr ?? "—"}, fecha: ${latestWhoop.data_date}`
      : "Sin datos Whoop recientes";

    const trendBlock = recentWhoop.length > 1
      ? `Tendencia 7d: recovery promedio ${Math.round(recentWhoop.reduce((s, r) => s + (r.recovery_score || 0), 0) / recentWhoop.filter(r => r.recovery_score != null).length || 0)}%, strain promedio ${(recentWhoop.reduce((s, r) => s + Number(r.strain || 0), 0) / recentWhoop.filter(r => r.strain != null).length || 0).toFixed(1)}`
      : "";

    const tasksBlock = tasks.length > 0
      ? `Tareas críticas pendientes (${tasks.length}): ${tasks.slice(0, 5).map(t => `[${t.priority}] ${t.title}`).join("; ")}`
      : "Sin tareas críticas pendientes";

    const mealsBlock = meals.length > 0
      ? `Últimas ${meals.length} comidas: ${meals.slice(0, 10).map(m => `${m.date} ${m.meal_type || ""}: ${m.meal_name || "—"}${m.was_completed === false ? " (no completada)" : ""}${m.energy_after != null ? ` [energía ${m.energy_after}/5]` : ""}`).join(" | ")}`
      : "Sin registros de comida recientes";

    const prefsBlock = prefs
      ? `Dieta: ${prefs.diet_type || "balanceada"}, objetivo: ${prefs.goals || "salud"}, target: ${prefs.calories_target}kcal/${prefs.proteins_target}P/${prefs.carbs_target}C/${prefs.fats_target}G, restricciones: ${(prefs.restrictions || []).join(", ") || "ninguna"}, alergias: ${(prefs.allergies || []).join(", ") || "ninguna"}`
      : "Sin preferencias nutricionales configuradas";

    let systemPrompt = "";
    let userPrompt = "";

    if (scope === "health") {
      systemPrompt = `Eres el coach de salud personal de Agustín. Genera UNA recomendación contextual concreta y accionable para HOY, cruzando datos Whoop con su carga de tareas y alimentación reciente. Sé directo, sin rodeos. Máximo 4 frases. Formato: una frase de diagnóstico + recomendación de actividad física + recomendación nutricional concreta. Ejemplo: "Recovery 23% + semana intensa → hoy prioriza descanso activo, evita HIIT. Come proteína magra (pollo, pescado) y carbohidrato complejo (arroz integral, quinoa)."`;
      userPrompt = `DATOS HOY:
${whoopBlock}
${trendBlock}

CARGA MENTAL:
${tasksBlock}

ALIMENTACIÓN RECIENTE:
${mealsBlock}

Genera la recomendación de salud para HOY.`;
    } else {
      systemPrompt = `Eres el nutricionista personal de Agustín. Genera un resumen contextual de su alimentación reciente cruzado con su estado físico (Whoop) y carga de la semana. Sé directo. Máximo 5 frases. Formato: 1 frase de patrón observado en la dieta + 1 frase de déficits/excesos detectados + 1-2 frases de recomendación concreta para los próximos días según su recovery y carga. Ejemplo: "Esta semana: déficit de proteína (~15g/día menos del target), exceso de azúcar en cenas. Con tu recovery bajo y semana intensa: prioriza hierro (espinacas, carne roja 2x/sem) y magnesio (frutos secos, plátano). Reduce azúcares simples después de las 19h."`;
      userPrompt = `ALIMENTACIÓN RECIENTE:
${mealsBlock}

PREFERENCIAS Y TARGETS:
${prefsBlock}

ESTADO FÍSICO:
${whoopBlock}
${trendBlock}

CARGA MENTAL:
${tasksBlock}

Genera el análisis nutricional contextual.`;
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
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

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error", aiResp.status, errText);
      if (aiResp.status === 429) return json({ error: "Rate limit alcanzado, prueba en unos segundos." }, 429);
      if (aiResp.status === 402) return json({ error: "Sin créditos AI. Añade saldo en Settings > Workspace > Usage." }, 402);
      return json({ error: "AI gateway error" }, 500);
    }

    const aiData = await aiResp.json();
    const content = aiData?.choices?.[0]?.message?.content?.trim();
    if (!content) return json({ error: "Empty response from AI" }, 500);

    const snapshot = {
      whoop: latestWhoop,
      tasks_count: tasks.length,
      meals_count: meals.length,
      has_prefs: !!prefs,
    };

    await sb.from("daily_briefs").upsert({
      user_id: user.id,
      scope,
      brief_date: today,
      content,
      context_snapshot: snapshot,
      generated_at: new Date().toISOString(),
    }, { onConflict: "user_id,scope,brief_date" });

    return json({ content, generated_at: new Date().toISOString(), cached: false });
  } catch (e: any) {
    console.error("daily-context-brief error", e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});
