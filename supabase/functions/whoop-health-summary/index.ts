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
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    // Fetch last 7 days of WHOOP data
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceStr = since.toISOString().split("T")[0];

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: whoopData } = await adminClient
      .from("whoop_data")
      .select("data_date, recovery_score, hrv, strain, sleep_hours, resting_hr, sleep_performance")
      .eq("user_id", user.id)
      .gte("data_date", sinceStr)
      .order("data_date", { ascending: true });

    if (!whoopData || whoopData.length === 0) {
      return new Response(JSON.stringify({ error: "No WHOOP data available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build data summary for the AI
    const dataLines = whoopData.map((d: any) =>
      `${d.data_date}: Recovery=${d.recovery_score ?? '?'}%, HRV=${d.hrv ?? '?'}ms, Strain=${d.strain ?? '?'}, Sleep=${d.sleep_hours ?? '?'}h (perf=${d.sleep_performance ?? '?'}%), RHR=${d.resting_hr ?? '?'}bpm`
    ).join("\n");

    const prompt = `Eres un analista de salud y rendimiento. Analiza estos datos de WHOOP de los últimos 7 días y genera un resumen estructurado en español.

DATOS:
${dataLines}

Genera un resumen con EXACTAMENTE este formato (sin markdown, texto plano):

Estado físico actual: [bueno/moderado/bajo]
Recuperación promedio 7d: X%
Tendencia recuperación: [mejorando/estable/deteriorando]
Sueño promedio: X.Xh
Eficiencia sueño: X%
HRV tendencia: [subiendo/estable/bajando] (baseline: Xms)
Strain acumulado: [alto/moderado/bajo]
FC reposo: Xbpm
Recomendaciones: [push hard/mantener ritmo/priorizar recuperación]
Alertas: [lista de alertas si las hay, o "ninguna"]

Notas para el sistema: [1-2 frases sobre cómo adaptar la carga de trabajo y comunicación con el usuario basado en estos datos]

Sé preciso y conciso. Calcula promedios reales. Identifica tendencias reales.`;

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    let summaryText = "";

    if (geminiKey) {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
          }),
        }
      );

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        summaryText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }
    }

    // Fallback to Anthropic
    if (!summaryText) {
      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (anthropicKey) {
        const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1024,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (anthropicRes.ok) {
          const anthropicData = await anthropicRes.json();
          summaryText = anthropicData.content?.[0]?.text || "";
        }
      }
    }

    if (!summaryText) {
      throw new Error("Could not generate summary with any model");
    }

    // Upsert into jarvis_memory
    const { error: upsertErr } = await adminClient
      .from("jarvis_memory")
      .upsert({
        user_id: user.id,
        memory_type: "semantic",
        category: "health_summary",
        content: summaryText.trim(),
        importance: 8,
        source: "whoop-health-summary",
        metadata: {
          days_analyzed: whoopData.length,
          data_range: `${whoopData[0].data_date} to ${whoopData[whoopData.length - 1].data_date}`,
          generated_at: new Date().toISOString(),
        },
      }, { onConflict: "user_id,category" })
      .select();

    // If upsert with onConflict fails (no unique constraint), try update then insert
    if (upsertErr) {
      // Try to find existing
      const { data: existing } = await adminClient
        .from("jarvis_memory")
        .select("id")
        .eq("user_id", user.id)
        .eq("category", "health_summary")
        .limit(1)
        .maybeSingle();

      if (existing) {
        await adminClient
          .from("jarvis_memory")
          .update({
            content: summaryText.trim(),
            importance: 8,
            source: "whoop-health-summary",
            metadata: {
              days_analyzed: whoopData.length,
              data_range: `${whoopData[0].data_date} to ${whoopData[whoopData.length - 1].data_date}`,
              generated_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await adminClient
          .from("jarvis_memory")
          .insert({
            user_id: user.id,
            memory_type: "semantic",
            category: "health_summary",
            content: summaryText.trim(),
            importance: 8,
            source: "whoop-health-summary",
            metadata: {
              days_analyzed: whoopData.length,
              data_range: `${whoopData[0].data_date} to ${whoopData[whoopData.length - 1].data_date}`,
              generated_at: new Date().toISOString(),
            },
          });
      }
    }

    return new Response(JSON.stringify({ success: true, summary: summaryText.trim() }), {
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
