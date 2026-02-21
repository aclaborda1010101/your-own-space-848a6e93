import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chat, ChatMessage } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

async function updateRun(runId: string, updates: Record<string, unknown>) {
  const { error } = await supabase
    .from("pattern_detector_runs")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", runId);
  if (error) console.error("updateRun error:", error);
}

async function getRunPhaseResults(runId: string): Promise<Record<string, unknown>> {
  const { data } = await supabase
    .from("pattern_detector_runs")
    .select("phase_results")
    .eq("id", runId)
    .single();
  return (data?.phase_results as Record<string, unknown>) || {};
}

function cleanJson(text: string): string {
  let c = text.trim();
  if (c.startsWith("```json")) c = c.slice(7);
  else if (c.startsWith("```")) c = c.slice(3);
  if (c.endsWith("```")) c = c.slice(0, -3);
  c = c.trim();
  const s = c.indexOf("{");
  const e = c.lastIndexOf("}");
  if (s !== -1 && e > s) c = c.slice(s, e + 1);
  return c.trim();
}

// ═══════════════════════════════════════
// PHASE 1: Domain Comprehension
// ═══════════════════════════════════════

async function executePhase1(runId: string, sector: string, geography: string, timeHorizon: string, objective: string) {
  await updateRun(runId, { status: "running_phase_1", current_phase: 1 });

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Eres un analista de datos experto en detección de patrones sectoriales. 
Responde SOLO con JSON válido, sin markdown ni explicaciones.`
    },
    {
      role: "user",
      content: `Analiza este dominio y genera la comprensión inicial:

Sector: ${sector}
Geografía: ${geography}
Horizonte temporal: ${timeHorizon}
Objetivo de negocio: ${objective}

Responde con este JSON exacto:
{
  "sector_analysis": "análisis del sector en 2-3 párrafos",
  "key_variables": ["variable1", "variable2", "variable3", "variable4", "variable5"],
  "initial_signal_map": ["señal1", "señal2", "señal3"],
  "baseline_definition": "descripción del modelo baseline naive para este sector",
  "naive_forecast": "descripción del forecast naive (predicción más simple posible)",
  "data_requirements": ["tipo de dato 1", "tipo de dato 2", "tipo de dato 3"],
  "risk_factors": ["riesgo 1", "riesgo 2"]
}`
    }
  ];

  try {
    const result = await chat(messages, { model: "gemini-flash", responseFormat: "json", maxTokens: 4096 });
    const parsed = JSON.parse(cleanJson(result));

    const phaseResults = await getRunPhaseResults(runId);
    phaseResults.phase_1 = parsed;

    await updateRun(runId, {
      phase_results: phaseResults,
      baseline_definition: parsed.baseline_definition || null,
      status: "phase_1_complete",
    });

    return parsed;
  } catch (err) {
    console.error("Phase 1 error:", err);
    await updateRun(runId, { status: "failed", error_log: `Phase 1 failed: ${err}` });
    throw err;
  }
}

// ═══════════════════════════════════════
// PHASE 2: Source Discovery (AI-based, no Firecrawl)
// ═══════════════════════════════════════

async function executePhase2(runId: string, userId: string, sector: string, geography: string, objective: string) {
  await updateRun(runId, { status: "running_phase_2", current_phase: 2 });

  const phaseResults = await getRunPhaseResults(runId);
  const phase1 = phaseResults.phase_1 as Record<string, unknown> || {};

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Eres un investigador de datos experto. Tu tarea es identificar las mejores fuentes de datos públicas para un análisis sectorial.
Responde SOLO con JSON válido.`
    },
    {
      role: "user",
      content: `Identifica las mejores fuentes de datos para este análisis:

Sector: ${sector}
Geografía: ${geography}
Objetivo: ${objective}
Variables clave: ${JSON.stringify((phase1 as any)?.key_variables || [])}

Para cada fuente, indica:
- Nombre
- URL (si es pública)
- Tipo (API, Paper, Report, Web, Gov, DB)
- Fiabilidad (1-10)
- Tipo de datos que ofrece
- Frecuencia de actualización
- Periodo de cobertura

Responde con JSON:
{
  "sources": [
    {
      "source_name": "nombre",
      "url": "url o null",
      "source_type": "tipo",
      "reliability_score": 7,
      "data_type": "descripción del tipo de datos",
      "update_frequency": "daily|weekly|monthly|quarterly|static",
      "coverage_period": "2020-2025",
      "relevance_note": "por qué es relevante"
    }
  ],
  "search_queries": ["query1", "query2", "query3", "query4", "query5"],
  "proxy_queries": ["proxy1", "proxy2", "proxy3"]
}`
    }
  ];

  try {
    const result = await chat(messages, { model: "gemini-pro", responseFormat: "json", maxTokens: 8192 });
    const parsed = JSON.parse(cleanJson(result));

    // Save sources to data_sources_registry
    const sources = parsed.sources || [];
    for (const src of sources) {
      await supabase.from("data_sources_registry").insert({
        run_id: runId,
        user_id: userId,
        source_name: src.source_name,
        url: src.url || null,
        source_type: src.source_type || "Web",
        reliability_score: src.reliability_score || 5,
        data_type: src.data_type || null,
        update_frequency: src.update_frequency || null,
        coverage_period: src.coverage_period || null,
        status: "active",
      });
    }

    phaseResults.phase_2 = { sources_found: sources.length, search_queries: parsed.search_queries, proxy_queries: parsed.proxy_queries };
    await updateRun(runId, { phase_results: phaseResults, status: "phase_2_complete" });

    return parsed;
  } catch (err) {
    console.error("Phase 2 error:", err);
    await updateRun(runId, { status: "failed", error_log: `Phase 2 failed: ${err}` });
    throw err;
  }
}

