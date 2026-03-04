import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chat } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// ─── Action: diagnose_failing_signal ─────────────────────────────────────
async function diagnoseFailingSignal(projectId: string, signalName: string) {
  const supabase = getSupabase();

  // Read signal info
  const { data: signalInfo } = await supabase
    .from("signal_registry")
    .select("*")
    .eq("signal_name", signalName)
    .limit(1)
    .maybeSingle();

  // Read performance
  const { data: perfData } = await supabase
    .from("signal_performance")
    .select("*")
    .eq("project_id", projectId)
    .eq("signal_name", signalName)
    .maybeSingle();

  if (!perfData) {
    return { error: "No performance data found for signal", signalName };
  }

  // Read learning events involving this signal
  const { data: events } = await supabase
    .from("learning_events")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(50);

  const relatedEvents = (events || []).filter((e: any) => {
    const signals = e.signals_involved;
    if (!signals || !Array.isArray(signals)) return false;
    return signals.some((s: any) => s.signal_name === signalName);
  });

  const successes = relatedEvents.filter((e: any) =>
    e.signals_involved?.find((s: any) => s.signal_name === signalName)?.was_correct
  );
  const failures = relatedEvents.filter((e: any) =>
    !e.signals_involved?.find((s: any) => s.signal_name === signalName)?.was_correct
  );

  // Call Gemini Pro for diagnosis
  const diagnosisRaw = await chat([
    {
      role: "system",
      content: `Eres un analista senior de modelos predictivos.
Una señal de detección de patrones está fallando. Tu trabajo es:
1. Diagnosticar POR QUÉ falla (¿en qué contextos falla? ¿qué tienen en común los fallos?)
2. Proponer 2-3 señales ALTERNATIVAS que podrían funcionar mejor en esos contextos
3. Para cada alternativa, indicar qué fuente de datos necesita y cómo se calcula

REGLAS:
- Las alternativas deben ser de la MISMA capa (mismo nivel de profundidad)
- Si la señal falla en un contexto específico (ej: ciudades pequeñas), la alternativa debe funcionar EN ese contexto
- Sé creativo: busca proxies no convencionales que nadie usaría
- Cada alternativa debe poder validarse con datos obtenibles (no teórica)
Responde en JSON.`,
    },
    {
      role: "user",
      content: `Señal que falla:
Nombre: ${signalName}
Capa: ${signalInfo?.layer_id ?? "N/A"}
Descripción: ${signalInfo?.description ?? "N/A"}
Fórmula: ${signalInfo?.formula || "N/A"}
Fuente: ${signalInfo?.data_source ?? "N/A"}

Rendimiento:
- Accuracy: ${perfData.accuracy} (${perfData.correct_predictions} aciertos, ${perfData.incorrect_predictions} fallos)
- Status actual: ${perfData.status}

Contexto de los fallos (últimos ${failures.length}):
${JSON.stringify(failures.slice(0, 10).map((f: any) => ({
  action: f.action_taken,
  analysis: f.analysis,
})))}

Contexto de los aciertos (últimos ${successes.length}):
${JSON.stringify(successes.slice(0, 10).map((s: any) => ({
  action: s.action_taken,
  analysis: s.analysis,
})))}

Genera diagnóstico y alternativas:
{
  "diagnosis": {
    "root_cause": "por qué falla",
    "failure_pattern": "qué tienen en común los fallos",
    "works_when": "en qué contextos SÍ funciona",
    "fails_when": "en qué contextos NO funciona"
  },
  "proposed_replacements": [
    {
      "signal_name": "nombre de la nueva señal",
      "layer_id": ${signalInfo?.layer_id ?? 1},
      "description": "qué mide y por qué debería funcionar mejor",
      "formula": "cómo se calcula (si aplica)",
      "data_source": "de dónde salen los datos",
      "hypothesis": "por qué creemos que funcionará donde la anterior falla",
      "confidence_estimate": 0.7,
      "data_available": true,
      "implementation_effort": "low"
    }
  ],
  "recommendation": "keep_and_add|replace_best|conditional_split",
  "recommendation_reason": "por qué esta estrategia"
}`,
    },
  ], { model: "gemini-pro", responseFormat: "json", maxTokens: 4096 });

  let diagnosis: any;
  try {
    diagnosis = JSON.parse(diagnosisRaw);
  } catch {
    console.error("Failed to parse diagnosis JSON:", diagnosisRaw.substring(0, 500));
    return { error: "Failed to parse AI diagnosis", raw: diagnosisRaw.substring(0, 200) };
  }

  // Save as improvement_proposal
  const { data: proposal, error: insertError } = await supabase
    .from("improvement_proposals")
    .insert({
      project_id: projectId,
      proposal_type: "signal_replacement",
      signal_name: signalName,
      layer_id: signalInfo?.layer_id,
      diagnosis: diagnosis.diagnosis,
      proposed_replacements: diagnosis.proposed_replacements,
      recommendation: diagnosis.recommendation,
      recommendation_reason: diagnosis.recommendation_reason,
      status: "pending",
    })
    .select()
    .single();

  if (insertError) {
    console.error("Error inserting proposal:", insertError);
    return { error: "Failed to save proposal", details: insertError.message };
  }

  // Log the event
  await supabase.from("learning_events").insert({
    project_id: projectId,
    event_type: "signal_diagnosis",
    signals_involved: [{ signal_name: signalName, layer_id: signalInfo?.layer_id }],
    analysis: `Diagnóstico generado para "${signalName}": ${diagnosis.recommendation}. ${diagnosis.recommendation_reason}`,
    action_taken: "diagnosis_created",
    metadata: { proposal_id: proposal.id },
  });

  return { proposal_id: proposal.id, diagnosis };
}

