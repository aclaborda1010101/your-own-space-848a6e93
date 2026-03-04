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

// ─── Helper: getNextVersion ──────────────────────────────────────────────
async function getNextVersion(projectId: string): Promise<number> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("model_change_log")
    .select("version_id")
    .eq("project_id", projectId)
    .order("version_id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.version_id || 0) + 1;
}

// ─── Helper: graduateSignal ──────────────────────────────────────────────
async function graduateSignal(
  projectId: string,
  newSignal: string,
  oldSignal: string,
  newAccuracy: number,
  oldAccuracy: number
) {
  const supabase = getSupabase();
  const nextVersion = await getNextVersion(projectId);

  // New signal → graduated/established
  await supabase
    .from("signal_registry")
    .update({ trial_status: "graduated" })
    .eq("project_id", projectId)
    .eq("signal_name", newSignal)
    .eq("trial_status", "trial");

  await supabase
    .from("signal_performance")
    .update({ status: "active" })
    .eq("project_id", projectId)
    .eq("signal_name", newSignal);

  // Old signal → replaced (not deleted)
  await supabase
    .from("signal_registry")
    .update({ trial_status: "rejected" })
    .eq("project_id", projectId)
    .eq("signal_name", oldSignal)
    .eq("trial_status", "established");

  await supabase
    .from("signal_performance")
    .update({ status: "replaced" })
    .eq("project_id", projectId)
    .eq("signal_name", oldSignal);

  // Update related proposal
  await supabase
    .from("improvement_proposals")
    .update({ status: "graduated", version_after: nextVersion })
    .eq("project_id", projectId)
    .eq("signal_name", oldSignal)
    .eq("status", "trial_active");

  // Versioned change log
  await supabase.from("model_change_log").insert({
    project_id: projectId,
    version_id: nextVersion,
    change_type: "signal_replaced",
    signal_name: newSignal,
    previous_state: { replaced_signal: oldSignal, old_accuracy: oldAccuracy },
    new_state: { new_signal: newSignal, new_accuracy: newAccuracy },
    applied_by: "system",
  });

  // Event log
  await supabase.from("learning_events").insert({
    project_id: projectId,
    event_type: "signal_graduated",
    signals_involved: [
      { signal_name: newSignal, role: "graduated", accuracy: newAccuracy },
      { signal_name: oldSignal, role: "replaced", accuracy: oldAccuracy },
    ],
    analysis: `"${newSignal}" (${(newAccuracy * 100).toFixed(1)}%) superó a "${oldSignal}" (${(oldAccuracy * 100).toFixed(1)}%). Reemplazo completado.`,
    action_taken: "signal_graduated",
  });
}

// ─── Helper: rejectSignal ────────────────────────────────────────────────
async function rejectSignal(
  projectId: string,
  signalName: string,
  trialAccuracy: number,
  incumbentAccuracy: number
) {
  const supabase = getSupabase();

  await supabase
    .from("signal_registry")
    .update({ trial_status: "rejected" })
    .eq("project_id", projectId)
    .eq("signal_name", signalName)
    .eq("trial_status", "trial");

  await supabase
    .from("signal_performance")
    .update({ status: "disabled" })
    .eq("project_id", projectId)
    .eq("signal_name", signalName);

  await supabase
    .from("improvement_proposals")
    .update({ status: "rejected" })
    .eq("project_id", projectId)
    .eq("status", "trial_active");

  await supabase.from("learning_events").insert({
    project_id: projectId,
    event_type: "signal_rejected",
    signals_involved: [{ signal_name: signalName, accuracy: trialAccuracy }],
    analysis: `"${signalName}" (${(trialAccuracy * 100).toFixed(1)}%) no superó a la señal actual (${(incumbentAccuracy * 100).toFixed(1)}%). Descartada.`,
    action_taken: "trial_rejected",
  });
}

