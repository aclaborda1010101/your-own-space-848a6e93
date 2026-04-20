// Daily Context Brief — generates LLM-driven contextual recommendations
// for health, nutrition, and tomorrow's plan. Cached 1x/day per scope.
// Force=true regenerates.
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

    if (!["health", "nutrition", "tomorrow"].includes(scope)) {
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
        const payload: Record<string, unknown> = {
          content: cached.content,
          generated_at: cached.generated_at,
          cached: true,
        };
        if (scope === "tomorrow") {
          try { payload.brief = JSON.parse(cached.content); } catch { /* fall through */ }
        }
        return json(payload);
      }
    }

    // Tomorrow date string
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().slice(0, 10);

    // Gather context — calendar comes from iCloud (CalDAV) via icloud-calendar edge function.
    // No existe tabla `calendar_events`; el calendario real está en iCloud del usuario.
    const fetchTomorrowFromICloud = async (): Promise<{ events: any[]; status: "ok" | "disconnected" | "error" }> => {
      try {
        const startISO = `${tomorrowStr}T00:00:00.000Z`;
        const endISO = `${tomorrowStr}T23:59:59.999Z`;
        const icResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/icloud-calendar`, {
          method: "POST",
          headers: {
            "Authorization": authHeader,
            "Content-Type": "application/json",
            "apikey": Deno.env.get("SUPABASE_ANON_KEY")!,
          },
          body: JSON.stringify({ action: "fetch", startDate: startISO, endDate: endISO }),
        });
        if (!icResp.ok) {
          console.error("[daily-context-brief] icloud-calendar status", icResp.status);
          return { events: [], status: "error" };
        }
        const icData = await icResp.json();
        if (icData?.connected === false) return { events: [], status: "disconnected" };
        return { events: Array.isArray(icData?.events) ? icData.events : [], status: "ok" };
      } catch (err) {
        console.error("[daily-context-brief] icloud fetch failed", err);
        return { events: [], status: "error" };
      }
    };

    const calendarFetch =
      scope === "tomorrow"
        ? fetchTomorrowFromICloud()
        : Promise.resolve({ events: [] as any[], status: "ok" as const });

    const plaudFetch =
      scope === "tomorrow"
        ? sb.from("plaud_transcriptions")
            .select("title, summary, received_at")
            .eq("user_id", user.id)
            .order("received_at", { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [] as any[] });

    const [whoopJ, whoopW, tasksRes, mealsRes, prefsRes, calRes, plaudRes] = await Promise.all([
      sb.from("jarvis_whoop_data")
        .select("recovery_score, hrv, sleep_hours, strain, sleep_performance, resting_hr, data_date")
        .eq("user_id", user.id).order("data_date", { ascending: false }).limit(7),
      sb.from("whoop_data")
        .select("recovery_score, hrv, sleep_hours, strain, sleep_performance, resting_hr, data_date")
        .eq("user_id", user.id).order("data_date", { ascending: false }).limit(7),
      sb.from("tasks").select("title, priority, type, completed, created_at, due_date")
        .eq("user_id", user.id).eq("completed", false)
        .in("priority", ["P0", "P1"]).order("created_at", { ascending: false }).limit(10),
      sb.from("meal_history").select("meal_type, meal_name, recipe_data, was_completed, energy_after, date")
        .eq("user_id", user.id).order("date", { ascending: false }).limit(20),
      sb.from("nutrition_preferences").select("diet_type, goals, calories_target, proteins_target, carbs_target, fats_target, restrictions, allergies")
        .eq("user_id", user.id).maybeSingle(),
      calendarFetch,
      plaudFetch,
    ]);

    const allWhoop = [...(whoopJ.data || []), ...(whoopW.data || [])]
      .filter(r => r.recovery_score != null || r.hrv != null || r.sleep_hours != null)
      .sort((a, b) => (b.data_date || "").localeCompare(a.data_date || ""));
    const latestWhoop = allWhoop[0] || null;
    const recentWhoop = allWhoop.slice(0, 7);

    const tasks = tasksRes.data || [];
    const meals = mealsRes.data || [];
    const prefs = prefsRes.data;
    const calResult = calRes as { events: any[]; status: "ok" | "disconnected" | "error" };
    const calEventsAll = Array.isArray((calResult as any).events) ? calResult.events : [];
    // Filtrar all-day para no contarlos como reuniones reales
    const calEvents = calEventsAll.filter((e: any) => !e?.allDay);
    const calAllDay = calEventsAll.filter((e: any) => e?.allDay);
    const calStatus = (calResult as any).status || "ok";
    const plaud = (plaudRes as any).data || [];

    const whoopBlock = latestWhoop
      ? `RECOVERY: ${latestWhoop.recovery_score ?? "—"}%, HRV: ${latestWhoop.hrv ?? "—"}ms, SUEÑO: ${latestWhoop.sleep_hours ?? "—"}h, STRAIN: ${latestWhoop.strain ?? "—"}, FC reposo: ${latestWhoop.resting_hr ?? "—"}, fecha: ${latestWhoop.data_date}`
      : "Sin datos Whoop recientes";

    const recoveryAvg = (() => {
      const arr = recentWhoop.filter(r => r.recovery_score != null);
      if (!arr.length) return null;
      return Math.round(arr.reduce((s, r) => s + (r.recovery_score || 0), 0) / arr.length);
    })();
    const trendBlock = recoveryAvg != null ? `Tendencia 7d recovery promedio: ${recoveryAvg}%` : "";

    const tasksBlock = tasks.length > 0
      ? `Tareas críticas pendientes (${tasks.length}): ${tasks.slice(0, 5).map(t => `[${t.priority}] ${t.title}${t.due_date ? ` (vence ${t.due_date})` : ""}`).join("; ")}`
      : "Sin tareas críticas pendientes";

    const mealsBlock = meals.length > 0
      ? `Últimas ${meals.length} comidas: ${meals.slice(0, 10).map(m => `${m.date} ${m.meal_type || ""}: ${m.meal_name || "—"}${m.was_completed === false ? " (no completada)" : ""}${m.energy_after != null ? ` [energía ${m.energy_after}/5]` : ""}`).join(" | ")}`
      : "Sin registros de comida recientes";

    const prefsBlock = prefs
      ? `Dieta: ${prefs.diet_type || "balanceada"}, objetivo: ${prefs.goals || "salud"}, target: ${prefs.calories_target}kcal/${prefs.proteins_target}P/${prefs.carbs_target}C/${prefs.fats_target}G, restricciones: ${(prefs.restrictions || []).join(", ") || "ninguna"}, alergias: ${(prefs.allergies || []).join(", ") || "ninguna"}`
      : "Sin preferencias nutricionales configuradas";

    const formatEventTime = (e: any) => {
      // iCloud-calendar devuelve { time: "HH:MM" } ya formateado en TZ del usuario
      if (e?.time && typeof e.time === "string") return e.time;
      if (e?.start_time) {
        try { return new Date(e.start_time).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
      }
      return "";
    };

    let calendarBlock: string;
    if (calStatus === "disconnected") {
      calendarBlock = "Sin datos de calendario disponibles (iCloud no conectado)";
    } else if (calStatus === "error") {
      calendarBlock = "Sin datos de calendario disponibles (no he podido confirmar con iCloud)";
    } else if (calEvents.length === 0 && calAllDay.length === 0) {
      calendarBlock = "Sin eventos en el calendario para mañana";
    } else {
      const parts: string[] = [];
      if (calEvents.length > 0) {
        parts.push(`Reuniones mañana (${calEvents.length}): ${calEvents.map((e: any) => `${formatEventTime(e)} ${e.title || "(sin título)"}${e.location ? ` @ ${e.location}` : ""}`).join("; ")}`);
      }
      if (calAllDay.length > 0) {
        parts.push(`Eventos todo el día: ${calAllDay.map((e: any) => e.title || "(sin título)").join(", ")}`);
      }
      calendarBlock = parts.join(" | ");
    }

    const plaudBlock = plaud.length > 0
      ? `Últimas grabaciones Plaud: ${plaud.slice(0, 3).map((p: any) => `"${p.title || "sin título"}"${p.summary ? `: ${String(p.summary).slice(0, 120)}` : ""}`).join(" | ")}`
      : "";

    let systemPrompt = "";
    let userPrompt = "";
    let asJson = false;

    if (scope === "health") {
      systemPrompt = `Eres el coach de salud personal de Agustín. Genera UNA recomendación contextual concreta y accionable para HOY, cruzando datos Whoop con su carga de tareas y alimentación reciente. Sé directo, sin rodeos. Máximo 4 frases. Formato: una frase de diagnóstico + recomendación de actividad física + recomendación nutricional concreta.`;
      userPrompt = `DATOS HOY:\n${whoopBlock}\n${trendBlock}\n\nCARGA MENTAL:\n${tasksBlock}\n\nALIMENTACIÓN RECIENTE:\n${mealsBlock}\n\nGenera la recomendación de salud para HOY.`;
    } else if (scope === "nutrition") {
      systemPrompt = `Eres el nutricionista personal de Agustín. Genera un resumen contextual de su alimentación reciente cruzado con su estado físico (Whoop) y carga de la semana. Sé directo. Máximo 5 frases.`;
      userPrompt = `ALIMENTACIÓN RECIENTE:\n${mealsBlock}\n\nPREFERENCIAS Y TARGETS:\n${prefsBlock}\n\nESTADO FÍSICO:\n${whoopBlock}\n${trendBlock}\n\nCARGA MENTAL:\n${tasksBlock}\n\nGenera el análisis nutricional contextual.`;
    } else {
      // tomorrow
      asJson = true;
      systemPrompt = `Eres POTUS, el sistema operativo personal de Agustín. Genera un brief MAÑANERO (qué le toca mañana) en JSON estricto con esta forma exacta:
{
  "headline": "Frase corta de qué tipo de día es mañana (≤90 chars)",
  "calendar_summary": "Resumen de la agenda de mañana en 1 frase con hora del primer evento si lo hay",
  "task_focus": "Cuáles son las 1-3 prioridades a sacar mañana, frase corta",
  "plaud_context": "Si hay algo relevante en grabaciones Plaud recientes que conecte con mañana, 1 frase. Si no, cadena vacía.",
  "closing_note": "Frase final motivadora o de aviso (≤80 chars)"
}
Devuelve SOLO el JSON, sin markdown ni texto extra.`;
      userPrompt = `FECHA MAÑANA: ${tomorrowStr}\n\n${calendarBlock}\n\n${tasksBlock}\n\nESTADO FÍSICO ACTUAL:\n${whoopBlock}\n${trendBlock}\n\n${plaudBlock}\n\nGenera el brief de mañana en JSON.`;
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
        ...(asJson ? { response_format: { type: "json_object" } } : {}),
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
      cal_count: calEvents.length,
      plaud_count: plaud.length,
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

    const payload: Record<string, unknown> = {
      content,
      generated_at: new Date().toISOString(),
      cached: false,
    };
    if (scope === "tomorrow") {
      try {
        // Strip eventual fences
        const stripped = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
        payload.brief = JSON.parse(stripped);
      } catch (e) {
        console.error("Failed to parse tomorrow brief JSON", e);
      }
    }
    return json(payload);
  } catch (e: any) {
    console.error("daily-context-brief error", e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});