// ─── Action: evaluate_feedback ───────────────────────────────────────────
// Fase 1 stub: accepts feedback, updates signal_performance, logs event
async function evaluateFeedback(
  projectId: string,
  signalName: string,
  wasCorrect: boolean,
  context?: string
) {
  const supabase = getSupabase();

  // Upsert signal_performance
  const { data: existing } = await supabase
    .from("signal_performance")
    .select("*")
    .eq("project_id", projectId)
    .eq("signal_name", signalName)
    .maybeSingle();

  if (existing) {
    const correct = existing.correct_predictions + (wasCorrect ? 1 : 0);
    const incorrect = existing.incorrect_predictions + (wasCorrect ? 0 : 1);
    const total = correct + incorrect;
    const accuracy = total > 0 ? Number((correct / total).toFixed(4)) : 0;

    await supabase
      .from("signal_performance")
      .update({
        correct_predictions: correct,
        incorrect_predictions: incorrect,
        accuracy,
        last_evaluated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("signal_performance").insert({
      project_id: projectId,
      signal_name: signalName,
      correct_predictions: wasCorrect ? 1 : 0,
      incorrect_predictions: wasCorrect ? 0 : 1,
      accuracy: wasCorrect ? 1 : 0,
      status: "active",
      last_evaluated_at: new Date().toISOString(),
    });
  }

  // Log the event
  await supabase.from("learning_events").insert({
    project_id: projectId,
    event_type: "feedback_received",
    signals_involved: [{ signal_name: signalName, was_correct: wasCorrect }],
    analysis: context || `Feedback: ${wasCorrect ? "correct" : "incorrect"}`,
    action_taken: "performance_updated",
  });

  return { success: true, signal_name: signalName, was_correct: wasCorrect };
}

// ─── Action: check_failing_signals ───────────────────────────────────────
async function checkFailingSignals(projectId: string) {
  const supabase = getSupabase();

  const { data: signals } = await supabase
    .from("signal_performance")
    .select("*")
    .eq("project_id", projectId)
    .in("status", ["active", "degraded"]);

  const failingSignals = (signals || []).filter((s: any) => {
    const total = s.correct_predictions + s.incorrect_predictions;
    return total >= 10 && s.accuracy < 0.5;
  });

  if (failingSignals.length === 0) {
    return { message: "No failing signals found", checked: (signals || []).length };
  }

  // Check if we already have pending proposals for these signals
  const { data: pendingProposals } = await supabase
    .from("improvement_proposals")
    .select("signal_name")
    .eq("project_id", projectId)
    .eq("status", "pending");

  const pendingSignalNames = new Set((pendingProposals || []).map((p: any) => p.signal_name));

  const results = [];
  for (const signal of failingSignals) {
    if (pendingSignalNames.has(signal.signal_name)) {
      results.push({
        signal_name: signal.signal_name,
        skipped: true,
        reason: "pending proposal already exists",
      });
      continue;
    }

    const result = await diagnoseFailingSignal(projectId, signal.signal_name);
    results.push({ signal_name: signal.signal_name, ...result });
  }

  return { failing_count: failingSignals.length, results };
}

// ─── Main handler ────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, project_id, signal_name, was_correct, context } = await req.json();

    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any;

    switch (action) {
      case "diagnose_failing_signal":
        if (!signal_name) {
          return new Response(JSON.stringify({ error: "signal_name required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        result = await diagnoseFailingSignal(project_id, signal_name);
        break;

      case "evaluate_feedback":
        if (!signal_name || was_correct === undefined) {
          return new Response(
            JSON.stringify({ error: "signal_name and was_correct required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        result = await evaluateFeedback(project_id, signal_name, was_correct, context);
        break;

      case "check_failing_signals":
        result = await checkFailingSignals(project_id);
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("learning-observer error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
