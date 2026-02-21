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
        status: "pending",
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

  // Get run sector for autocorrection
  const { data: runData } = await supabase
    .from("pattern_detector_runs")
    .select("sector")
    .eq("id", runId)
    .single();
  const sector = runData?.sector || "";
  const isFarmacia = /farmac|pharma/i.test(sector);

  // Autocorrection loop (up to 2 iterations)
  let qualityGate: any = null;
  const maxIterations = isFarmacia ? 2 : 0;

  for (let iteration = 0; iteration <= maxIterations; iteration++) {
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

    const coveragePct = Math.min(100, sourceList.length * 12);
    const freshnessPct = Math.min(100, sourceList.filter(s => 
      s.update_frequency && ["daily", "weekly", "monthly"].includes(s.update_frequency)
    ).length / Math.max(sourceList.length, 1) * 100);

    qualityGate = {
      status: "PASS" as string,
      coverage_pct: coveragePct,
      freshness_pct: freshnessPct,
      source_diversity: sourceTypes.size,
      avg_reliability_score: Math.round(avgReliability * 10) / 10,
      self_healing_iterations: iteration,
      blocking: false,
      gap_analysis: [] as string[],
    };

    if (coveragePct < 80) qualityGate.gap_analysis.push("Cobertura de variables < 80%");
    if (freshnessPct < 70) qualityGate.gap_analysis.push("Frescura de fuentes < 70%");
    if (sourceTypes.size < 3) qualityGate.gap_analysis.push("Menos de 3 tipos de fuente");
    if (avgReliability < 6) qualityGate.gap_analysis.push("Fiabilidad media < 6/10");

    // If no gaps, PASS
    if (qualityGate.gap_analysis.length === 0) break;

    // Autocorrection for farmacia
    if (isFarmacia && iteration < maxIterations) {
      console.log(`[Phase 3] Autocorrection iteration ${iteration + 1} for farmacia`);
      const existingNames = new Set(sourceList.map(s => s.source_name));

      let additionalSources: Array<{ source_name: string; source_type: string; data_type: string; url: string; reliability_score: number; update_frequency: string }> = [];

      if (iteration === 0) {
        // Iteration 0: Supply chain y distribución (lado oferta)
        additionalSources = [
          { source_name: "Datacomex (Ministerio de Industria)", source_type: "Gov", data_type: "Importación/exportación de productos farmacéuticos por código TARIC. Detecta tensiones en cadena de suministro global.", url: "https://datacomex.comercio.es", reliability_score: 8, update_frequency: "monthly" },
          { source_name: "EMA Shortages Catalogue", source_type: "Gov", data_type: "Catálogo de desabastecimientos a nivel europeo. Anticipa problemas que llegarán a España.", url: "https://www.ema.europa.eu/en/medicines/shortages", reliability_score: 9, update_frequency: "daily" },
          { source_name: "INE - Encuesta Industrial CNAE 21", source_type: "Gov", data_type: "Producción industrial farmacéutica nacional. Indica capacidad productiva y tendencias.", url: "https://www.ine.es/jaxiT3/Tabla.htm?t=28395", reliability_score: 8, update_frequency: "annual" },
        ];
      } else {
        // Iteration 1: Señales tempranas complementarias
        additionalSources = [
          { source_name: "CGCOF/CISMED", source_type: "Report", data_type: "Informes semanales de problemas de suministro reportados por farmacias en tiempo real. Señal temprana directa desde el terreno.", url: "https://www.portalfarma.com", reliability_score: 7, update_frequency: "weekly" },
          { source_name: "BOE/AEMPS Alertas", source_type: "Gov", data_type: "Alertas de retiradas de lotes, cambios regulatorios, modificaciones de precios de referencia. Eventos regulatorios que provocan desabastecimiento.", url: "https://www.aemps.gob.es", reliability_score: 9, update_frequency: "daily" },
          { source_name: "AEMET", source_type: "API", data_type: "Datos climáticos históricos y previsiones. Correlación entre clima y picos de demanda de medicamentos respiratorios, antihistamínicos.", url: "https://opendata.aemet.es/centrodedescargas/inicio", reliability_score: 8, update_frequency: "daily" },
        ];
      }

      for (const src of additionalSources) {
        if (!existingNames.has(src.source_name)) {
          await supabase.from("data_sources_registry").insert({
            run_id: runId,
            user_id: userId,
            source_name: src.source_name,
            url: src.url,
            source_type: src.source_type,
            reliability_score: src.reliability_score,
            data_type: src.data_type,
            update_frequency: src.update_frequency,
            coverage_period: "2020-2025",
            status: "pending",
          });
        }
      }
      continue; // Re-evaluate with new sources
    }

    // Not farmacia or exhausted iterations - evaluate PASS_CONDITIONAL vs FAIL
    break;
  }

  // Final evaluation after autocorrection
  if (qualityGate.gap_analysis.length > 0) {
    const { data: finalSources } = await supabase
      .from("data_sources_registry")
      .select("*")
      .eq("run_id", runId);
    
    const allSourcesCount = (finalSources || []).length;
    const theoreticalCoveragePct = Math.min(100, allSourcesCount * 12);
    const pendingSources = (finalSources || []).filter(s => s.status === "pending");

    if (theoreticalCoveragePct >= 80) {
      qualityGate.status = "PASS";
      qualityGate.blocking = false;
      qualityGate.coverage_pct = theoreticalCoveragePct;
      (qualityGate as any).note = "Fuentes identificadas con cobertura suficiente. Cap de confianza: 70%";
      (qualityGate as any).confidence_cap = 70;
      (qualityGate as any).pending_sources_count = pendingSources.length;
      (qualityGate as any).theoretical_coverage_pct = theoreticalCoveragePct;
    } else if (theoreticalCoveragePct >= 75) {
      qualityGate.status = "PASS_CONDITIONAL";
      qualityGate.blocking = false;
      qualityGate.coverage_pct = theoreticalCoveragePct;
      (qualityGate as any).note = "Fuentes identificadas pero cobertura parcial. Cap de confianza: 60%";
      (qualityGate as any).confidence_cap = 60;
      (qualityGate as any).pending_sources_count = pendingSources.length;
      (qualityGate as any).theoretical_coverage_pct = theoreticalCoveragePct;
    } else {
      qualityGate.status = "FAIL";
      qualityGate.blocking = true;
    }
  }

  // Save quality log
  await supabase.from("rag_quality_logs").insert({
    run_id: runId,
    user_id: userId,
    coverage_pct: qualityGate.coverage_pct,
    freshness_pct: qualityGate.freshness_pct,
    source_diversity: qualityGate.source_diversity,
    avg_reliability_score: qualityGate.avg_reliability_score,
    status: qualityGate.status,
    gap_analysis: qualityGate.gap_analysis,
    self_healing_iterations: qualityGate.self_healing_iterations,
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
  } else if (qualityGate.status === "PASS_CONDITIONAL") {
    await updateRun(runId, {
      phase_results: phaseResults,
      quality_gate: qualityGate,
      quality_gate_passed: true,
      model_verdict: "CONDITIONAL",
      status: "phase_3_complete",
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

  // Check quality gate status for conditional cap
  const { data: runData } = await supabase
    .from("pattern_detector_runs")
    .select("quality_gate")
    .eq("id", runId)
    .single();
  const qgStatus = (runData?.quality_gate as any)?.status || "PASS";
  
  let maxConfidenceCap: number;
  let recommendation: string;
  if (hasUserData) {
    maxConfidenceCap = 1.0;
    recommendation = "Datos del usuario disponibles. Confianza máxima sin cap.";
  } else if (qgStatus === "PASS_CONDITIONAL") {
    maxConfidenceCap = 0.6;
    recommendation = "Sin datos del usuario. Fuentes identificadas pero cobertura parcial. Cap de confianza: 60%.";
  } else if (qgStatus === "PASS") {
    maxConfidenceCap = 0.7;
    recommendation = "Sin datos del usuario. Fuentes identificadas con cobertura suficiente. Cap de confianza: 70%.";
  } else {
    maxConfidenceCap = 0.7;
    recommendation = "Sin datos del usuario. Cap de confianza máxima: 70%. Se recomienda subir datos propios.";
  }

  const phaseResults = await getRunPhaseResults(runId);
  phaseResults.phase_4 = {
    user_data_available: hasUserData,
    datasets_count: (datasets || []).length,
    max_confidence_cap: maxConfidenceCap,
    quality_gate_status: qgStatus,
    recommendation,
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
Cap de confianza máxima: ${maxCap} (${maxCap >= 1 ? "datos del usuario disponibles" : maxCap <= 0.6 ? "fuentes identificadas pero no conectadas, cap 60%" : "sin datos del usuario, máximo 70%"}).
${maxCap <= 0.6 ? "IMPORTANTE: Todos los outputs deben marcarse como 'basados en fuentes parcialmente verificadas'. Las fuentes están identificadas pero no integradas." : ""}
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
// CREDIBILITY ENGINE (between Phase 5 and Phase 6)
// ═══════════════════════════════════════

async function executeCredibilityEngine(runId: string, userId: string) {
  console.log(`[Credibility Engine] Starting for run ${runId}`);

  // Get all signals for this run
  const { data: signals } = await supabase
    .from("signal_registry")
    .select("*")
    .eq("run_id", runId);

  if (!signals || signals.length === 0) {
    console.log("[Credibility Engine] No signals found, skipping");
    return;
  }

  const phaseResults = await getRunPhaseResults(runId);
  const phase1 = phaseResults.phase_1 as Record<string, unknown> || {};

  // Ask AI to evaluate credibility of each signal
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Eres un analista cuantitativo que evalúa la credibilidad de señales detectadas.
Para cada señal, evalúa 4 dimensiones (score 0.0 a 1.0):
1. Estabilidad Temporal: ¿El patrón funcionaría en diferentes periodos? Basado en la naturaleza del patrón.
2. Replicabilidad Cruzada: ¿Se replicaría en diferentes farmacias/zonas? Un patrón aislado es anécdota.
3. Capacidad de Anticipación (normalizada 0-1): ¿Con cuántos días de margen avisa? <2 días=0.2, 3-7=0.4, 7-14=0.6, 14-30=0.8, >30=1.0. También devuelve anticipation_days estimado.
4. Ratio Señal/Ruido: Claridad del patrón frente a fluctuaciones aleatorias. Basado en confianza y p_value.

También evalúa el RÉGIMEN DE MERCADO actual:
- normal: condiciones estándar
- demand_shock: pico anormal de demanda
- supply_shock: rotura de cadena de suministro
- regulatory_change: cambio regulatorio
- unknown_anomaly: anomalía no clasificada

Responde SOLO con JSON válido.`
    },
    {
      role: "user",
      content: `Evalúa la credibilidad de estas señales:

Sector: ${(phase1 as any)?.sector_analysis || "N/A"}
Señales: ${JSON.stringify(signals.map(s => ({
  id: s.id,
  name: s.signal_name,
  description: s.description,
  confidence: s.confidence,
  p_value: s.p_value,
  layer: s.layer_id,
  impact: s.impact,
  trend: s.trend,
  data_source: s.data_source,
})))}

Responde con:
{
  "regime_detected": "normal|demand_shock|supply_shock|regulatory_change|unknown_anomaly",
  "regime_reasoning": "explicación del régimen detectado",
  "evaluations": [
    {
      "signal_id": "uuid",
      "temporal_stability": 0.0-1.0,
      "cross_replication": 0.0-1.0,
      "anticipation_normalized": 0.0-1.0,
      "anticipation_days": 0,
      "signal_to_noise": 0.0-1.0,
      "pattern_description": "descripción del patrón para registro"
    }
  ]
}`
    }
  ];

  try {
    const result = await chat(messages, { model: "gemini-pro", responseFormat: "json", maxTokens: 8192 });
    const parsed = JSON.parse(cleanJson(result));

    const regime = parsed.regime_detected || "normal";
    const evaluations = parsed.evaluations || [];

    let alphaCount = 0, betaCount = 0, fragileCount = 0, noiseCount = 0;

    for (const eval_ of evaluations) {
      const stability = eval_.temporal_stability || 0;
      const replication = eval_.cross_replication || 0;
      const anticipation = eval_.anticipation_normalized || 0;
      const snr = eval_.signal_to_noise || 0;

      // Fixed weights: 0.30 / 0.25 / 0.25 / 0.20
      const finalScore = (0.30 * stability) + (0.25 * replication) + (0.25 * anticipation) + (0.20 * snr);

      let signalClass: string;
      if (finalScore >= 0.8) { signalClass = "Alpha"; alphaCount++; }
      else if (finalScore >= 0.6) { signalClass = "Beta"; betaCount++; }
      else if (finalScore >= 0.4) { signalClass = "Fragile"; fragileCount++; }
      else { signalClass = "Noise"; noiseCount++; }

      // Insert into signal_credibility_matrix
      await supabase.from("signal_credibility_matrix").insert({
        signal_id: eval_.signal_id,
        run_id: runId,
        user_id: userId,
        temporal_stability_score: stability,
        cross_replication_score: replication,
        anticipation_days: eval_.anticipation_days || 0,
        signal_to_noise_ratio: snr,
        final_credibility_score: Math.round(finalScore * 1000) / 1000,
        signal_class: signalClass,
        regime_flag: regime,
        weights_version: 1,
      });

      // Register pattern in pattern_discovery_log
      if (eval_.pattern_description) {
        await supabase.from("pattern_discovery_log").insert({
          run_id: runId,
          user_id: userId,
          discovery_mode: "theoretical",
          pattern_description: eval_.pattern_description,
          variables_involved: [eval_.signal_id],
          correlation_strength: finalScore,
          p_value: null,
          validated: false,
        });
      }
    }

    // Store credibility summary in phase_results
    phaseResults.credibility_engine = {
      total_signals_tested: evaluations.length,
      noise_filtered: noiseCount,
      active_alpha_signals: alphaCount,
      active_beta_signals: betaCount,
      fragile_in_quarantine: fragileCount,
      regime_detected: regime,
      regime_reasoning: parsed.regime_reasoning || "",
    };

    await updateRun(runId, { phase_results: phaseResults });
    console.log(`[Credibility Engine] Done: ${alphaCount} Alpha, ${betaCount} Beta, ${fragileCount} Fragile, ${noiseCount} Noise`);
  } catch (err) {
    console.error("Credibility Engine error:", err);
    // Non-blocking: log but don't fail the pipeline
    phaseResults.credibility_engine = { error: String(err) };
    await updateRun(runId, { phase_results: phaseResults });
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
      "missing_data_types": ["tipo 1", "tipo 2"],
      "learning_metrics": {
        "distance_to_optimal": "X%",
        "accuracy_current": 0.0,
        "accuracy_30d_ago": 0.0,
        "accuracy_60d_ago": 0.0,
        "false_positives_last_30d": 0,
        "patterns_discovered_this_month": 0,
        "hypotheses_confirmed": 0,
        "hypotheses_refuted": 0,
        "regime_detected": "normal|demand_shock|supply_shock|regulatory_change|unknown_anomaly"
      }
}

IMPORTANTE: Incluye el bloque learning_metrics con valores iniciales estimados. Para métricas que requieren datos reales del usuario, usa 0.`
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

    // Get credibility engine data from phase_results
    const credibilityEngine = phaseResults.credibility_engine as Record<string, unknown> || {};

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
      credibility_engine: {
        total_signals_tested: (credibilityEngine as any)?.total_signals_tested || 0,
        noise_filtered: (credibilityEngine as any)?.noise_filtered || 0,
        active_alpha_signals: (credibilityEngine as any)?.active_alpha_signals || 0,
        active_beta_signals: (credibilityEngine as any)?.active_beta_signals || 0,
        fragile_in_quarantine: (credibilityEngine as any)?.fragile_in_quarantine || 0,
        regime_detected: (credibilityEngine as any)?.regime_detected || "normal",
      },
      learning_metrics: parsed.learning_metrics || {
        distance_to_optimal: "N/A",
        accuracy_current: 0,
        accuracy_30d_ago: 0,
        accuracy_60d_ago: 0,
        false_positives_last_30d: 0,
        patterns_discovered_this_month: 0,
        hypotheses_confirmed: 0,
        hypotheses_refuted: 0,
        regime_detected: (credibilityEngine as any)?.regime_detected || "normal",
      },
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

    // ── TRANSLATE INTENT ──
    if (action === "translate_intent") {
      const { sector, geography, time_horizon, business_objective, project_id } = body;
      if (!sector) {
        return new Response(JSON.stringify({ error: "sector required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Load project_context if available
      let contextBlock = "";
      if (project_id) {
        const { data: ctx } = await supabase
          .from("project_context")
          .select("*")
          .eq("project_id", project_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (ctx) {
          contextBlock = `
CONTEXTO EMPRESARIAL (obtenido por Auto-Research):
- Empresa: ${ctx.company_name || "Desconocida"}
- Descripción: ${ctx.company_description || "N/A"}
- Sector detectado: ${ctx.sector_detected || "N/A"}
- Geografía: ${ctx.geography_detected || "N/A"}
- Productos/Servicios: ${JSON.stringify(ctx.products_services || [])}
- Stack tecnológico: ${JSON.stringify(ctx.tech_stack_detected || [])}
- Competidores: ${JSON.stringify(ctx.competitors || [])}
- Tendencias del sector: ${JSON.stringify(ctx.sector_trends || [])}
- Noticias recientes: ${JSON.stringify(ctx.news_mentions || [])}
- Reseñas: ${JSON.stringify(ctx.reviews_summary || {})}
- Confianza del research: ${ctx.confidence_score || "N/A"}

Usa este contexto para hacer la petición técnica MÁS PRECISA y ESPECÍFICA para esta empresa concreta.
`;
        }
      }

      const messages: ChatMessage[] = [
        {
          role: "system",
          content: `Eres un analista senior de datos e inteligencia de negocio con 20 años de experiencia.
Tu tarea es traducir una descripción simple de un usuario en una petición técnica completa y precisa para un sistema de detección de patrones.
Responde SOLO con JSON válido, sin markdown ni explicaciones.`
        },
        {
          role: "user",
          content: `El usuario quiere analizar patrones con esta información:

Sector: ${sector}
Geografía: ${geography || "No especificada"}
Horizonte temporal: ${time_horizon || "No especificado"}
Objetivo del usuario (en sus palabras): ${business_objective || "No especificado"}
${contextBlock}
Genera una petición técnica expandida con este JSON exacto:
{
  "problem_definition": "Definición precisa del problema: qué se predice, para qué contexto, con qué alcance",
  "target_variable": "La variable objetivo principal que el modelo debe predecir o detectar",
  "predictive_variables": ["Variable predictiva 1", "Variable 2", "Variable 3", "Variable 4", "Variable 5", "Variable 6", "Variable 7"],
  "recommended_model_type": "Tipo de modelo recomendado (ej: Series temporales + Anomaly Detection, Clasificación, Regresión, etc.)",
  "success_metrics": ["Métrica de éxito 1", "Métrica 2", "Métrica 3"],
  "likely_data_sources": ["Fuente de datos probable 1", "Fuente 2", "Fuente 3", "Fuente 4", "Fuente 5"],
  "risks_and_limitations": ["Riesgo o limitación 1", "Riesgo 2", "Riesgo 3"],
  "suggested_baseline": "Descripción del baseline naive para comparar (ej: media móvil 30 días + estacionalidad histórica)",
  "prediction_horizons": ["7 días", "14 días", "30 días"],
  "expanded_objective": "Texto completo de 3-5 párrafos que describe la petición técnica como lo haría un analista senior. Este texto reemplazará el objetivo simple del usuario y será el input para el pipeline de análisis. Debe incluir el problema, las variables, el enfoque metodológico, las métricas y los riesgos de forma narrativa y técnica."
}

IMPORTANTE:
- Las variables predictivas deben ser específicas del sector y la geografía indicados.
- Las fuentes de datos deben ser reales y accesibles (APIs públicas, informes sectoriales, bases de datos gubernamentales, etc.).
- Los riesgos deben ser honestos sobre las limitaciones reales.
- El expanded_objective debe ser técnicamente riguroso pero comprensible.`
        }
      ];

      try {
        const result = await chat(messages, { model: "gemini-pro", responseFormat: "json", maxTokens: 4096 });
        const parsed = JSON.parse(cleanJson(result));

        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("translate_intent error:", err);
        return new Response(JSON.stringify({ error: `Translation failed: ${err}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
          // PASS_CONDITIONAL continues with reduced confidence cap
          await executePhase4(run_id);
        await executePhase5(run_id, run.user_id, run.sector, run.business_objective || "");
          await executeCredibilityEngine(run_id, run.user_id);
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