// ─── Action: diagnose_failing_signal ─────────────────────────────────────
async function diagnoseFailingSignal(projectId: string, signalName: string) {
  const supabase = getSupabase();

  const { data: signalInfo } = await supabase
    .from("signal_registry")
    .select("*")
    .eq("signal_name", signalName)
    .limit(1)
    .maybeSingle();

  const { data: perfData } = await supabase
    .from("signal_performance")
    .select("*")
    .eq("project_id", projectId)
    .eq("signal_name", signalName)
    .maybeSingle();

  if (!perfData) {
    return { error: "No performance data found for signal", signalName };
  }

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

// ─── Action: evaluate_feedback (V2) ─────────────────────────────────────
// Backward compat: accepts signal_name+was_correct (Fase 1) or signals[] (Fase 2 batch)
async function evaluateFeedback(
  projectId: string,
  signalName: string | undefined,
  wasCorrect: boolean,
  context?: string,
  signals?: Array<{ signal_name: string; status?: string }>
) {
  const supabase = getSupabase();

  // Build list of signals to update
  const signalList: Array<{ name: string; status: string }> = [];
  if (signals && signals.length > 0) {
    for (const s of signals) {
      signalList.push({ name: s.signal_name, status: s.status || "established" });
    }
  } else if (signalName) {
    signalList.push({ name: signalName, status: "established" });
  } else {
    return { error: "signal_name or signals[] required" };
  }

  // Update performance for each signal
  for (const signal of signalList) {
    const { data: existing } = await supabase
      .from("signal_performance")
      .select("*")
      .eq("project_id", projectId)
      .eq("signal_name", signal.name)
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
        signal_name: signal.name,
        correct_predictions: wasCorrect ? 1 : 0,
        incorrect_predictions: wasCorrect ? 0 : 1,
        accuracy: wasCorrect ? 1 : 0,
        status: signal.status === "trial" ? "trial" : "active",
        last_evaluated_at: new Date().toISOString(),
      });
    }
  }

  // Log the event
  await supabase.from("learning_events").insert({
    project_id: projectId,
    event_type: "feedback_received",
    signals_involved: signalList.map(s => ({
      signal_name: s.name,
      was_correct: wasCorrect,
      status: s.status,
    })),
    analysis: context || `Feedback: ${wasCorrect ? "correct" : "incorrect"} (${signalList.length} signals)`,
    action_taken: "performance_updated",
  });

  // Auto-evaluate trial signals after each feedback
  const trialResult = await evaluateTrialSignals(projectId);

  return { success: true, signals_updated: signalList.length, trial_evaluation: trialResult };
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

  const { data: pendingProposals } = await supabase
    .from("improvement_proposals")
    .select("signal_name")
    .eq("project_id", projectId)
    .in("status", ["pending", "trial_active"]);

  const pendingSignalNames = new Set((pendingProposals || []).map((p: any) => p.signal_name));

  const results = [];
  for (const signal of failingSignals) {
    if (pendingSignalNames.has(signal.signal_name)) {
      results.push({
        signal_name: signal.signal_name,
        skipped: true,
        reason: "pending or active proposal already exists",
      });
      continue;
    }

    const result = await diagnoseFailingSignal(projectId, signal.signal_name);
    results.push({ signal_name: signal.signal_name, ...result });
  }

  return { failing_count: failingSignals.length, results };
}

// ─── Action: start_signal_trial ──────────────────────────────────────────
async function startSignalTrial(projectId: string, proposalId: string) {
  const supabase = getSupabase();

  const { data: proposal } = await supabase
    .from("improvement_proposals")
    .select("*")
    .eq("id", proposalId)
    .single();

  if (!proposal || proposal.status !== "approved") {
    return { error: "Proposal not found or not approved" };
  }

  const replacements = proposal.proposed_replacements || [];
  if (replacements.length === 0) {
    return { error: "No proposed replacements in this proposal" };
  }

  // Pick highest confidence replacement
  const best = [...replacements].sort((a: any, b: any) =>
    (b.confidence_estimate || 0) - (a.confidence_estimate || 0)
  )[0];

  // Insert trial signal into registry
  const { data: newSignal, error: insertErr } = await supabase
    .from("signal_registry")
    .insert({
      project_id: projectId,
      signal_name: best.signal_name,
      layer_id: proposal.layer_id,
      description: best.description,
      formula: best.formula || null,
      data_source: best.data_source || null,
      confidence: best.confidence_estimate || 0.5,
      impact: "medium",
      trial_status: "trial",
      replaces_signal: proposal.signal_name,
      trial_start_date: new Date().toISOString(),
      trial_min_evaluations: 10,
    })
    .select()
    .single();

  if (insertErr) {
    return { error: "Failed to insert trial signal", details: insertErr.message };
  }

  // Initialize performance tracking
  await supabase.from("signal_performance").insert({
    project_id: projectId,
    signal_name: best.signal_name,
    correct_predictions: 0,
    incorrect_predictions: 0,
    accuracy: 0,
    status: "trial",
  });

  // Update proposal status
  await supabase
    .from("improvement_proposals")
    .update({
      status: "trial_active",
      applied_at: new Date().toISOString(),
      metadata: { trial_signal_name: best.signal_name, trial_signal_id: newSignal.id },
    })
    .eq("id", proposalId);

  // Log
  await supabase.from("learning_events").insert({
    project_id: projectId,
    event_type: "signal_trial_started",
    signals_involved: [
      { signal_name: best.signal_name, role: "trial" },
      { signal_name: proposal.signal_name, role: "incumbent" },
    ],
    analysis: `Señal "${best.signal_name}" entra en prueba para reemplazar "${proposal.signal_name}". Hipótesis: ${best.hypothesis}`,
    action_taken: "trial_started",
    metadata: { proposal_id: proposalId },
  });

  return {
    trial_signal: best.signal_name,
    replaces: proposal.signal_name,
    min_evaluations: 10,
    status: "trial_active",
  };
}

