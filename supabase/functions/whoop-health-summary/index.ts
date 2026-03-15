import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    // Fetch last 14 days of WHOOP data with ALL fields
    const since = new Date();
    since.setDate(since.getDate() - 14);
    const sinceStr = since.toISOString().split("T")[0];

    const { data: whoopData } = await supabase
      .from("whoop_data")
      .select("*")
      .eq("user_id", user.id)
      .gte("data_date", sinceStr)
      .order("data_date", { ascending: true });

    if (!whoopData || whoopData.length === 0) {
      return new Response(JSON.stringify({ error: "No WHOOP data available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build comprehensive data summary
    const dataLines = whoopData.map((d: any) =>
      `${d.data_date}: Recovery=${d.recovery_score ?? '?'}% | HRV=${d.hrv ?? '?'}ms | RHR=${d.resting_hr ?? '?'}bpm | Strain=${d.strain?.toFixed(1) ?? '?'}/21 | Cal=${d.calories ?? '?'}kcal | Sleep=${d.time_asleep_hours?.toFixed(1) ?? '?'}h (perf=${d.sleep_performance ?? '?'}%, eff=${d.sleep_efficiency ?? '?'}%) | Deep=${d.deep_sleep_hours?.toFixed(1) ?? '?'}h | REM=${d.rem_sleep_hours?.toFixed(1) ?? '?'}h | Light=${d.light_sleep_hours?.toFixed(1) ?? '?'}h | Latency=${d.sleep_latency_min?.toFixed(0) ?? '?'}min | Debt=${d.sleep_debt_hours?.toFixed(1) ?? '?'}h | SpO2=${d.spo2 ?? '?'}% | SkinTemp=${d.skin_temp ?? '?'}° | RespRate=${d.respiratory_rate ?? '?'}rpm | Disturbances=${d.disturbances ?? '?'}`
    ).join("\n");

    const prompt = `Eres un coach de salud y rendimiento de élite. Analiza estos datos completos de WHOOP y genera un informe accionable en español.

DATOS WHOOP (últimos ${whoopData.length} días):
${dataLines}

Genera un análisis JSON con EXACTAMENTE esta estructura (responde SOLO con el JSON, sin markdown):
{
  "estado_general": "óptimo|bueno|moderado|bajo|crítico",
  "puntuacion_global": 85,
  "recuperacion": {
    "promedio": 72,
    "tendencia": "mejorando|estable|deteriorando",
    "mejor_dia": "2026-03-14",
    "peor_dia": "2026-03-10"
  },
  "sueno": {
    "horas_promedio": 7.2,
    "eficiencia_promedio": 88,
    "deep_sleep_pct": 18,
    "rem_pct": 22,
    "latencia_promedio_min": 12,
    "deuda_actual_horas": 1.5,
    "hora_ideal_acostarse": "23:00",
    "hora_ideal_despertar": "07:00",
    "tendencia": "mejorando|estable|deteriorando"
  },
  "esfuerzo": {
    "strain_promedio": 12.5,
    "calorias_promedio": 2100,
    "nivel": "alto|moderado|bajo",
    "recomendacion_hoy": "push hard|mantener ritmo|día de recuperación"
  },
  "cardiovascular": {
    "hrv_promedio": 45,
    "hrv_tendencia": "subiendo|estable|bajando",
    "rhr_promedio": 58,
    "rhr_tendencia": "subiendo|estable|bajando"
  },
  "alertas": [
    "Deuda de sueño acumulada de 2h, prioriza dormir 30min más",
    "HRV bajando 3 días consecutivos, reduce intensidad"
  ],
  "consejos": [
    {"tipo": "sueno", "mensaje": "Acuéstate a las 23:00 para cubrir tu necesidad de 8h", "prioridad": "alta", "hora_notificacion": "22:30"},
    {"tipo": "recuperacion", "mensaje": "Tu recovery está en verde, buen día para entrenamiento intenso", "prioridad": "media"},
    {"tipo": "hidratacion", "mensaje": "SpO2 ligeramente bajo, asegura hidratación adecuada", "prioridad": "media"}
  ],
  "resumen_texto": "Resumen narrativo de 2-3 frases sobre el estado general del usuario",
  "notas_sistema": "1-2 frases para que el agente JARVIS adapte su comportamiento según estos datos"
}

Calcula promedios REALES. Identifica tendencias REALES mirando la progresión día a día. Sé específico con horarios y cantidades.`;

    // Use Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let summaryJson: any = null;

    if (LOVABLE_API_KEY) {
      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "Eres un analista de salud. Responde SOLO con JSON válido, sin markdown ni backticks." },
              { role: "user", content: prompt },
            ],
            temperature: 0.3,
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const text = aiData.choices?.[0]?.message?.content || "";
          // Clean potential markdown wrapping
          const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          try {
            summaryJson = JSON.parse(cleaned);
          } catch {
            console.error("[whoop-health-summary] Failed to parse AI JSON:", cleaned.substring(0, 200));
          }
        } else {
          const errText = await aiRes.text();
          console.error("[whoop-health-summary] AI gateway error:", aiRes.status, errText);
        }
      } catch (e) {
        console.error("[whoop-health-summary] AI gateway fetch error:", e);
      }
    }

    // Fallback to Anthropic
    if (!summaryJson) {
      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (anthropicKey) {
        try {
          const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": anthropicKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 2048,
              messages: [{ role: "user", content: prompt }],
            }),
          });

          if (anthropicRes.ok) {
            const anthropicData = await anthropicRes.json();
            const text = anthropicData.content?.[0]?.text || "";
            const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            try {
              summaryJson = JSON.parse(cleaned);
            } catch {
              console.error("[whoop-health-summary] Anthropic JSON parse failed");
            }
          }
        } catch (e) {
          console.error("[whoop-health-summary] Anthropic error:", e);
        }
      }
    }

    if (!summaryJson) {
      throw new Error("Could not generate summary with any model");
    }

    // Store structured summary
    const summaryContent = JSON.stringify(summaryJson);

    // Upsert into jarvis_memory
    const { data: existing } = await supabase
      .from("jarvis_memory")
      .select("id")
      .eq("user_id", user.id)
      .eq("category", "health_summary")
      .limit(1)
      .maybeSingle();

    const memoryPayload = {
      user_id: user.id,
      memory_type: "semantic" as const,
      category: "health_summary",
      content: summaryContent,
      importance: 8,
      source: "whoop-health-summary",
      metadata: {
        days_analyzed: whoopData.length,
        data_range: `${whoopData[0].data_date} to ${whoopData[whoopData.length - 1].data_date}`,
        generated_at: new Date().toISOString(),
        structured: true,
      },
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await supabase.from("jarvis_memory").update(memoryPayload).eq("id", existing.id);
    } else {
      await supabase.from("jarvis_memory").insert(memoryPayload);
    }

    return new Response(JSON.stringify({ success: true, summary: summaryJson }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[whoop-health-summary]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