// ═══════════════════════════════════════
// PHASE 3: Quality Gate
// ═══════════════════════════════════════

async function executePhase3(runId: string, userId: string) {
  await updateRun(runId, { status: "running_phase_3", current_phase: 3 });

  // Count sources by type
  const { data: sources } = await supabase
    .from("data_sources_registry")
    .select("*")
    .eq("run_id", runId);

  const sourceList = sources || [];
  const sourceTypes = new Set(sourceList.map(s => s.source_type));
  const avgReliability = sourceList.length > 0
    ? sourceList.reduce((sum, s) => sum + (s.reliability_score || 0), 0) / sourceList.length
    : 0;

  // Simple heuristics for coverage and freshness
  const coveragePct = Math.min(100, sourceList.length * 12); // ~8 sources = 96%
  const freshnessPct = Math.min(100, sourceList.filter(s => 
    s.update_frequency && ["daily", "weekly", "monthly"].includes(s.update_frequency)
  ).length / Math.max(sourceList.length, 1) * 100);

  const qualityGate = {
    status: "PASS" as string,
    coverage_pct: coveragePct,
    freshness_pct: freshnessPct,
    source_diversity: sourceTypes.size,
    avg_reliability_score: Math.round(avgReliability * 10) / 10,
    self_healing_iterations: 0,
    blocking: false,
    gap_analysis: [] as string[],
  };

  // Check thresholds
  if (coveragePct < 80) qualityGate.gap_analysis.push("Cobertura de variables < 80%");
  if (freshnessPct < 70) qualityGate.gap_analysis.push("Frescura de fuentes < 70%");
  if (sourceTypes.size < 3) qualityGate.gap_analysis.push("Menos de 3 tipos de fuente");
  if (avgReliability < 6) qualityGate.gap_analysis.push("Fiabilidad media < 6/10");

  if (qualityGate.gap_analysis.length > 0) {
    qualityGate.status = "FAIL";
    qualityGate.blocking = true;
  }

  // Save quality log
  await supabase.from("rag_quality_logs").insert({
    run_id: runId,
    user_id: userId,
    coverage_pct: coveragePct,
    freshness_pct: freshnessPct,
    source_diversity: sourceTypes.size,
    avg_reliability_score: avgReliability,
    status: qualityGate.status,
    gap_analysis: qualityGate.gap_analysis,
    self_healing_iterations: 0,
  });

  const phaseResults = await getRunPhaseResults(runId);
  phaseResults.phase_3 = qualityGate;

  if (qualityGate.status === "FAIL") {
    await updateRun(runId, {
      phase_results: phaseResults,
      quality_gate: qualityGate,
      quality_gate_passed: false,
      status: "blocked",
      model_verdict: "BLOCKED",
    });
  } else {
    await updateRun(runId, {
      phase_results: phaseResults,
      quality_gate: qualityGate,
      quality_gate_passed: true,
      status: "phase_3_complete",
    });
  }

  return qualityGate;
}