// ─── Action: approve_proposal ────────────────────────────────────────────
async function approveProposal(projectId: string, proposalId: string) {
  const supabase = getSupabase();

  await supabase
    .from("improvement_proposals")
    .update({ status: "approved" })
    .eq("id", proposalId)
    .eq("project_id", projectId);

  // Automatically start trial
  return await startSignalTrial(projectId, proposalId);
}

// ─── Action: reject_proposal ─────────────────────────────────────────────
async function rejectProposal(projectId: string, proposalId: string, reason?: string) {
  const supabase = getSupabase();

  await supabase
    .from("improvement_proposals")
    .update({
      status: "rejected",
      metadata: { rejection_reason: reason || "Rechazado por admin" },
    })
    .eq("id", proposalId)
    .eq("project_id", projectId);

  await supabase.from("learning_events").insert({
    project_id: projectId,
    event_type: "proposal_rejected",
    analysis: `Propuesta rechazada por admin: ${reason || "sin motivo"}`,
    action_taken: "proposal_rejected",
    metadata: { proposal_id: proposalId },
  });

  return { success: true };
}

// ─── Action: evaluate_trial_signals ──────────────────────────────────────
async function evaluateTrialSignals(projectId: string) {
  const supabase = getSupabase();

  const { data: trialSignals } = await supabase
    .from("signal_performance")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "trial");

  const results = [];

  for (const trial of (trialSignals || [])) {
    const totalEvals = trial.correct_predictions + trial.incorrect_predictions;

    // Read min evaluations from registry
    const { data: regInfo } = await supabase
      .from("signal_registry")
      .select("trial_min_evaluations, replaces_signal")
      .eq("project_id", projectId)
      .eq("signal_name", trial.signal_name)
      .eq("trial_status", "trial")
      .maybeSingle();

    const minEvals = regInfo?.trial_min_evaluations || 10;
    const replacesSignal = regInfo?.replaces_signal;

    if (totalEvals < minEvals || !replacesSignal) {
      results.push({
        signal: trial.signal_name,
        status: "waiting",
        evaluations: `${totalEvals}/${minEvals}`,
      });
      continue;
    }

    // Read incumbent accuracy
    const { data: incumbent } = await supabase
      .from("signal_performance")
      .select("accuracy")
      .eq("project_id", projectId)
      .eq("signal_name", replacesSignal)
      .maybeSingle();

    const incumbentAccuracy = incumbent?.accuracy || 0;
    const trialAccuracy = trial.accuracy;

    if (trialAccuracy > incumbentAccuracy + 0.05) {
      await graduateSignal(projectId, trial.signal_name, replacesSignal, trialAccuracy, incumbentAccuracy);
      results.push({
        signal: trial.signal_name,
        action: "graduated",
        trial_accuracy: trialAccuracy,
        incumbent_accuracy: incumbentAccuracy,
      });
    } else if (trialAccuracy < incumbentAccuracy - 0.10) {
      await rejectSignal(projectId, trial.signal_name, trialAccuracy, incumbentAccuracy);
      results.push({
        signal: trial.signal_name,
        action: "rejected",
        trial_accuracy: trialAccuracy,
        incumbent_accuracy: incumbentAccuracy,
      });
    } else {
      results.push({
        signal: trial.signal_name,
        status: "inconclusive",
        trial_accuracy: trialAccuracy,
        incumbent_accuracy: incumbentAccuracy,
        evaluations: totalEvals,
      });
    }
  }

  return { trials_evaluated: results.length, results };
}