// ═══════════════════════════════════════
// PHASE 4: Data Assessment
// ═══════════════════════════════════════

async function executePhase4(runId: string) {
  await updateRun(runId, { status: "running_phase_4", current_phase: 4 });

  // Check if user has uploaded datasets
  const { data: datasets } = await supabase
    .from("project_datasets")
    .select("*")
    .eq("run_id", runId);

  const hasUserData = (datasets || []).some(d => d.source_type === "user_upload");
  const maxConfidenceCap = hasUserData ? 1.0 : 0.7;

  const phaseResults = await getRunPhaseResults(runId);
  phaseResults.phase_4 = {
    user_data_available: hasUserData,
    datasets_count: (datasets || []).length,
    max_confidence_cap: maxConfidenceCap,
    recommendation: hasUserData
      ? "Datos del usuario disponibles. Confianza máxima sin cap."
      : "Sin datos del usuario. Cap de confianza máxima: 70%. Se recomienda subir datos propios.",
  };

  await updateRun(runId, { phase_results: phaseResults, status: "phase_4_complete" });
  return phaseResults.phase_4;
}

// ═══════════════════════════════════════
// PHASE 5: Pattern Detection by Layers
// ═══════════════════════════════════════

async function executePhase5(runId: string, userId: string, sector: string, objective: string) {
  await updateRun(runId, { status: "running_phase_5", current_phase: 5 });

  const phaseResults = await getRunPhaseResults(runId);
  const phase1 = phaseResults.phase_1 as Record<string, unknown> || {};
  const phase4 = phaseResults.phase_4 as Record<string, unknown> || {};
  const maxCap = (phase4 as any)?.max_confidence_cap || 0.7;

  // Get sources for context
  const { data: sources } = await supabase
    .from("data_sources_registry")
    .select("source_name, source_type, data_type, reliability_score")
    .eq("run_id", runId);

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Eres un detective de datos que detecta patrones en 5 capas de profundidad.
Para cada patrón, ejecutas un "abogado del diablo" interno: buscas evidencia que lo contradiga.
Cap de confianza máxima: ${maxCap} (${maxCap < 1 ? "sin datos del usuario, máximo 70%" : "datos del usuario disponibles"}).
Responde SOLO con JSON válido.`
    },
    {
      role: "user",
      content: `Detecta patrones para este análisis:

Sector: ${sector}
Objetivo: ${objective}
Variables clave: ${JSON.stringify((phase1 as any)?.key_variables || [])}
Baseline: ${(phase1 as any)?.baseline_definition || "N/A"}
Fuentes disponibles: ${JSON.stringify(sources || [])}

Genera patrones en 5 capas:
1. Obvia - Lo que cualquier analista vería
2. Analítica Avanzada - Correlaciones menos evidentes
3. Señales Débiles - Indicadores tempranos
4. Inteligencia Lateral - Variables que nadie cruza
5. Edge Extremo - Solo si hay base sólida

Para cada patrón incluye el resultado del abogado del diablo.

Responde con JSON:
{
  "layers": [
    {
      "layer_id": 1,
      "layer_name": "Obvia",
      "signals": [
        {
          "signal_name": "nombre",
          "description": "descripción",
          "confidence": 0.0-${maxCap},
          "p_value_estimate": 0.0-1.0,
          "impact": "high|medium|low",
          "trend": "up|down|stable",
          "uncertainty_type": "epistemic|aleatoric",
          "devil_advocate_result": "validated|degraded|moved_to_hypothesis",
          "contradicting_evidence": "evidencia contraria o null",
          "data_source": "fuente"
        }
      ]
    }
  ]
}`
    }
  ];

  try {
    const result = await chat(messages, { model: "gemini-pro", responseFormat: "json", maxTokens: 8192 });
    const parsed = JSON.parse(cleanJson(result));

    // Save signals to signal_registry
    const layers = parsed.layers || [];
    for (const layer of layers) {
      for (const signal of (layer.signals || [])) {
        await supabase.from("signal_registry").insert({
          run_id: runId,
          user_id: userId,
          layer_id: layer.layer_id,
          layer_name: layer.layer_name,
          signal_name: signal.signal_name,
          description: signal.description,
          confidence: Math.min(signal.confidence || 0, maxCap),
          p_value: signal.p_value_estimate || null,
          impact: signal.impact || "medium",
          trend: signal.trend || "stable",
          uncertainty_type: signal.uncertainty_type || "epistemic",
          devil_advocate_result: signal.devil_advocate_result || null,
          contradicting_evidence: signal.contradicting_evidence || null,
          data_source: signal.data_source || null,
          sector: sector,
        });
      }
    }

    phaseResults.phase_5 = {
      layers_count: layers.length,
      total_signals: layers.reduce((sum: number, l: any) => sum + (l.signals?.length || 0), 0),
    };
    await updateRun(runId, { phase_results: phaseResults, status: "phase_5_complete" });

    return parsed;
  } catch (err) {
    console.error("Phase 5 error:", err);
    await updateRun(runId, { status: "failed", error_log: `Phase 5 failed: ${err}` });
    throw err;
  }
}

// ═══════════════════════════════════════
// PHASE 6: Backtesting (AI Estimates)
// ═══════════════════════════════════════

async function executePhase6(runId: string, userId: string, sector: string) {
  await updateRun(runId, { status: "running_phase_6", current_phase: 6 });

  const phaseResults = await getRunPhaseResults(runId);
  const phase1 = phaseResults.phase_1 as Record<string, unknown> || {};

  // Get signals
  const { data: signals } = await supabase
    .from("signal_registry")
    .select("*")
    .eq("run_id", runId);

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Eres un analista cuantitativo que estima métricas de backtesting.
IMPORTANTE: Estas son ESTIMACIONES basadas en tu conocimiento, NO cálculos reales con datos.
Marca explícitamente que son estimaciones. Responde SOLO con JSON válido.`
    },
    {
      role: "user",
      content: `Estima métricas de backtesting para estos patrones:

Sector: ${sector}
Baseline: ${(phase1 as any)?.baseline_definition || "media móvil"}
Señales detectadas: ${JSON.stringify((signals || []).map(s => ({ name: s.signal_name, confidence: s.confidence, layer: s.layer_id })))}

Estima:
{
  "disclaimer": "Estas métricas son ESTIMACIONES de la IA, no cálculos reales con datos históricos",
  "baseline_rmse": 0.0,
  "naive_rmse": 0.0,
  "model_rmse": 0.0,
  "uplift_vs_naive_pct": 0.0,
  "uplift_vs_baseline_pct": 0.0,
  "complexity_justified": true/false,
  "win_rate_pct": 0.0,
  "precision_pct": 0.0,
  "recall_pct": 0.0,
  "false_positives": 0,
  "false_negatives": 0,
  "avg_anticipation_days": 0,
  "cost_simulation": {
    "estimated_savings": 0.0,
    "cost_of_false_positives": 0.0,
    "net_impact": 0.0
  },
  "retrospective_cases": [
    {
      "event": "descripción del evento",
      "detected": true/false,
      "days_in_advance": 0,
      "signal_used": "nombre de señal"
    }
  ]
}`
    }
  ];

  try {
    const result = await chat(messages, { model: "gemini-pro", responseFormat: "json", maxTokens: 8192 });
    const parsed = JSON.parse(cleanJson(result));

    // Save backtest
    await supabase.from("model_backtests").insert({
      run_id: runId,
      user_id: userId,
      baseline_rmse: parsed.baseline_rmse,
      naive_rmse: parsed.naive_rmse,
      model_rmse: parsed.model_rmse,
      uplift_vs_naive_pct: parsed.uplift_vs_naive_pct,
      uplift_vs_baseline_pct: parsed.uplift_vs_baseline_pct,
      complexity_justified: parsed.complexity_justified,
      win_rate_pct: parsed.win_rate_pct,
      precision_pct: parsed.precision_pct,
      recall_pct: parsed.recall_pct,
      false_positives: parsed.false_positives || 0,
      false_negatives: parsed.false_negatives || 0,
      avg_anticipation_days: parsed.avg_anticipation_days,
      cost_simulation: parsed.cost_simulation || null,
      retrospective_cases: parsed.retrospective_cases || null,
    });

    phaseResults.phase_6 = parsed;
    await updateRun(runId, { phase_results: phaseResults, status: "phase_6_complete" });

    return parsed;
  } catch (err) {
    console.error("Phase 6 error:", err);
    await updateRun(runId, { status: "failed", error_log: `Phase 6 failed: ${err}` });
    throw err;
  }
}

// ═══════════════════════════════════════
// PHASE 7: Actionable Hypotheses
// ═══════════════════════════════════════

async function executePhase7(runId: string, sector: string, objective: string) {
  await updateRun(runId, { status: "running_phase_7", current_phase: 7 });

  const phaseResults = await getRunPhaseResults(runId);

  // Get signals and backtest
  const { data: signals } = await supabase
    .from("signal_registry")
    .select("*")
    .eq("run_id", runId)
    .order("confidence", { ascending: false });

  const { data: backtests } = await supabase
    .from("model_backtests")
    .select("*")
    .eq("run_id", runId)
    .limit(1);

  const backtest = backtests?.[0];

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Eres un consultor estratégico que convierte patrones detectados en hipótesis accionables.
Responde SOLO con JSON válido.`
    },
    {
      role: "user",
      content: `Genera hipótesis accionables:

Sector: ${sector}
Objetivo: ${objective}
Señales validadas: ${JSON.stringify((signals || []).slice(0, 15).map(s => ({
  name: s.signal_name, confidence: s.confidence, layer: s.layer_id, impact: s.impact,
  devil_advocate: s.devil_advocate_result
})))}
Backtest: uplift vs baseline ${backtest?.uplift_vs_baseline_pct || "N/A"}%, win rate ${backtest?.win_rate_pct || "N/A"}%

Responde con:
{
  "model_verdict": "VALID|NOT_RELIABLE_YET|BLOCKED",
  "verdict_explanation": "explicación del veredicto",
  "hypotheses": [
    {
      "title": "título",
      "why_it_matters": "por qué importa",
      "what_it_anticipates": "qué podría anticipar",
      "confidence_level": 0.0-1.0,
      "uncertainty_type": "epistemic|aleatoric",
      "validation_method": "cómo validar con datos adicionales",
      "predictive_use": "uso en modelo predictivo",
      "implementation_cost": "bajo|medio|alto",
      "expected_benefit": "descripción"
    }
  ],
  "next_recommended_actions": ["acción 1", "acción 2", "acción 3"],
  "missing_data_types": ["tipo 1", "tipo 2"]
}`
    }
  ];

  try {
    const result = await chat(messages, { model: "gemini-pro", responseFormat: "json", maxTokens: 8192 });
    const parsed = JSON.parse(cleanJson(result));

    phaseResults.phase_7 = parsed;

    // Build dashboard output
    const layersSummary: any[] = [];
    for (let i = 1; i <= 5; i++) {
      const layerSignals = (signals || []).filter(s => s.layer_id === i);
      if (layerSignals.length > 0) {
        layersSummary.push({
          layer_id: i,
          name: layerSignals[0]?.layer_name || `Capa ${i}`,
          patterns_found: layerSignals.length,
          avg_confidence: Math.round(layerSignals.reduce((s, sig) => s + (sig.confidence || 0), 0) / layerSignals.length * 100) / 100,
        });
      }
    }

    const dashboardOutput = {
      status: parsed.model_verdict === "BLOCKED" ? "quality_gate_failed" : parsed.model_verdict === "VALID" ? "success" : "insufficient_data",
      ready_for_prediction: parsed.model_verdict === "VALID",
      model_verdict: parsed.model_verdict,
      layers_summary: layersSummary,
      backtest_summary: backtest ? {
        win_rate_pct: backtest.win_rate_pct,
        uplift_vs_baseline_pct: backtest.uplift_vs_baseline_pct,
        uplift_vs_naive_pct: backtest.uplift_vs_naive_pct,
        complexity_justified: backtest.complexity_justified,
      } : null,
      hypotheses_count: (parsed.hypotheses || []).length,
      next_recommended_actions: parsed.next_recommended_actions || [],
      missing_data_types: parsed.missing_data_types || [],
    };

    await updateRun(runId, {
      phase_results: phaseResults,
      dashboard_output: dashboardOutput,
      model_verdict: parsed.model_verdict || "NOT_RELIABLE_YET",
      status: "completed",
      current_phase: 7,
    });

    return parsed;
  } catch (err) {
    console.error("Phase 7 error:", err);
    await updateRun(runId, { status: "failed", error_log: `Phase 7 failed: ${err}` });
    throw err;
  }
}

// ═══════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // ── CREATE ──
    if (action === "create") {
      const { project_id, user_id, sector, geography, time_horizon, business_objective } = body;
      if (!user_id || !sector) {
        return new Response(JSON.stringify({ error: "user_id and sector required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase.from("pattern_detector_runs").insert({
        project_id: project_id || null,
        user_id,
        sector,
        geography: geography || null,
        time_horizon: time_horizon || null,
        business_objective: business_objective || null,
        status: "pending",
        current_phase: 0,
      }).select().single();

      if (error) throw error;

      return new Response(JSON.stringify({ run_id: data.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── EXECUTE PHASE ──
    if (action === "execute_phase") {
      const { run_id, phase } = body;
      if (!run_id || !phase) {
        return new Response(JSON.stringify({ error: "run_id and phase required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get run data
      const { data: run } = await supabase
        .from("pattern_detector_runs")
        .select("*")
        .eq("id", run_id)
        .single();

      if (!run) {
        return new Response(JSON.stringify({ error: "Run not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Execute phase in background for heavy phases
      const heavyPhases = [2, 5, 6];
      
      if (heavyPhases.includes(phase)) {
        // Return immediately, execute in background
        const bgPromise = (async () => {
          try {
            switch (phase) {
              case 2: await executePhase2(run_id, run.user_id, run.sector, run.geography || "", run.business_objective || ""); break;
              case 5: await executePhase5(run_id, run.user_id, run.sector, run.business_objective || ""); break;
              case 6: await executePhase6(run_id, run.user_id, run.sector); break;
            }
          } catch (err) {
            console.error(`Background phase ${phase} error:`, err);
          }
        })();

        // @ts-ignore - EdgeRuntime.waitUntil exists in Supabase
        if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
          // @ts-ignore
          EdgeRuntime.waitUntil(bgPromise);
        }

        return new Response(JSON.stringify({ status: "processing", phase }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Execute inline for light phases
      let result;
      switch (phase) {
        case 1: result = await executePhase1(run_id, run.sector, run.geography || "", run.time_horizon || "", run.business_objective || ""); break;
        case 3: result = await executePhase3(run_id, run.user_id); break;
        case 4: result = await executePhase4(run_id); break;
        case 7: result = await executePhase7(run_id, run.sector, run.business_objective || ""); break;
        default:
          return new Response(JSON.stringify({ error: `Invalid phase: ${phase}` }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
      }

      return new Response(JSON.stringify({ status: "completed", phase, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── STATUS ──
    if (action === "status") {
      const { run_id } = body;
      const { data: run } = await supabase
        .from("pattern_detector_runs")
        .select("*")
        .eq("id", run_id)
        .single();

      return new Response(JSON.stringify(run), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── RUN ALL ──
    if (action === "run_all") {
      const { run_id } = body;
      const { data: run } = await supabase
        .from("pattern_detector_runs")
        .select("*")
        .eq("id", run_id)
        .single();

      if (!run) {
        return new Response(JSON.stringify({ error: "Run not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Run all phases sequentially in background
      const bgPromise = (async () => {
        try {
          await executePhase1(run_id, run.sector, run.geography || "", run.time_horizon || "", run.business_objective || "");
          await executePhase2(run_id, run.user_id, run.sector, run.geography || "", run.business_objective || "");
          const qg = await executePhase3(run_id, run.user_id);
          if (qg.status === "FAIL") return; // Blocked
          await executePhase4(run_id);
          await executePhase5(run_id, run.user_id, run.sector, run.business_objective || "");
          await executePhase6(run_id, run.user_id, run.sector);
          await executePhase7(run_id, run.sector, run.business_objective || "");
        } catch (err) {
          console.error("run_all error:", err);
          await updateRun(run_id, { status: "failed", error_log: `Pipeline failed: ${err}` });
        }
      })();

      // @ts-ignore
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(bgPromise);
      }

      return new Response(JSON.stringify({ status: "processing", run_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("pattern-detector-pipeline error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