// ─── Action: rollback_change ─────────────────────────────────────────────
async function rollbackChange(projectId: string, changeId: string) {
  const supabase = getSupabase();

  const { data: change } = await supabase
    .from("model_change_log")
    .select("*")
    .eq("id", changeId)
    .eq("project_id", projectId)
    .single();

  if (!change) return { error: "Change not found" };

  const oldSignal = (change.previous_state as any)?.replaced_signal;
  const newSignal = change.signal_name;

  if (!oldSignal || !newSignal) return { error: "Invalid change data" };

  // Revert: old → active, new → disabled
  await supabase
    .from("signal_performance")
    .update({ status: "active" })
    .eq("project_id", projectId)
    .eq("signal_name", oldSignal);

  await supabase
    .from("signal_registry")
    .update({ trial_status: "established" })
    .eq("project_id", projectId)
    .eq("signal_name", oldSignal);

  await supabase
    .from("signal_performance")
    .update({ status: "disabled" })
    .eq("project_id", projectId)
    .eq("signal_name", newSignal);

  await supabase
    .from("signal_registry")
    .update({ trial_status: "rejected" })
    .eq("project_id", projectId)
    .eq("signal_name", newSignal);

  const nextVersion = await getNextVersion(projectId);
  await supabase.from("model_change_log").insert({
    project_id: projectId,
    version_id: nextVersion,
    change_type: "rollback",
    signal_name: oldSignal,
    previous_state: { rolled_back_signal: newSignal },
    new_state: { restored_signal: oldSignal },
    applied_by: "admin",
  });

  await supabase.from("learning_events").insert({
    project_id: projectId,
    event_type: "rollback",
    analysis: `Rollback: "${oldSignal}" restaurada, "${newSignal}" desactivada.`,
    action_taken: "rollback_applied",
  });

  return { success: true, restored: oldSignal, disabled: newSignal };
}

// ─── Action: calculate_layer_value ───────────────────────────────────────
async function calculateLayerValue(projectId: string) {
  const supabase = getSupabase();

  // Get all learning events with feedback to calculate per-layer value
  const { data: feedbackEvents } = await supabase
    .from("learning_events")
    .select("*")
    .eq("project_id", projectId)
    .eq("event_type", "feedback_received")
    .order("created_at", { ascending: false })
    .limit(200);

  if (!feedbackEvents || feedbackEvents.length < 10) {
    return { error: "Insufficient data", min_required: 10, current: feedbackEvents?.length || 0 };
  }

  // Get signal performance grouped by layer
  const { data: signalPerfs } = await supabase
    .from("signal_performance")
    .select("*, signal_registry!inner(layer_id, trial_status)")
    .eq("project_id", projectId)
    .in("status", ["active", "trial"]);

  const layers = [1, 2, 3, 4, 5];
  const results = [];

  // Calculate accuracy per layer
  for (const layerId of layers) {
    const layerSignals = (signalPerfs || []).filter(
      (sp: any) => sp.signal_registry?.layer_id === layerId
    );

    if (layerSignals.length === 0) {
      results.push({
        layer_id: layerId,
        signal_count: 0,
        avg_accuracy: 0,
        total_evaluations: 0,
        verdict: "NO_DATA",
      });
      continue;
    }

    const totalCorrect = layerSignals.reduce((sum: number, s: any) => sum + s.correct_predictions, 0);
    const totalIncorrect = layerSignals.reduce((sum: number, s: any) => sum + s.incorrect_predictions, 0);
    const total = totalCorrect + totalIncorrect;
    const avgAccuracy = total > 0 ? Number((totalCorrect / total * 100).toFixed(1)) : 0;

    results.push({
      layer_id: layerId,
      signal_count: layerSignals.length,
      avg_accuracy: avgAccuracy,
      total_evaluations: total,
      verdict: avgAccuracy >= 70 ? "APORTA" : avgAccuracy >= 50 ? "NEUTRAL" : "RESTA",
    });
  }

  // Save as learning_event
  await supabase.from("learning_events").insert({
    project_id: projectId,
    event_type: "layer_value_analysis",
    analysis: `Análisis de valor incremental por capa. ${results.filter(r => r.verdict === "APORTA").length} capas aportan, ${results.filter(r => r.verdict === "RESTA").length} restan.`,
    action_taken: "analysis_completed",
    metadata: { layer_analysis: results },
  });

  return { evaluations_used: feedbackEvents.length, layers: results };
}

// ─── Main handler ────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, project_id, signal_name, was_correct, context, signals, proposal_id, change_id, reason } = body;

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
        if (!signals && !signal_name) {
          return new Response(
            JSON.stringify({ error: "signal_name or signals[] required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (was_correct === undefined) {
          return new Response(
            JSON.stringify({ error: "was_correct required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        result = await evaluateFeedback(project_id, signal_name, was_correct, context, signals);
        break;

      case "check_failing_signals":
        result = await checkFailingSignals(project_id);
        break;

      case "approve_proposal":
        if (!proposal_id) {
          return new Response(JSON.stringify({ error: "proposal_id required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        result = await approveProposal(project_id, proposal_id);
        break;

      case "reject_proposal":
        if (!proposal_id) {
          return new Response(JSON.stringify({ error: "proposal_id required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        result = await rejectProposal(project_id, proposal_id, reason);
        break;

      case "evaluate_trial_signals":
        result = await evaluateTrialSignals(project_id);
        break;

      case "rollback_change":
        if (!change_id) {
          return new Response(JSON.stringify({ error: "change_id required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        result = await rollbackChange(project_id, change_id);
        break;

      case "calculate_layer_value":
        result = await calculateLayerValue(project_id);
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
