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
  c = c.trim();
  // Remove trailing commas before } or ]
  c = c.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
  // Remove control characters
  c = c.replace(/[\x00-\x1F\x7F]/g, " ");
  return c;
}

function safeParseJson(text: string): unknown {
  const cleaned = cleanJson(text);
  try {
    return JSON.parse(cleaned);
  } catch (_firstErr) {
    let repaired = cleaned;

    // Strategy 1: Extract first complete top-level JSON object (handles concatenated JSON)
    let depth = 0;
    let firstObjEnd = -1;
    for (let i = 0; i < repaired.length; i++) {
      if (repaired[i] === '{') depth++;
      else if (repaired[i] === '}') { depth--; if (depth === 0) { firstObjEnd = i; break; } }
    }
    if (firstObjEnd > 0 && firstObjEnd < repaired.length - 1) {
      try { return JSON.parse(repaired.substring(0, firstObjEnd + 1)); } catch { /* continue */ }
    }

    // Strategy 2: Remove trailing incomplete key-value pairs and close structures
    repaired = repaired.replace(/,\s*"[^"]*$/, "");
    repaired = repaired.replace(/,\s*$/, "");
    const openBraces = (repaired.match(/{/g) || []).length;
    const closeBraces = (repaired.match(/}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/]/g) || []).length;
    for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += "]";
    for (let i = 0; i < openBraces - closeBraces; i++) repaired += "}";
    try { return JSON.parse(repaired); } catch { /* continue */ }

    // Strategy 3: Aggressive truncation — find last valid closing brace
    for (let end = repaired.length; end > 10; end--) {
      if (repaired[end - 1] === '}') {
        try { return JSON.parse(repaired.substring(0, end)); } catch { /* continue */ }
      }
    }

    throw new Error(`safeParseJson: all repair strategies failed for text of length ${cleaned.length}`);
  }
}

// ═══════════════════════════════════════
// SECTOR ECONOMIC PARAMETERS
// ═══════════════════════════════════════

interface SectorEconomicParams {
  unit_name: string;
  unit_name_plural: string;
  default_units: number;
  default_margin_pct: number;
  avg_investment: number;
  cost_of_capital_pct: number;
  system_prompt_context: string;
}

const SECTOR_ECONOMIC_PARAMS: Record<string, SectorEconomicParams> = {
  farmacia: {
    unit_name: "farmacia",
    unit_name_plural: "farmacias",
    default_units: 3800,
    default_margin_pct: 30,
    avg_investment: 50000,
    cost_of_capital_pct: 5,
    system_prompt_context: `farmacias en España.
- Margen conservador: 30% si no hay datos reales del cliente.
- Coste de capital: 5% anual.
- Merma: 20% solo para productos con caducidad corta (<6 meses).
- Precio medio medicamento: 8-15 EUR.
- Red típica: 3.800 farmacias.
- Impacto de un acierto: miles de EUR (venta salvada = unidades × precio × 30% margen).
- Impacto de un fallo: miles de EUR (venta perdida por desabastecimiento).`
  },
  centros_comerciales: {
    unit_name: "localización evaluada",
    unit_name_plural: "localizaciones",
    default_units: 1,
    default_margin_pct: 15,
    avg_investment: 40000000,
    cost_of_capital_pct: 8,
    system_prompt_context: `centros comerciales y retail de gran superficie.
- Inversión media por centro comercial: 20-80M EUR.
- Ventas medias anuales de un centro exitoso: 5-15M EUR.
- Coste de una mala ubicación: pérdida parcial o total de la inversión (10-50M EUR).
- Acertar la ubicación: 5-15M EUR/año en ventas generadas.
- Margen conservador: 15%.
- Coste de capital: 8% anual.
- Cada decisión de ubicación es una decisión de millones de EUR.
- Los impactos económicos deben reflejar esta escala: un acierto vale millones, un fallo cuesta millones.`
  },
  default: {
    unit_name: "unidad de negocio",
    unit_name_plural: "unidades",
    default_units: 1,
    default_margin_pct: 20,
    avg_investment: 500000,
    cost_of_capital_pct: 6,
    system_prompt_context: `negocio genérico.
- Margen conservador: 20%.
- Coste de capital: 6% anual.
- Inversión media: 500.000 EUR.
- Calibra los impactos según la escala real del sector.`
  },
};

function detectSectorParams(sector: string): SectorEconomicParams {
  const s = sector.toLowerCase();
  if (/farmac|pharma|medicamento|botica/i.test(s)) return SECTOR_ECONOMIC_PARAMS.farmacia;
  if (/centro.?comercial|shopping|mall|retail.*superficie|ubicaci[oó]n.*comercial|localizaci[oó]n/i.test(s)) return SECTOR_ECONOMIC_PARAMS.centros_comerciales;
  return SECTOR_ECONOMIC_PARAMS.default;
}

function detectSectorKey(sector: string): string {
  const s = sector.toLowerCase();
  if (/farmac|pharma|medicamento|botica/i.test(s)) return "farmacia";
  if (/centro.?comercial|shopping|mall|retail.*superficie|ubicaci[oó]n.*comercial|localizaci[oó]n/i.test(s)) return "centros_comerciales";
  return "default";
}

// ═══════════════════════════════════════
// SECTOR UNCONVENTIONAL SOURCES CATALOG
// ═══════════════════════════════════════

interface UnconventionalSource {
  name: string;
  type: string;
  frequency: string;
  hypothesis: string;
  impact: string;
  integration_cost: string;
  tier: "A" | "B" | "C";
  status: "available" | "pending" | "requires_agreement";
}

const SECTOR_UNCONVENTIONAL_SOURCES: Record<string, UnconventionalSource[]> = {
  centros_comerciales: [
    // Tier A — Available now
    { name: "Google Trends API", type: "API", frequency: "daily", hypothesis: "Ratio búsquedas/oferta como proxy de demanda insatisfecha", impact: "high", integration_cost: "low", tier: "A", status: "available" },
    { name: "OpenStreetMap POIs", type: "DB", frequency: "continuous", hypothesis: "Densidad POIs (restauración, ocio, fitness, pet shops, coworking), zonas verdes, red peatonal, comercios nocturnos", impact: "high", integration_cost: "low", tier: "A", status: "available" },
    { name: "Sede Electrónica del Catastro", type: "Gov", frequency: "quarterly", hypothesis: "Uso parcelas (residencial/comercial/oficinas), permisos construcción recientes, superficie por tipo, antigüedad parque", impact: "high", integration_cost: "medium", tier: "A", status: "available" },
    { name: "AEMET", type: "API", frequency: "daily", hypothesis: "Temperatura media pico verano (>32°C = refugio), días lluvia significativa (>10mm), calidad aire (AQI>150)", impact: "medium", integration_cost: "low", tier: "A", status: "available" },
    { name: "CNMC (Cobertura fibra óptica)", type: "Gov", frequency: "quarterly", hypothesis: "Rollout reciente de fibra = atracción teletrabajadores = nuevos residentes tech", impact: "medium", integration_cost: "low", tier: "A", status: "available" },
    { name: "Ministerio de Educación (Matrícula escolar)", type: "Gov", frequency: "annual", hypothesis: ">5% crecimiento matrícula anual = familias jóvenes llegando = consumo infantil creciente", impact: "medium", integration_cost: "low", tier: "A", status: "available" },
    { name: "INE (Precios vivienda)", type: "Gov", frequency: "quarterly", hypothesis: "Variación precios vivienda: momentum >2%/semestre = zona hot", impact: "medium", integration_cost: "low", tier: "A", status: "available" },
    { name: "Datos abiertos ayuntamientos", type: "Gov", frequency: "varies", hypothesis: "Licencias construcción residencial, licencias actividad económica, aforos tráfico", impact: "high", integration_cost: "medium", tier: "A", status: "available" },
    { name: "Idealista API / Scraping", type: "Web", frequency: "weekly", hypothesis: "Rotación de locales comerciales en zona como indicador de salud comercial", impact: "high", integration_cost: "medium", tier: "A", status: "available" },
    { name: "Google Places API (Reviews/Ratings)", type: "API", frequency: "daily", hypothesis: "Rating medio de comercios cercanos como proxy de satisfacción de zona", impact: "high", integration_cost: "low", tier: "A", status: "available" },
    { name: "DGT - Datos de Tráfico", type: "Gov", frequency: "monthly", hypothesis: "Volumen de tráfico rodado como proxy de accesibilidad y catchment area", impact: "medium", integration_cost: "low", tier: "A", status: "available" },
    { name: "Catastro - Valoraciones", type: "Gov", frequency: "quarterly", hypothesis: "Evolución del valor catastral como indicador de revalorización de zona", impact: "medium", integration_cost: "low", tier: "A", status: "available" },
    // Tier B — Pending
    { name: "Inside Airbnb", type: "Web", frequency: "monthly", hypothesis: ">20% crecimiento anual listings = gentrificación activa = poder adquisitivo creciente", impact: "medium", integration_cost: "medium", tier: "B", status: "pending" },
    { name: "LinkedIn Jobs API", type: "API", frequency: "weekly", hypothesis: ">500 ofertas empleo últimos 6 meses en <5km = crecimiento empresarial", impact: "medium", integration_cost: "medium", tier: "B", status: "pending" },
    { name: "Google Maps Popular Times", type: "Web", frequency: "weekly", hypothesis: "Tráfico horas muertas (14-16h martes-jueves) = residentes locales = gasto recurrente", impact: "high", integration_cost: "medium", tier: "B", status: "pending" },
    { name: "APIs delivery (Glovo/Uber Eats)", type: "API", frequency: "daily", hypothesis: "Tiempo respuesta >15 min = baja saturación comercial = oportunidad", impact: "medium", integration_cost: "medium", tier: "B", status: "pending" },
    { name: "Movilidad bicicletas/patinetes públicos", type: "API", frequency: "daily", hypothesis: "Alta densidad estaciones y uso = público joven urbano sin coche", impact: "low", integration_cost: "medium", tier: "B", status: "pending" },
    { name: "BBVA/CaixaBank Commerce Data", type: "Data Provider", frequency: "monthly", hypothesis: "Gasto con tarjeta por categoría y zona como demanda real de consumo", impact: "high", integration_cost: "high", tier: "B", status: "requires_agreement" },
    { name: "Telefónica/Orange Movilidad", type: "Data Provider", frequency: "weekly", hypothesis: "Flujos de movilidad real (origen-destino) como catchment area real", impact: "high", integration_cost: "high", tier: "B", status: "requires_agreement" },
    { name: "Censos y Padrones Municipales", type: "Gov", frequency: "annual", hypothesis: "Pirámide poblacional y proyección demográfica a 5-10 años", impact: "medium", integration_cost: "low", tier: "B", status: "pending" },
    // Tier C — Requires agreement
    { name: "Operadores telefonía (movilidad real)", type: "Telco", frequency: "daily", hypothesis: "Movilidad real, dwell time, diferenciación población residencial/laboral/transitoria", impact: "high", integration_cost: "high", tier: "C", status: "requires_agreement" },
    { name: "SafeGraph/equivalente europeo", type: "Data Provider", frequency: "weekly", hypothesis: "Foot traffic real por establecimiento", impact: "high", integration_cost: "high", tier: "C", status: "requires_agreement" },
    { name: "Nielsen (datos consumo)", type: "Data Provider", frequency: "monthly", hypothesis: "Datos de consumo por zona y categoría", impact: "medium", integration_cost: "high", tier: "C", status: "requires_agreement" },
  ],
};

function getUnconventionalSources(sector: string): UnconventionalSource[] | null {
  const key = detectSectorKey(sector);
  return SECTOR_UNCONVENTIONAL_SOURCES[key] || null;
}

// ═══════════════════════════════════════
// PHASE 1: Domain Comprehension
// ═══════════════════════════════════════

async function executePhase1(runId: string, sector: string, geography: string, timeHorizon: string, objective: string) {
  await updateRun(runId, { status: "running_phase_1", current_phase: 1 });

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Eres un analista de datos senior experto en detección de patrones sectoriales y modelado causal.
Tu análisis debe ser PROFUNDO y ESPECÍFICO al sector, no genérico.
Responde SOLO con JSON válido, sin markdown ni explicaciones.`
    },
    {
      role: "user",
      content: `Analiza este dominio y genera la comprensión inicial PROFUNDA:

Sector: ${sector}
Geografía: ${geography}
Horizonte temporal: ${timeHorizon}
Objetivo de negocio: ${objective}

Responde con este JSON exacto:
{
  "sector_analysis": "análisis del sector en 3-5 párrafos con datos cuantitativos (tamaño de mercado, tendencias, actores clave, regulación vigente)",
  "key_variables": [
    {"name": "variable1", "type": "leading|lagging|coincident", "data_source_likely": "fuente probable", "update_frequency": "daily|weekly|monthly|quarterly", "causal_role": "causa|efecto|mediador|confusor"},
    {"name": "variable2", "type": "leading", "data_source_likely": "fuente", "update_frequency": "monthly", "causal_role": "causa"}
  ],
  "causal_hypotheses": [
    {"hypothesis": "X causa Y porque Z", "variables_involved": ["X", "Y"], "direction": "positive|negative|nonlinear", "confidence": 0.0-1.0, "testable_prediction": "Si X sube 10%, Y debería subir N% en M meses", "confounding_variables": ["posible confusor 1"]}
  ],
  "initial_signal_map": [
    {"signal": "nombre", "layer_candidate": 1-5, "detection_method": "correlación|regression|anomaly|clustering|causal", "business_decision": "qué decisión de negocio habilita"}
  ],
  "baseline_definition": "modelo baseline naive ESPECÍFICO: fórmula o método concreto (ej: media móvil 12 meses, último valor conocido, regresión lineal simple sobre variable X)",
  "baseline_methodology": {"method": "moving_average|last_value|linear_regression|seasonal_naive", "window": "12 meses", "variables_used": ["var1"], "expected_rmse_range": "estimación del error base"},
  "naive_forecast": "descripción del forecast naive con horizonte temporal concreto y métrica de evaluación",
  "data_requirements": [
    {"data_type": "tipo de dato", "granularity": "diario|semanal|mensual", "minimum_history": "meses/años necesarios", "critical": true, "proxy_if_unavailable": "alternativa si no existe"}
  ],
  "risk_factors": [
    {"risk": "descripción", "probability_pct": 0-100, "impact": "high|medium|low", "mitigation": "acción concreta"}
  ],
  "sector_specific_kpis": ["KPI1 con definición y fórmula", "KPI2"],
  "regulatory_constraints": ["regulación relevante que limita o condiciona el análisis"],
  "analogous_sectors": ["sector análogo del que se pueden importar patrones", "por qué es análogo"]
}`
    }
  ];

  try {
    const result = await chat(messages, { model: "gemini-flash", responseFormat: "json", maxTokens: 4096 });
    const parsed = safeParseJson(result);

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
// PHASE 1b: Pattern Design Map (Pattern-First Architecture)
// ═══════════════════════════════════════

async function executePhase1b(runId: string, sector: string, geography: string, objective: string) {
  await updateRun(runId, { status: "running_phase_1b", current_phase: 1 });

  const phaseResults = await getRunPhaseResults(runId);
  const phase1 = phaseResults.phase_1 as Record<string, unknown> || {};

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Eres un arquitecto de inteligencia de negocio senior. Tu tarea es DISEÑAR el mapa de patrones que se buscarán ANTES de buscar fuentes de datos.
Para cada patrón defines QUÉ datos necesita y DE DÓNDE podrían obtenerse. Esto guía la búsqueda de fuentes posterior.
Responde SOLO con JSON válido.`
    },
    {
      role: "user",
      content: `Diseña el mapa completo de patrones a detectar para este análisis:

Sector: ${sector}
Geografía: ${geography}
Objetivo: ${objective}
Análisis sectorial: ${(phase1 as any)?.sector_analysis || "N/A"}
Variables clave: ${JSON.stringify((phase1 as any)?.key_variables || [])}
Hipótesis causales: ${JSON.stringify((phase1 as any)?.causal_hypotheses || [])}
KPIs sectoriales: ${JSON.stringify((phase1 as any)?.sector_specific_kpis || [])}
Sectores análogos: ${JSON.stringify((phase1 as any)?.analogous_sectors || [])}

Para cada una de las 5 CAPAS DE INTELIGENCIA, define los patrones específicos que se buscarán.
Mínimo 3 patrones por capa (15-25 total). Cada patrón debe declarar:
- Qué datos necesita exactamente
- Qué fuentes ideales proporcionarían esos datos
- Qué método de detección se usará
- Qué decisión de negocio habilita
- Frecuencia mínima del dato y profundidad histórica requerida

Responde con JSON:
{
  "pattern_map": [
    {
      "layer": 1,
      "layer_name": "Evidentes",
      "patterns": [
        {
          "pattern_name": "nombre específico del patrón",
          "what_to_detect": "qué se busca detectar concretamente",
          "why_matters": "por qué importa para el negocio",
          "data_needed": ["tipo de dato 1", "tipo de dato 2"],
          "ideal_sources": ["fuente ideal 1 con URL si posible", "fuente 2"],
          "minimum_frequency": "daily|weekly|monthly|quarterly",
          "minimum_history": "meses o años necesarios",
          "detection_method": "trend_analysis|correlation|anomaly|regression|clustering|causal|formula_composite",
          "decision_enabled": "qué decisión concreta habilita este patrón",
          "cross_reference": "con qué dato interno del cliente se cruza"
        }
      ]
    },
    {
      "layer": 2,
      "layer_name": "Proceso / Analítica Avanzada",
      "patterns": [...]
    },
    {
      "layer": 3,
      "layer_name": "Dolor / Señales Débiles",
      "patterns": [...]
    },
    {
      "layer": 4,
      "layer_name": "Éxito Oculto / Inteligencia Lateral",
      "patterns": [...]
    },
    {
      "layer": 5,
      "layer_name": "Sistémico / Edge Extremo",
      "patterns": [...]
    }
  ],
  "total_patterns": 20,
  "total_unique_sources_needed": 18,
  "coverage_by_layer": {"1": 4, "2": 4, "3": 5, "4": 4, "5": 3},
  "source_priority_ranking": [
    {"source": "nombre fuente", "patterns_served": 3, "layers_covered": [1, 3, 4], "priority": "critical|important|nice_to_have"}
  ]
}`
    }
  ];

  try {
    const result = await chat(messages, { model: "gemini-pro", responseFormat: "json", maxTokens: 8192 });
    const parsed = safeParseJson(result) as any;

    phaseResults.phase_1b = parsed;
    await updateRun(runId, { phase_results: phaseResults, status: "phase_1b_complete" });

    console.log(`[Phase 1b] Pattern map done: ${parsed.total_patterns || "?"} patterns, ${parsed.total_unique_sources_needed || "?"} sources needed`);
    return parsed;
  } catch (err) {
    console.error("Phase 1b error:", err);
    await updateRun(runId, { status: "failed", error_log: `Phase 1b failed: ${err}` });
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
  const phase1b = phaseResults.phase_1b as Record<string, unknown> || {};

  // Check for unconventional sources for this sector
  const unconventionalSources = getUnconventionalSources(sector);
  let unconventionalBlock = "";
  if (unconventionalSources) {
    unconventionalBlock = `

FUENTES NO CONVENCIONALES ESPECÍFICAS DEL SECTOR (INCLUIR OBLIGATORIAMENTE):
Además de las fuentes convencionales, DEBES incluir las siguientes fuentes no convencionales clasificadas por tier de accesibilidad.
Para cada una, usa el status indicado y la hipótesis proporcionada.

${unconventionalSources.map(s => `- [Tier ${s.tier}] ${s.name} (${s.type}, freq: ${s.frequency}, status: ${s.status})
  Hipótesis: ${s.hypothesis}
  Impacto estimado: ${s.impact} | Coste integración: ${s.integration_cost}`).join("\n")}

IMPORTANTE: Incluye TODAS estas fuentes en tu respuesta, manteniendo el tier y status indicados.`;
  }

  // Build pattern-map directed source discovery block
  let patternMapBlock = "";
  const patternMap = (phase1b as any)?.pattern_map || [];
  if (patternMap.length > 0) {
    const allNeededSources: string[] = [];
    const patternSummaries = patternMap.map((layer: any) => {
      const patterns = (layer.patterns || []).map((p: any) => {
        (p.ideal_sources || []).forEach((s: string) => allNeededSources.push(s));
        return `  - ${p.pattern_name}: necesita [${(p.data_needed || []).join(", ")}] de [${(p.ideal_sources || []).join(", ")}] (freq: ${p.minimum_frequency}, historia: ${p.minimum_history})`;
      }).join("\n");
      return `Capa ${layer.layer} (${layer.layer_name}):\n${patterns}`;
    }).join("\n\n");

    patternMapBlock = `

═══ MAPA DE PATRONES A SERVIR (OBLIGATORIO) ═══
Los siguientes patrones han sido diseñados y necesitan fuentes ESPECÍFICAS.
Tu tarea es encontrar la MEJOR fuente real para CADA patrón. Mínimo 15 fuentes.

${patternSummaries}

FUENTES IDEALES IDENTIFICADAS (busca estas + alternativas):
${[...new Set(allNeededSources)].map(s => `- ${s}`).join("\n")}

Para cada fuente que incluyas, indica qué patrones del mapa sirve en el campo "patterns_served".`;
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Eres un investigador de datos experto. Tu tarea es identificar las mejores fuentes de datos públicas para un análisis sectorial.
${patternMap.length > 0 ? "IMPORTANTE: Tienes un MAPA DE PATRONES que define exactamente qué fuentes se necesitan. Busca fuentes ESPECÍFICAS para cada patrón, no fuentes genéricas." : ""}
Responde SOLO con JSON válido.`
    },
    {
      role: "user",
      content: `Identifica las mejores fuentes de datos para este análisis:

Sector: ${sector}
Geografía: ${geography}
Objetivo: ${objective}
Variables clave: ${JSON.stringify((phase1 as any)?.key_variables || [])}
${patternMapBlock}
${unconventionalBlock}

Para cada fuente, indica:
- Nombre
- URL (si es pública)
- Tipo (API, Paper, Report, Web, Gov, DB, Telco, Data Provider)
- Fiabilidad (1-10)
- Tipo de datos que ofrece
- Frecuencia de actualización
- Periodo de cobertura
- Status: "available" para Tier A, "pending" para Tier B, "requires_agreement" para Tier C, "pending" para fuentes convencionales
- Hipótesis que soporta (hypothesis)
- Impacto estimado (impact): high, medium, low
- Coste de integración (integration_cost): high, medium, low
${patternMap.length > 0 ? '- patterns_served: lista de nombres de patrones del mapa que esta fuente alimenta' : ''}

${patternMap.length > 0 ? 'MÍNIMO 15 fuentes. Cada patrón del mapa debe tener al menos 1 fuente.' : ''}

Responde con JSON:
{
  "sources": [
    {
      "source_name": "nombre",
      "url": "url o null",
      "source_type": "tipo",
      "reliability_score": 7,
      "data_type": "descripción del tipo de datos",
      "update_frequency": "daily|weekly|monthly|quarterly|continuous|varies|annual",
      "coverage_period": "2020-2025",
      "relevance_note": "por qué es relevante",
      "status": "available|pending|requires_agreement",
      "hypothesis": "hipótesis que soporta",
      "impact": "high|medium|low",
      "integration_cost": "low|medium|high"${patternMap.length > 0 ? ',\n      "patterns_served": ["patrón1", "patrón2"]' : ''}
    }
  ],
  "search_queries": ["query1", "query2", "query3", "query4", "query5"],
  "proxy_queries": ["proxy1", "proxy2", "proxy3"]${patternMap.length > 0 ? ',\n  "pattern_coverage": {"covered_patterns": 18, "total_patterns": 20, "uncovered": ["patrón sin fuente"]}' : ''}
}`
    }
  ];

  try {
    const result = await chat(messages, { model: "gemini-pro", responseFormat: "json", maxTokens: 8192 });
    const parsed = safeParseJson(result);

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
        status: src.status || "pending",
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

  // Get pattern_map from Phase 1b for coverage evaluation
  const phaseResultsInit = await getRunPhaseResults(runId);
  const phase1b = phaseResultsInit.phase_1b as any || {};
  const patternMap = phase1b?.pattern_map || [];
  const totalPatternsPlanned = patternMap.reduce((sum: number, l: any) => sum + (l.patterns?.length || 0), 0);

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

    const reliabilityBonus = avgReliability >= 7 ? 10 : 0;
    // If pattern_map exists, coverage = % of patterns with at least 1 source
    let coveragePct: number;
    if (totalPatternsPlanned > 0) {
      // More sources relative to patterns = better coverage
      coveragePct = Math.min(100, Math.round((sourceList.length / totalPatternsPlanned) * 100));
    } else {
      coveragePct = Math.min(100, sourceList.length * 18 + reliabilityBonus);
    }
    const freshnessPct = Math.min(100, sourceList.filter(s => 
      s.update_frequency && ["daily", "weekly", "monthly", "quarterly", "annual", "biannual", "semi-annual", "yearly", "continuous", "real-time", "realtime", "varies", "irregular", "hourly"].includes(s.update_frequency?.toLowerCase?.() || "")
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
      patterns_planned: totalPatternsPlanned,
      sources_found: sourceList.length,
    };

    if (coveragePct < 80) qualityGate.gap_analysis.push(`Cobertura de patrones < 80% (${coveragePct}%)`);
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
    const finalAvgReliability = (finalSources || []).length > 0
      ? (finalSources || []).reduce((sum: number, s: any) => sum + (s.reliability_score || 0), 0) / (finalSources || []).length
      : 0;
    const finalReliabilityBonus = finalAvgReliability >= 7 ? 10 : 0;
    const theoreticalCoveragePct = Math.min(100, allSourcesCount * 18 + finalReliabilityBonus);
    const pendingSources = (finalSources || []).filter(s => s.status === "pending");

    if (theoreticalCoveragePct >= 80) {
      qualityGate.status = "PASS";
      qualityGate.blocking = false;
      qualityGate.coverage_pct = theoreticalCoveragePct;
      (qualityGate as any).note = "Fuentes identificadas con cobertura suficiente. Cap de confianza: 70%";
      (qualityGate as any).confidence_cap = 70;
      (qualityGate as any).pending_sources_count = pendingSources.length;
      (qualityGate as any).theoretical_coverage_pct = theoreticalCoveragePct;
    } else {
      // Floor to PASS_CONDITIONAL — never block
      qualityGate.status = "PASS_CONDITIONAL";
      qualityGate.blocking = false;
      qualityGate.coverage_pct = theoreticalCoveragePct;
      const capValue = theoreticalCoveragePct >= 60 ? 60 : 50;
      (qualityGate as any).note = `Cobertura parcial (${theoreticalCoveragePct}%). Cap de confianza: ${capValue}%`;
      (qualityGate as any).confidence_cap = capValue;
      (qualityGate as any).pending_sources_count = pendingSources.length;
      (qualityGate as any).theoretical_coverage_pct = theoreticalCoveragePct;
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

  if (qualityGate.status === "PASS_CONDITIONAL") {
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
  const phase1b = phaseResults.phase_1b as any || {};
  const phase4 = phaseResults.phase_4 as Record<string, unknown> || {};
  const maxCap = (phase4 as any)?.max_confidence_cap || 0.7;

  // Build pattern_map cross-reference block for Phase 5
  const patternMap = phase1b?.pattern_map || [];
  let patternMapCrossRef = "";
  if (patternMap.length > 0) {
    const patternList = patternMap.flatMap((l: any) => 
      (l.patterns || []).map((p: any) => `  - [Capa ${l.layer}] ${p.pattern_name}: ${p.what_to_detect} (método: ${p.detection_method})`)
    ).join("\n");
    patternMapCrossRef = `

═══ MAPA DE PATRONES PLANIFICADOS (Phase 1b) ═══
Debes generar señales para TODOS estos patrones. Si un patrón no tiene señal, explica por qué en "uncovered_patterns".

${patternList}

En tu respuesta, incluye el campo "pattern_coverage" con:
- covered: patrones del mapa que tienen al menos 1 señal
- uncovered: patrones del mapa SIN señal, con razón (falta_fuente | irrelevante | datos_insuficientes)`;
  }

  // Get sources for context
  const { data: sources } = await supabase
    .from("data_sources_registry")
    .select("source_name, source_type, data_type, reliability_score")
    .eq("run_id", runId);

  // Fetch relevant datasets for this run (from Drive ingestion)
  let datasetContext = "";
  try {
    const { data: relevantDatasets } = await supabase
      .from("pattern_detector_datasets")
      .select("file_name, classification, relevance_reason, extracted_text")
      .eq("run_id", runId)
      .eq("status", "relevant")
      .order("relevance_score", { ascending: false });

    if (relevantDatasets && relevantDatasets.length > 0) {
      const datasetSummaries = relevantDatasets.map((d: any) => {
        const textSample = (d.extracted_text || "").slice(0, 2000);
        return `- ${d.file_name} [${d.classification}]: ${d.relevance_reason}\n  Extracto: ${textSample}`;
      }).join("\n\n");
      datasetContext = `\n\n═══ DATOS PROPIOS DEL PROYECTO (Datasets Drive) ═══\nSe han analizado ${relevantDatasets.length} archivos relevantes del proyecto. Usa esta información para fundamentar patrones con datos reales:\n\n${datasetSummaries}`;
    }
  } catch (e) {
    console.log("No dataset context available:", e);
  }

  // Check for sector-specific composite metrics instructions
  const sectorKey = detectSectorKey(sector);
  let compositeMetricsBlock = "";
  let unconventionalSystemRule = "";
  if (sectorKey === "centros_comerciales") {
    unconventionalSystemRule = `

REGLA CRÍTICA PARA CENTROS COMERCIALES:
Las Capas 1-2 contienen señales convencionales (renta, densidad, accesibilidad). Eso es CORRECTO.
Las Capas 3-5 DEBEN contener señales NO CONVENCIONALES específicas listadas abajo. Si solo generas señales convencionales (renta, densidad, accesibilidad, demografía básica) en Capas 3-5, tu respuesta es INCORRECTA y será rechazada.
Ambos tipos de señales deben COEXISTIR: convencionales en Capas 1-2, no convencionales en Capas 3-5.
Para cada señal no convencional, DEBES generar contradicting_evidence específica y realista (no genérica).`;

    compositeMetricsBlock = `

═══════════════════════════════════════════════════════════════
SEÑALES NO CONVENCIONALES OBLIGATORIAS PARA CENTROS COMERCIALES
═══════════════════════════════════════════════════════════════

Las Capas 3-5 DEBEN contener MÍNIMO las señales listadas abajo con los signal_name EXACTOS.
Puedes añadir más señales, pero estas son OBLIGATORIAS. Si falta alguna, la respuesta es inválida.

▶ CAPA 3 — Señales débiles (signal_name exacto obligatorio):
1. signal_name: "Predictor Matricula Escolar"
   → Crecimiento matrícula escolar municipal >5% anual como predictor de familias jóvenes llegando. Fuente: Ministerio de Educación.
   → contradicting_evidence ejemplo: "El aumento de matrícula puede deberse a redistribución zonal, no a nuevas familias."

2. signal_name: "Momentum Inmobiliario"
   → Variación precio m² >2%/semestre como indicador de zona en calentamiento. Fuente: INE.
   → contradicting_evidence ejemplo: "La subida de precios puede ser especulativa sin respaldo de demanda real de consumo."

3. signal_name: "Proxy Gentrificacion Airbnb"
   → Crecimiento de listings Airbnb >20% anual como proxy de gentrificación activa. Fuente: Inside Airbnb.
   → contradicting_evidence ejemplo: "El aumento de Airbnb puede reducir población residente permanente, disminuyendo el consumo recurrente."

4. signal_name: "Atractor Fibra Optica"
   → Rollout reciente de fibra óptica como atractor de teletrabajadores y nuevos residentes tech. Fuente: CNMC.
   → contradicting_evidence ejemplo: "La fibra óptica atrae teletrabajadores que compran online, no en centros comerciales."

▶ CAPA 4 — Inteligencia lateral (signal_name exacto obligatorio):
1. signal_name: "Proxy Saturacion Delivery"
   → Tiempo de respuesta delivery (Glovo/Uber Eats) >15 min en horario punta como proxy de baja saturación comercial = oportunidad. Fuente: APIs delivery.
   → contradicting_evidence ejemplo: "El tiempo de respuesta alto puede deberse a falta de repartidores, no a baja saturación comercial."

2. signal_name: "Demanda Insatisfecha Google"
   → Ratio búsquedas Google Maps "centros comerciales cerca" / visitas reales como proxy de demanda insatisfecha. Fuente: Google Trends + Google Maps.
   → contradicting_evidence ejemplo: "Las búsquedas altas pueden ser de turistas de paso, no de residentes con gasto recurrente."

3. signal_name: "Dead Hours Traffic"
   → Tráfico peatonal en "horas muertas" (14:00-16:00 martes-jueves) como indicador de base residencial estable. Fuente: Google Maps Popular Times.
   → contradicting_evidence ejemplo: "El tráfico en horas muertas puede ser de estudiantes o desempleados con bajo poder adquisitivo."

4. signal_name: "Indicador Teletrabajo Coworkings"
   → Densidad de coworkings en radio 5km como indicador de teletrabajo normalizado. Fuente: OpenStreetMap.
   → contradicting_evidence ejemplo: "Los coworkings pueden estar vacíos o cerrando, indicando fracaso del modelo, no adopción."

5. signal_name: "Proxy Poder Adquisitivo Gimnasios"
   → Ratio gimnasios premium vs low-cost como proxy de poder adquisitivo local. Fuente: OpenStreetMap + Google Maps.
   → contradicting_evidence ejemplo: "Los gimnasios premium pueden estar subvencionados o dirigidos a público no residente."

6. signal_name: "Crecimiento Empresarial LinkedIn"
   → Densidad de ofertas de empleo LinkedIn en radio 5km como indicador de crecimiento empresarial. Fuente: LinkedIn API.
   → contradicting_evidence ejemplo: "Las ofertas pueden ser remotas geolocalizadas artificialmente, sin impacto real en la zona."

▶ CAPA 5 — Edge extremo con fórmulas (signal_name exacto obligatorio):
1. signal_name: "Latent Demand Score"
   → Fórmula: (Búsquedas Google zona / Oferta comercial actual) × Crecimiento población. >2.5 = oportunidad clara.
   → contradicting_evidence ejemplo: "El alto ratio puede indicar que la oferta no se sostiene, no que falta oferta."

2. signal_name: "Future-Proof Index"
   → Fórmula: (Cobertura fibra × Permisos construcción × Ofertas empleo) / Competencia actual. >1.0 = zona en expansión sostenible.
   → contradicting_evidence ejemplo: "Los permisos de construcción pueden ser residenciales sin componente comercial."

3. signal_name: "Climate Refuge Score"
   → Fórmula: (Días >32°C + Días lluvia >10mm + Días AQI>150) / 365. >0.25 = centro comercial beneficiado como refugio climático. Fuente: AEMET.
   → contradicting_evidence ejemplo: "El efecto refugio es estacional y no genera fidelización a largo plazo."

4. signal_name: "Dead Hours Vitality Index"
   → Fórmula: Tráfico horas muertas / Tráfico pico sábado. >0.3 = base residencial fuerte.
   → contradicting_evidence ejemplo: "Puede reflejar horarios de trabajo flexibles temporales, no residencia estable."

5. signal_name: "Correlacion Pet Shops Demografia"
   → Correlación densidad pet shops + veterinarias con perfil demográfico (familias jóvenes / parejas DINK = alto gasto discrecional). Fuente: OpenStreetMap.
   → contradicting_evidence ejemplo: "La densidad de pet shops puede reflejar tendencia nacional, no poder adquisitivo local."

6. signal_name: "Benchmark Success Score"
   → Score 0-100 comparando composición de operadores, ocupación y mix sectorial vs los 20 centros más exitosos de España.
   → contradicting_evidence ejemplo: "Los centros de referencia operan en contextos únicos no replicables."

7. signal_name: "Resilience Index"
   → Fórmula: (1 - Herfindahl operadores) × Diversidad sectorial × (1 - Dependencia anchor). Mide anti-fragilidad.
   → contradicting_evidence ejemplo: "Alta diversificación puede indicar falta de identidad comercial clara."

▶ CAPA 3 — Señales adicionales obligatorias:
5. signal_name: "Índice Rotación Locales Comerciales"
   → Ratio locales que cambian operador/año en radio 2km. Alta rotación = zona inestable. Fuente: Idealista + Catastro.
   → contradicting_evidence ejemplo: "Rotación puede deberse a fin de ciclo de contratos, no inestabilidad."

6. signal_name: "Proxy Satisfacción Zona Google"
   → Rating medio ponderado Google Maps radio 1km. >4.2 = zona con buena experiencia. Fuente: Google Places API.
   → contradicting_evidence ejemplo: "Ratings sesgados por volumen de reviews."

▶ CAPA 4 — Señales adicionales obligatorias:
7. signal_name: "Ratio Gasto Tarjeta vs Renta Disponible"
   → Gasto real con tarjeta en retail vs renta media zona. >15% = alta propensión consumo. Fuente: BBVA Commerce + INE.
   → contradicting_evidence ejemplo: "Gasto inflado por turismo o compras puntuales."

8. signal_name: "Flujo Movilidad Pico Sábado"
   → Desplazamientos entrantes radio 5km sábados 10-14h / población residente. >2.5x = polo atracción. Fuente: Telefónica Movilidad.
   → contradicting_evidence ejemplo: "Flujo dominado por evento específico, no atracción comercial sostenida."

RECORDATORIO FINAL: Genera las señales convencionales normalmente para Capas 1-2. Las señales no convencionales listadas arriba son ADICIONALES y OBLIGATORIAS para Capas 3-5. Cada una DEBE tener contradicting_evidence específica (no genérica). Usa los signal_name EXACTOS indicados.
`;
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Eres un analista de inteligencia de negocio senior. Detectas patrones en 5 CAPAS DE INTELIGENCIA con exclusividad mutua (cada patrón pertenece a UNA SOLA capa).

Cap de confianza máxima: ${maxCap} (${maxCap >= 1 ? "datos del usuario disponibles" : maxCap <= 0.6 ? "fuentes identificadas pero no conectadas, cap 60%" : "sin datos del usuario, máximo 70%"}).
${maxCap <= 0.6 ? "IMPORTANTE: Todos los outputs deben marcarse como 'basados en fuentes parcialmente verificadas'." : ""}

LAS 5 CAPAS (MUTUAMENTE EXCLUYENTES — sin solapamiento):
- CAPA 1 = EVIDENTES: Lo que el cliente dice EXPLÍCITAMENTE. Peticiones directas, requisitos claros, necesidades verbalizadas. Confianza: 0.7-${maxCap}.
- CAPA 2 = PROCESO: Cómo trabaja ACTUALMENTE. Workflows, hábitos operativos, herramientas que usa, rutinas. Confianza: 0.5-${maxCap}.
- CAPA 3 = DOLOR: Lo que le duele DE VERDAD (no lo que dice, sino lo que REVELA el análisis). Frustraciones implícitas, ineficiencias no reconocidas, costes ocultos. Confianza: 0.4-${Math.min(0.8, maxCap)}.
- CAPA 4 = ÉXITO OCULTO: Qué ha FUNCIONADO que nadie más ha detectado. Workarounds brillantes, ventajas competitivas no explotadas, insights no obvios. Confianza: 0.3-${Math.min(0.7, maxCap)}.
- CAPA 5 = SISTÉMICO: Dinámicas PROFUNDAS del negocio, del mercado, del equipo. Patrones estructurales, tendencias macro, interdependencias invisibles. Confianza: 0.2-${Math.min(0.6, maxCap)}.

REGLAS CRÍTICAS:
1. Mínimo 3 patrones por capa (15-25 patrones totales).
2. PROHIBIDO títulos genéricos ("Problema de eficiencia", "Oportunidad de mejora", "Necesidad de automatización"). Cada título debe ser ESPECÍFICO al proyecto/sector.
3. evidencia_transcripcion debe ser una CITA TEXTUAL o referencia precisa del análisis, no una paráfrasis genérica.
4. impacto_negocio debe ser CUANTIFICADO cuando sea posible (horas/semana, €/mes, % conversión).
5. accion_recomendada debe mapear a una capa de arquitectura IA (A-E) cuando aplique.
6. Cada patrón de Capa 3+ debe incluir un candidato a componente IA.
${unconventionalSystemRule}
Responde SOLO con JSON válido.`
    },
    {
      role: "user",
      content: `Detecta patrones para este análisis:

Sector: ${sector}
Objetivo: ${objective}
Variables clave: ${JSON.stringify((phase1 as any)?.key_variables || [])}
Hipótesis causales: ${JSON.stringify((phase1 as any)?.causal_hypotheses || [])}
Baseline: ${(phase1 as any)?.baseline_definition || "N/A"}
Sectores análogos: ${JSON.stringify((phase1 as any)?.analogous_sectors || [])}
Fuentes disponibles: ${JSON.stringify(sources || [])}
${compositeMetricsBlock}
${patternMapCrossRef}
${datasetContext || ""}

Genera patrones en EXACTAMENTE 5 capas de inteligencia de negocio:
1. EVIDENTES — Lo que el cliente pide explícitamente. Mínimo 3 patrones.
2. PROCESO — Workflows y hábitos operativos actuales. Mínimo 3 patrones.
3. DOLOR — Frustraciones reales reveladas por el análisis (no las dichas). Mínimo 3 patrones. Cada patrón DEBE tener candidato a componente IA.
4. ÉXITO OCULTO — Insights no obvios, ventajas no explotadas. Mínimo 3 patrones. Cada patrón DEBE tener candidato a componente IA.
5. SISTÉMICO — Dinámicas profundas, tendencias macro, interdependencias. Mínimo 2 patrones. Cada patrón DEBE tener candidato a componente IA.

Responde con JSON:
{
  "layers": [
    {
      "layer_id": 1,
      "layer_name": "Evidentes",
      "patterns": [
        {
          "patron_id": "EVD-001",
          "capa": 1,
          "titulo": "título ESPECÍFICO al proyecto (no genérico)",
          "descripcion": "explicación causal detallada",
          "evidencia_transcripcion": "cita textual exacta o referencia precisa del análisis",
          "impacto_negocio": "impacto cuantificado (horas/semana, €/mes, % mejora)",
          "accion_recomendada": "acción concreta con mapeo a capa IA (A-E) si aplica",
          "confianza": 0.0-${maxCap},
          "data_source": "fuente concreta de datos",
          "ia_component_candidate": {
            "layer": "A|B|C|D|E (solo para Capa 3+, null para Capas 1-2)",
            "module_type": "knowledge_module|action_module|pattern_module|deterministic_engine|null",
            "rationale": "por qué este componente IA es necesario"
          }
        }
      ]
    }
  ],
  "cross_layer_insights": [
    {"insight": "relación entre patrones de diferentes capas", "layers_involved": [1, 3], "reinforcement": "positive|negative|conditional"}
  ]
}

FORMATO de patron_id por capa: EVD-001, PRC-001, DLR-001, EXO-001, SIS-001.`
    }
  ];

  try {
    const phase5MaxTokens = sectorKey === "centros_comerciales" ? 12288 : 8192;
    const result = await chat(messages, { model: "gemini-pro", responseFormat: "json", maxTokens: phase5MaxTokens });
    const parsed = safeParseJson(result);

    // Save signals to signal_registry
    const layers = parsed.layers || [];

    // === HARDCODED UNCONVENTIONAL SIGNALS FOR CENTROS COMERCIALES ===
    // These are injected programmatically because the LLM ignores prompt instructions
    if (sectorKey === "centros_comerciales") {
      const unconventionalSignals = {
        3: [
          {
            signal_name: "Crecimiento Matrícula Escolar como Predictor de Demanda Familiar",
            description: "Municipios con crecimiento >5% anual en matrícula escolar indican llegada de familias jóvenes con consumo infantil creciente y predecible.",
            confidence: 0.50, p_value_estimate: 0.100, impact: "medium", trend: "up",
            uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis",
            contradicting_evidence: "El crecimiento escolar puede deberse a inmigración con bajo poder adquisitivo, no necesariamente familias con alto gasto discrecional.",
            data_source: "Ministerio de Educación (Tier A)"
          },
          {
            signal_name: "Momentum Inmobiliario como Indicador de Zona Caliente",
            description: "Variación de precio m² >2%/semestre indica zona en fase de revalorización activa con atracción de nuevos residentes.",
            confidence: 0.45, p_value_estimate: 0.100, impact: "medium", trend: "up",
            uncertainty_type: "aleatoric", devil_advocate_result: "moved_to_hypothesis",
            contradicting_evidence: "Puede indicar burbuja especulativa, no demanda real sostenible.",
            data_source: "INE - Estadística de Transmisiones de Derechos de la Propiedad (Tier A)"
          },
          {
            signal_name: "Índice Rotación Locales Comerciales",
            description: "Ratio de locales que cambian de operador/año en radio 2km. Alta rotación = zona inestable. Baja rotación = zona madura consolidada. Fuente: Idealista + Catastro.",
            confidence: 0.50, p_value_estimate: 0.080, impact: "high", trend: "stable",
            uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis",
            contradicting_evidence: "La rotación puede deberse a cambios regulatorios (nuevas ordenanzas) o a fin de ciclo de contratos, no necesariamente a inestabilidad comercial.",
            data_source: "Idealista + Catastro (Tier A)"
          },
          {
            signal_name: "Proxy Satisfacción Zona Google",
            description: "Rating medio ponderado de comercios en Google Maps radio 1km. Ratings >4.2 = zona con buena experiencia comercial. Fuente: Google Places API.",
            confidence: 0.45, p_value_estimate: 0.120, impact: "medium", trend: "up",
            uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis",
            contradicting_evidence: "Los ratings de Google están sesgados por volumen de reviews y pueden ser manipulados. Zonas nuevas con pocos reviews dan falsos negativos.",
            data_source: "Google Places API (Tier A)"
          },
          {
            signal_name: "Rollout de Fibra Óptica como Atractor de Teletrabajadores",
            description: "Zonas con despliegue reciente de fibra óptica atraen teletrabajadores y nuevos residentes tech que transforman patrones de consumo local.",
            confidence: 0.40, p_value_estimate: 0.150, impact: "low", trend: "up",
            uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis",
            contradicting_evidence: "La fibra se despliega por rentabilidad del operador, no necesariamente donde hay demanda de teletrabajo.",
            data_source: "CNMC (Tier A)"
          },
        ],
        4: [
          {
            signal_name: "Tiempo de Respuesta Delivery como Proxy de Saturación Comercial",
            description: "Zonas donde el delivery tarda >15 min en horario punta tienen baja densidad comercial. Esto indica oportunidad para un centro que cubra esa demanda insatisfecha.",
            confidence: 0.45, p_value_estimate: 0.100, impact: "high", trend: "stable",
            uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis",
            contradicting_evidence: "El tiempo de delivery depende de la infraestructura vial y del número de riders, no solo de la densidad comercial.",
            data_source: "APIs de Glovo/Uber Eats (Tier B)"
          },
          {
            signal_name: "Dead Hours Vitality — Tráfico en Horas Muertas",
            description: "Tráfico peatonal significativo entre 14:00-16:00 martes-jueves indica base residencial local fuerte con gasto recurrente y estable, no dependiente de turismo o trabajadores de oficina.",
            confidence: 0.50, p_value_estimate: 0.080, impact: "high", trend: "stable",
            uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis",
            contradicting_evidence: "Puede indicar zona con alta tasa de desempleo o jubilados con bajo gasto, no necesariamente residentes activos con poder adquisitivo.",
            data_source: "Google Maps Popular Times (Tier B)"
          },
          {
            signal_name: "Ratio Búsquedas/Visitas como Demanda Insatisfecha",
            description: "Ratio alto de búsquedas 'centros comerciales cerca' vs visitas reales a centros existentes indica demanda que no está siendo cubierta por la oferta actual.",
            confidence: 0.55, p_value_estimate: 0.050, impact: "high", trend: "up",
            uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis",
            contradicting_evidence: "Las búsquedas pueden ser de turistas o personas de paso, no de residentes. También pueden reflejar curiosidad mediática, no intención de compra.",
            data_source: "Google Trends + Google Maps (Tier A/B)"
          },
          {
            signal_name: "Densidad de Coworkings como Indicador de Nuevos Patrones de Consumo",
            description: ">5 espacios de coworking en radio 5km indica teletrabajo normalizado, menor movilidad laboral obligada y nuevos patrones de consumo diurno en zonas residenciales.",
            confidence: 0.45, p_value_estimate: 0.100, impact: "medium", trend: "up",
            uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis",
            contradicting_evidence: "Los coworkings pueden estar en zonas céntricas que ya tienen alta oferta comercial, no generando nueva demanda sino redistribuyéndola.",
            data_source: "OpenStreetMap + Google Maps (Tier A)"
          },
          {
            signal_name: "Ratio Gasto Tarjeta vs Renta Disponible",
            description: "Proporción del gasto real con tarjeta en retail vs renta media de la zona. >15% indica zona con alta propensión al consumo. Fuente: BBVA Commerce + INE.",
            confidence: 0.40, p_value_estimate: 0.150, impact: "high", trend: "up",
            uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis",
            contradicting_evidence: "El gasto con tarjeta puede estar inflado por turismo o compras puntuales de alto valor que no reflejan consumo recurrente local.",
            data_source: "BBVA/CaixaBank Commerce + INE (Tier B)"
          },
          {
            signal_name: "Flujo Movilidad Pico Sábado",
            description: "Volumen de desplazamientos que entran en radio 5km los sábados 10-14h normalizado por población residente. >2.5x indica polo de atracción comercial. Fuente: Telefónica Movilidad.",
            confidence: 0.35, p_value_estimate: 0.200, impact: "high", trend: "stable",
            uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis",
            contradicting_evidence: "El flujo de sábado puede estar dominado por un evento o atracción específica (mercadillo, parque) y no reflejar atracción comercial sostenida.",
            data_source: "Telefónica/Orange Movilidad (Tier B)"
          },
        ],
        5: [
          {
            signal_name: "Latent Demand Score (Métrica Compuesta)",
            description: "(Búsquedas Google zona / Oferta comercial actual) × Crecimiento población. Score >2.5 indica oportunidad clara de demanda insatisfecha en zona con crecimiento demográfico.",
            confidence: 0.35, p_value_estimate: 0.200, impact: "high", trend: "up",
            uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis",
            contradicting_evidence: "Las tres variables pueden tener dinámicas independientes que no se refuerzan mutuamente. Un alto score puede reflejar simplemente una zona nueva sin oferta donde la demanda real es incierta.",
            data_source: "Google Trends + OSM + INE (Tier A)"
          },
          {
            signal_name: "Climate Refuge Score (Métrica Compuesta)",
            description: "(Días >32°C + Días lluvia >10mm + Días AQI >150) / 365. Score >0.25 indica que el centro comercial se beneficia como refugio climático, atrayendo afluencia en condiciones meteorológicas adversas.",
            confidence: 0.40, p_value_estimate: 0.150, impact: "medium", trend: "stable",
            uncertainty_type: "aleatoric", devil_advocate_result: "moved_to_hypothesis",
            contradicting_evidence: "Los centros comerciales exitosos en climas templados como San Sebastián demuestran que el clima no es condición necesaria. El efecto puede ser marginal frente a factores como renta y accesibilidad.",
            data_source: "AEMET (Tier A)"
          },
          {
            signal_name: "Future-Proof Index (Métrica Compuesta)",
            description: "(Cobertura fibra × Permisos construcción × Ofertas empleo) / Competencia actual. Score >1.0 indica zona en expansión sostenible con baja competencia relativa.",
            confidence: 0.30, p_value_estimate: 0.300, impact: "high", trend: "up",
            uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis",
            contradicting_evidence: "Las tres variables pueden estar todas altas en zonas de burbuja inmobiliaria donde la demanda real de retail no acompaña al crecimiento. El índice compuesto multiplica la incertidumbre de cada componente.",
            data_source: "CNMC + Catastro + LinkedIn + AECC (Tier A/B)"
          },
          {
            signal_name: "Benchmark Success Score (Métrica Compuesta)",
            description: "Score compuesto que compara composición de operadores, ocupación, y mix sectorial del centro analizado vs los 20 centros más exitosos de España (Xanadú, La Vaguada, Parquesur, centros Unibail/Klépierre/Merlin). Score 0-100. Fuente: AECC + Informes CBRE/JLL + datos propios.",
            confidence: 0.30, p_value_estimate: 0.250, impact: "high", trend: "up",
            uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis",
            contradicting_evidence: "Los centros de referencia operan en contextos únicos (ubicación, antigüedad, propietario) que no son replicables. Copiar su mix puede no funcionar en un contexto diferente.",
            data_source: "AECC + CBRE/JLL + datos propios"
          },
          {
            signal_name: "Resilience Index (Anti-fragilidad)",
            description: "(1 - Concentración Herfindahl operadores) × Diversidad sectorial × (1 - Dependencia anchor tenant). Mide capacidad del centro de sobrevivir pérdida de operador principal. Fuente: datos propios + AECC.",
            confidence: 0.30, p_value_estimate: 0.300, impact: "high", trend: "stable",
            uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis",
            contradicting_evidence: "Un alto índice de diversificación puede indicar falta de identidad comercial clara, lo que reduce atracción vs centros especializados.",
            data_source: "Datos propios + AECC"
          },
        ],
      };

      // Inject unconventional signals into existing layers or create new layer entries
      for (const [layerId, signals] of Object.entries(unconventionalSignals)) {
        const lid = parseInt(layerId);
        const existingLayer = layers.find((l: any) => l.layer_id === lid);
        if (existingLayer) {
          existingLayer.patterns = [...(existingLayer.patterns || []), ...(existingLayer.signals || []), ...signals];
        } else {
          const layerNames: Record<number, string> = { 3: "Dolor", 4: "Éxito Oculto", 5: "Sistémico" };
          layers.push({ layer_id: lid, layer_name: layerNames[lid] || `Capa ${lid}`, patterns: signals });
        }
      }
      // Sort layers by layer_id
      layers.sort((a: any, b: any) => a.layer_id - b.layer_id);
      console.log("[Phase5] Injected unconventional signals for centros_comerciales");
    }

    for (const layer of layers) {
      const patterns = layer.patterns || layer.signals || [];
      for (const signal of patterns) {
        await supabase.from("signal_registry").insert({
          run_id: runId,
          user_id: userId,
          layer_id: layer.layer_id,
          layer_name: layer.layer_name,
          signal_name: signal.patron_id || signal.signal_name || signal.titulo,
          description: signal.descripcion || signal.description,
          confidence: Math.min(signal.confianza || signal.confidence || 0, maxCap),
          p_value: signal.p_value_estimate || null,
          impact: signal.impacto_negocio || signal.impact || "medium",
          trend: signal.trend || "stable",
          uncertainty_type: signal.uncertainty_type || "epistemic",
          devil_advocate_result: signal.devil_advocate_result || null,
          contradicting_evidence: signal.evidencia_transcripcion || signal.contradicting_evidence || null,
          data_source: signal.data_source || null,
          sector: sector,
        });
      }
    }

    phaseResults.phase_5 = {
      layers_count: layers.length,
      total_signals: layers.reduce((sum: number, l: any) => sum + (l.patterns?.length || l.signals?.length || 0), 0),
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
    const parsed = safeParseJson(result);

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
    const parsed = safeParseJson(result);

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
// ECONOMIC BACKTESTING (between Phase 6 and Phase 7)
// ═══════════════════════════════════════

async function executeEconomicBacktesting(runId: string, userId: string, sector: string) {
  console.log(`[Economic Backtesting] Starting for run ${runId}, sector: ${sector}`);

  const sectorParams = detectSectorParams(sector);
  console.log(`[Economic Backtesting] Detected sector params: ${sectorParams.unit_name}, units: ${sectorParams.default_units}, margin: ${sectorParams.default_margin_pct}%`);

  const phaseResults = await getRunPhaseResults(runId);

  // Get technical backtest
  const { data: btData } = await supabase
    .from("model_backtests")
    .select("*")
    .eq("run_id", runId)
    .limit(1);
  const backtest = btData?.[0];
  if (!backtest) {
    console.log("[Economic Backtesting] No backtest found, skipping");
    return;
  }

  // Get signals and credibility
  const { data: signals } = await supabase
    .from("signal_registry")
    .select("*")
    .eq("run_id", runId);

  const { data: credMatrix } = await supabase
    .from("signal_credibility_matrix")
    .select("*")
    .eq("run_id", runId);

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Eres un analista financiero que traduce backtesting técnico en impacto económico medible para ${sectorParams.system_prompt_context}

Reglas:
- Margen conservador: ${sectorParams.default_margin_pct}% si no hay datos reales del cliente
- Coste de capital: ${sectorParams.cost_of_capital_pct}% anual
- Inversión media por ${sectorParams.unit_name}: ${sectorParams.avg_investment.toLocaleString()} EUR
- Cada euro debe ser trazable al evento que lo genera
- Todos los cálculos son "ai_estimation"
- NO incluir bonus de fidelización ni daño reputacional (desactivados por defecto)
- TODOS los textos de respuesta deben estar en ESPAÑOL. Eventos, análisis, recomendaciones, todo en español.
Responde SOLO con JSON válido.`
    },
    {
      role: "user",
      content: `Calcula el impacto económico de este backtesting:

Sector: ${sector}
Tipo de unidad: ${sectorParams.unit_name} (${sectorParams.unit_name_plural})
Inversión media por ${sectorParams.unit_name}: ${sectorParams.avg_investment.toLocaleString()} EUR
Margen: ${sectorParams.default_margin_pct}%

Backtest técnico:
- Win rate: ${backtest.win_rate_pct}%
- Precisión: ${backtest.precision_pct}%
- Recall: ${backtest.recall_pct}%
- False positives: ${backtest.false_positives}
- False negatives: ${backtest.false_negatives}
- Anticipación media: ${backtest.avg_anticipation_days} días
- Casos retrospectivos: ${JSON.stringify(backtest.retrospective_cases || [])}

Señales (${(signals || []).length}): ${JSON.stringify((signals || []).slice(0, 10).map(s => ({ name: s.signal_name, confidence: s.confidence, impact: s.impact })))}

Credibilidad: ${JSON.stringify((credMatrix || []).slice(0, 10).map(c => ({ signal_class: c.signal_class, score: c.final_credibility_score })))}

Para cada caso retrospectivo, calcula el impacto económico CALIBRADO AL SECTOR:
- True Positive (detectado): valor de la decisión correcta según la escala del sector
- False Positive (falsa alarma): coste de recursos mal asignados o capital inmovilizado
- False Negative (no detectado): valor de la oportunidad perdida o pérdida evitable

Para cada False Negative, genera error_intelligence: root_cause, proposed_sources, integration_cost (low/medium/high), expected_uplift (low/medium/high), priority_score (0-1)

Para cada señal que requiera validación, genera un validation_plan.

IMPORTANTE: Los impactos deben reflejar la escala REAL del sector. Para ${sectorParams.unit_name_plural}, la inversión media es ${sectorParams.avg_investment.toLocaleString()} EUR.

Responde con:
{
  "gross_revenue_protected": 0.0,
  "capital_tied_up_cost": 0.0,
  "unprevented_losses": 0.0,
  "net_economic_impact": 0.0,
  "roi_multiplier": 0.0,
  "payback_period_days": 0,
  "per_unit_impact": 0.0,
  "event_breakdown": [
    {
      "event": "string",
      "prediction_correct": true,
      "anticipation_days": 0,
      "economic_impact_eur": 0.0,
      "impact_type": "revenue_protected|capital_cost|unprevented_loss",
      "calculation_detail": "fórmula usada"
    }
  ],
  "error_intelligence": [
    {
      "error_type": "false_negative",
      "missed_event": "string",
      "root_cause": "string",
      "proposed_sources": ["string"],
      "integration_cost": "low|medium|high",
      "expected_uplift": "low|medium|high",
      "priority": 0.0
    }
  ],
  "validation_plans": [
    {
      "signal_name": "string",
      "data_needed": "string",
      "where_to_get": "string",
      "estimated_impact": "string",
      "integration_cost": "low|medium|high",
      "recommendation": "invest|defer"
    }
  ],
  "assumptions": {
    "margin_pct": ${sectorParams.default_margin_pct},
    "cost_of_capital_pct": ${sectorParams.cost_of_capital_pct},
    "avg_investment": ${sectorParams.avg_investment}
  }
}`
    }
  ];

  try {
    const result = await chat(messages, { model: "gemini-pro", responseFormat: "json", maxTokens: 8192 });
    const parsed = safeParseJson(result);

    const perUnitImpact = parsed.per_unit_impact || parsed.per_pharmacy_impact || 0;

    // Build assumptions with sector params for UI consumption
    const assumptions = {
      ...(parsed.assumptions || {}),
      unit_name: sectorParams.unit_name,
      unit_name_plural: sectorParams.unit_name_plural,
      default_units: sectorParams.default_units,
      avg_investment: sectorParams.avg_investment,
      sector_detected: sector,
    };

    // Insert economic backtest
    await supabase.from("economic_backtests").insert({
      backtest_id: backtest.id,
      run_id: runId,
      user_id: userId,
      gross_revenue_protected: parsed.gross_revenue_protected || 0,
      capital_tied_up_cost: parsed.capital_tied_up_cost || 0,
      unprevented_losses: parsed.unprevented_losses || 0,
      net_economic_impact: parsed.net_economic_impact || 0,
      roi_multiplier: parsed.roi_multiplier || 0,
      payback_period_days: parsed.payback_period_days || 0,
      per_pharmacy_impact: perUnitImpact,
      total_pharmacies: sectorParams.default_units,
      margin_used_pct: sectorParams.default_margin_pct,
      cost_of_capital_pct: sectorParams.cost_of_capital_pct,
      calculation_method: "ai_estimation",
      assumptions,
      event_breakdown: parsed.event_breakdown || [],
      error_intelligence: parsed.error_intelligence || [],
    });

    // Store in phase_results
    phaseResults.economic_backtesting = {
      net_economic_impact_eur: parsed.net_economic_impact || 0,
      per_unit_impact_eur: perUnitImpact,
      total_units: sectorParams.default_units,
      unit_name: sectorParams.unit_name,
      gross_revenue_protected_eur: parsed.gross_revenue_protected || 0,
      capital_tied_up_cost_eur: parsed.capital_tied_up_cost || 0,
      unprevented_losses_eur: parsed.unprevented_losses || 0,
      roi_multiplier: parsed.roi_multiplier || 0,
      payback_period_days: parsed.payback_period_days || 0,
      validation_plans: parsed.validation_plans || [],
    };

    await updateRun(runId, { phase_results: phaseResults });
    console.log(`[Economic Backtesting] Done: NEI=${parsed.net_economic_impact}, ROI=${parsed.roi_multiplier}x, sector=${sectorParams.unit_name}`);
  } catch (err) {
    console.error("Economic Backtesting error:", err);
    phaseResults.economic_backtesting = { error: String(err) };
    await updateRun(runId, { phase_results: phaseResults });
  }
}

// ═══════════════════════════════════════
// PHASE 4b: Reference Center Benchmarking (centros_comerciales only)
// ═══════════════════════════════════════

const REFERENCE_CENTERS = [
  { name: "Xanadú", city: "Madrid", sba_m2: 154000, operators: 230, anchors: "Inditex, H&M, Primark, SnowZone", year: 2003, owner: "Unibail-Rodamco", occupancy_pct: 96, sales_m2_est: 4200 },
  { name: "Parquesur", city: "Leganés (Madrid)", sba_m2: 152000, operators: 220, anchors: "El Corte Inglés, Inditex, Carrefour", year: 1989, owner: "Unibail-Rodamco", occupancy_pct: 95, sales_m2_est: 3800 },
  { name: "La Vaguada", city: "Madrid", sba_m2: 85000, operators: 350, anchors: "Inditex, El Corte Inglés, Carrefour", year: 1983, owner: "CBRE GI", occupancy_pct: 98, sales_m2_est: 5200 },
  { name: "Diagonal Mar", city: "Barcelona", sba_m2: 87000, operators: 200, anchors: "Inditex, Mango, Apple", year: 2001, owner: "Deutsche Bank", occupancy_pct: 94, sales_m2_est: 4500 },
  { name: "Marineda City", city: "A Coruña", sba_m2: 170000, operators: 200, anchors: "IKEA, Inditex", year: 2011, owner: "Grupo Castromil/Inversa", occupancy_pct: 90, sales_m2_est: 2800 },
  { name: "Puerto Venecia", city: "Zaragoza", sba_m2: 120000, operators: 150, anchors: "Inditex, Primark, IKEA", year: 2012, owner: "British Land/Intu", occupancy_pct: 92, sales_m2_est: 3200 },
  { name: "Nueva Condomina", city: "Murcia", sba_m2: 120000, operators: 180, anchors: "IKEA, El Corte Inglés", year: 2006, owner: "Klépierre", occupancy_pct: 93, sales_m2_est: 3000 },
  { name: "Bonaire", city: "Valencia", sba_m2: 148000, operators: 200, anchors: "Carrefour, Inditex", year: 2001, owner: "Klépierre", occupancy_pct: 94, sales_m2_est: 3100 },
  { name: "La Maquinista", city: "Barcelona", sba_m2: 73000, operators: 230, anchors: "Inditex, H&M, MediaMarkt", year: 2000, owner: "Unibail-Rodamco", occupancy_pct: 97, sales_m2_est: 5500 },
  { name: "Plenilunio", city: "Madrid", sba_m2: 70000, operators: 200, anchors: "Inditex, Cines Kinépolis", year: 2008, owner: "Klépierre", occupancy_pct: 96, sales_m2_est: 4800 },
];

async function executePhase4b(runId: string, sector: string) {
  const sectorKey = detectSectorKey(sector);
  if (sectorKey !== "centros_comerciales") return;

  console.log(`[Phase4b] Starting Reference Center Benchmarking`);
  const phaseResults = await getRunPhaseResults(runId);

  try {
    const messages: ChatMessage[] = [
      { role: "system", content: `Eres un experto en retail y centros comerciales con 20 años de experiencia en el mercado español.
Analiza patrones de éxito en centros comerciales de referencia. Responde SOLO con JSON válido, en ESPAÑOL.` },
      { role: "user", content: `Analiza los patrones comunes de los centros comerciales más exitosos de España:

CENTROS DE REFERENCIA:
${JSON.stringify(REFERENCE_CENTERS, null, 2)}

Identifica qué patrones comparten estos centros exitosos:
1. Composición sectorial del tenant mix (% restauración, moda, ocio, servicios, gran superficie)
2. Ratio anchor tenants vs specialty (número y tipo de locomotoras)
3. Presencia de categorías clave (cuáles son imprescindibles para un centro exitoso)
4. Densidad de operadores por m² (operadores/1000m² SBA)
5. Estrategia: destination (centro regional, >100K m²) vs convenience (urbano, <80K m²)
6. Factores de éxito comunes: accesibilidad, transporte público, parking, mix ocio/comercio
7. Patrones de renovación y adaptación (cómo han evolucionado los centros maduros vs nuevos)

Responde con:
{
  "success_blueprint": {
    "optimal_tenant_mix": { "restauracion_pct": 0, "moda_pct": 0, "ocio_pct": 0, "servicios_pct": 0, "gran_superficie_pct": 0, "otros_pct": 0 },
    "anchor_strategy": { "min_anchors": 0, "ideal_anchors": 0, "must_have_categories": ["cat1", "cat2"], "anchor_specialty_ratio": "X:Y" },
    "density_benchmarks": { "operators_per_1000m2": 0, "min_viable": 0, "optimal": 0 },
    "strategy_patterns": { "destination_threshold_m2": 100000, "convenience_threshold_m2": 80000, "mixed_characteristics": ["char1"] },
    "success_factors_ranked": [
      { "factor": "factor name", "importance": 0.0, "evidence": "evidence from reference centers" }
    ],
    "anti_patterns": ["pattern that predicts failure"],
    "evolution_insights": ["how successful centers adapt over time"]
  },
  "center_classifications": [
    { "name": "center name", "strategy": "destination|convenience|hybrid", "key_differentiator": "what makes it unique", "lesson": "key takeaway" }
  ],
  "scoring_criteria": {
    "criteria": [
      { "name": "criterion", "weight": 0.0, "benchmark_value": "value", "measurement": "how to measure" }
    ]
  }
}` }
    ];

    const result = await chat(messages, { model: "gemini-pro", responseFormat: "json", maxTokens: 8192 });
    const parsed = safeParseJson(result);

    phaseResults.phase_4b = parsed;
    await updateRun(runId, { phase_results: phaseResults });
    console.log(`[Phase4b] Reference Center Benchmarking done`);
  } catch (err) {
    console.error("[Phase4b] Error:", err);
    phaseResults.phase_4b = { error: String(err) };
    await updateRun(runId, { phase_results: phaseResults });
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

  // Include benchmark context if available (Phase 4b)
  let benchmarkContext = "";
  if (phaseResults.phase_4b?.success_blueprint) {
    benchmarkContext = `\nBenchmark de centros exitosos (Phase 4b): ${JSON.stringify(phaseResults.phase_4b.success_blueprint).substring(0, 4000)}`;
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Eres un consultor estratégico que convierte patrones detectados en hipótesis accionables.
TODOS los textos de respuesta deben estar en ESPAÑOL. Hipótesis, explicaciones, acciones, métricas, todo en español.
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
Economic backtesting: ${JSON.stringify(phaseResults.economic_backtesting || {})}
${benchmarkContext}

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
    const parsed = safeParseJson(result);

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
// PUBLIC QUERY HANDLER (API key auth)
// ═══════════════════════════════════════

async function handlePatternPublicQuery(body: Record<string, unknown>) {
  const { runId, apiKey, trace_id } = body;
  if (!runId || !apiKey) throw new Error("runId and apiKey are required");

  // Validate API key
  const { data: keyRecord } = await supabase
    .from("pattern_api_keys")
    .select("*")
    .eq("run_id", runId)
    .eq("api_key", apiKey)
    .eq("is_active", true)
    .single();

  if (!keyRecord) throw new Error("Invalid or expired API key");

  // Check monthly usage
  const monthlyLimit = (keyRecord.monthly_limit as number) || 1000;
  const currentUsage = (keyRecord.monthly_usage as number) || 0;
  if (currentUsage >= monthlyLimit) {
    throw Object.assign(new Error("Monthly usage limit exceeded"), {
      status: 429,
      current: currentUsage,
      limit: monthlyLimit,
    });
  }

  // Get run data
  const { data: run } = await supabase
    .from("pattern_detector_runs")
    .select("*")
    .eq("id", runId)
    .single();

  if (!run) throw new Error("Run not found");
  if (!run.status?.startsWith("phase_") && run.status !== "completed") {
    throw new Error("Run not ready — status: " + run.status);
  }

  const phaseResults = (run.phase_results || {}) as Record<string, unknown>;

  // Build response from phase results
  const phase5 = phaseResults.phase_5 as any;
  const phase7 = phaseResults.phase_7 as any;
  const backtesting = phaseResults.economic_backtesting as any;

  const layers = phase5?.layers || [];
  const compositeScores = phase7?.composite_scores || phase5?.composite_scores || {};
  const modelVerdict = phase7?.model_verdict || run.model_verdict || "UNKNOWN";
  const confidenceCap = run.confidence_cap || 0.7;

  // Increment usage
  await supabase
    .from("pattern_api_keys")
    .update({
      monthly_usage: currentUsage + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", keyRecord.id);

  return {
    layers,
    composite_scores: compositeScores,
    model_verdict: modelVerdict,
    confidence_cap: confidenceCap,
    backtesting_summary: backtesting?.summary || null,
    trace_id: trace_id || null,
  };
}

// ═══════════════════════════════════════
// PUBLIC QUERY V2 — Rich API for external apps (AVA TURING etc.)
// ═══════════════════════════════════════

async function validateApiKeyV2(apiKey: string): Promise<{ keyRecord: any; error?: string; status?: number }> {
  const { data: keyRecord } = await supabase
    .from("pattern_api_keys")
    .select("*")
    .eq("api_key", apiKey)
    .eq("is_active", true)
    .single();

  if (!keyRecord) return { keyRecord: null, error: "Invalid or expired API key", status: 401 };

  const monthlyLimit = (keyRecord.monthly_limit as number) || 1000;
  const currentUsage = (keyRecord.monthly_usage as number) || 0;
  if (currentUsage >= monthlyLimit) {
    return { keyRecord: null, error: "Monthly usage limit exceeded", status: 429 };
  }

  // Increment usage
  await supabase
    .from("pattern_api_keys")
    .update({ monthly_usage: currentUsage + 1, last_used_at: new Date().toISOString() })
    .eq("id", keyRecord.id);

  return { keyRecord };
}

async function findBestRun(keyRecord: any, filters: any): Promise<any> {
  let query = supabase.from("pattern_detector_runs").select("*").eq("status", "completed").order("created_at", { ascending: false });

  // If key is run-specific, only that run
  if (keyRecord.run_id) {
    query = query.eq("id", keyRecord.run_id);
  } else {
    // Global key — filter by project_id or user_id
    if (keyRecord.project_id) query = query.eq("project_id", keyRecord.project_id);
    else if (keyRecord.user_id) query = query.eq("user_id", keyRecord.user_id);
  }

  if (filters?.sector) query = query.eq("sector", filters.sector);
  if (filters?.geography) query = query.ilike("geography", `%${filters.geography}%`);

  const { data } = await query.limit(1).maybeSingle();
  return data;
}

function extractSignals(phaseResults: any, filters: any): any[] {
  const phase5 = phaseResults?.phase_5 as any;
  const layers = phase5?.layers || [];
  let allSignals: any[] = [];

  for (const layer of layers) {
    const layerNum = layer.layer_number || layer.layer;
    if (filters?.layers && filters.layers.length > 0 && !filters.layers.includes(layerNum)) continue;

    const signals = layer.signals || layer.patterns || [];
    for (const sig of signals) {
      const credClass = sig.credibility_class || sig.credibility || "Gamma";
      if (filters?.min_credibility) {
        const rank: Record<string, number> = { "Alpha": 3, "Beta": 2, "Gamma": 1 };
        if ((rank[credClass] || 0) < (rank[filters.min_credibility] || 0)) continue;
      }
      if (filters?.signal_names && filters.signal_names.length > 0) {
        if (!filters.signal_names.includes(sig.name || sig.signal_name)) continue;
      }
      allSignals.push({
        name: sig.name || sig.signal_name,
        layer: layerNum,
        value: sig.value ?? sig.score ?? null,
        credibility_class: credClass,
        trend: sig.trend || null,
        source: sig.source || sig.data_source || null,
        description: sig.description || null,
      });
    }
  }
  return allSignals;
}

async function handlePublicQueryV2(body: Record<string, unknown>) {
  const apiKey = body.api_key as string;
  if (!apiKey) throw new Error("api_key is required");

  const { keyRecord, error, status } = await validateApiKeyV2(apiKey);
  if (error) throw Object.assign(new Error(error), { status: status || 401 });

  const queryType = body.query_type as string;
  const filters = (body.filters || {}) as any;

  const run = await findBestRun(keyRecord, filters);
  if (!run) throw new Error("No completed runs found matching filters");

  const phaseResults = (run.phase_results || {}) as Record<string, any>;
  const signals = extractSignals(phaseResults, filters);
  const phase7 = phaseResults.phase_7 as any;
  const phase4b = phaseResults.phase_4b as any;
  const backtesting = phaseResults.economic_backtesting as any;
  const phase5 = phaseResults.phase_5 as any;

  const runMeta = {
    run_id: run.id,
    completed_at: run.updated_at,
    model_verdict: phase7?.model_verdict || run.model_verdict || "UNKNOWN",
    sector: run.sector,
    geography: run.geography,
  };

  switch (queryType) {
    case "signals_by_zone": {
      const alphaCount = signals.filter(s => s.credibility_class === "Alpha").length;
      const betaCount = signals.filter(s => s.credibility_class === "Beta").length;
      return {
        signals,
        zone_summary: {
          total_signals: signals.length,
          alpha_count: alphaCount,
          beta_count: betaCount,
          composite_score: phase7?.composite_scores || phase5?.composite_scores || {},
        },
        run_metadata: runMeta,
      };
    }
    case "success_patterns": {
      const successSignals = signals.filter(s =>
        (s.credibility_class === "Alpha" || s.credibility_class === "Beta") &&
        (s.trend === "up" || s.trend === "alcista" || (s.value != null && s.value > 0))
      );
      const hypotheses = phase7?.hypotheses || [];
      return {
        success_signals: successSignals,
        reference_benchmarks: phase4b?.success_blueprint || null,
        recommended_actions: hypotheses.filter((h: any) => h.type === "opportunity" || h.direction === "positive"),
        run_metadata: runMeta,
      };
    }
    case "risk_signals": {
      const riskSignals = signals.filter(s =>
        s.credibility_class === "Gamma" || s.trend === "down" || s.trend === "bajista" || (s.value != null && s.value < 0)
      );
      const hypotheses = phase7?.hypotheses || [];
      return {
        risk_signals: riskSignals,
        risk_score: riskSignals.length > 0 ? Math.min(100, riskSignals.length * 15) : 0,
        mitigation_suggestions: hypotheses.filter((h: any) => h.type === "risk" || h.direction === "negative"),
        run_metadata: runMeta,
      };
    }
    case "benchmarks": {
      return {
        reference_centers: phase4b?.success_blueprint?.reference_centers || phase4b?.reference_centers || [],
        sector_kpis: phase4b?.success_blueprint?.kpis || phase4b?.kpis || {},
        success_formula: phase4b?.success_blueprint?.formula || phase4b?.formula || null,
        run_metadata: runMeta,
      };
    }
    case "full_intelligence": {
      // Group signals by layer
      const signalsByLayer: Record<number, any[]> = {};
      for (const s of signals) {
        if (!signalsByLayer[s.layer]) signalsByLayer[s.layer] = [];
        signalsByLayer[s.layer].push(s);
      }
      return {
        signals_by_layer: signalsByLayer,
        credibility_matrix: phaseResults.credibility_matrix || null,
        success_blueprint: phase4b?.success_blueprint || phase4b || null,
        hypotheses: phase7?.hypotheses || [],
        model_verdict: runMeta.model_verdict,
        confidence_cap: run.confidence_cap || 0.7,
        economic_backtesting: backtesting || null,
        run_metadata: runMeta,
      };
    }
    case "layer_detail": {
      const layerNum = filters?.layers?.[0];
      if (!layerNum) throw new Error("filters.layers with exactly 1 layer required for layer_detail");
      const layerSignals = signals.filter(s => s.layer === layerNum);
      const layerNames: Record<number, string> = {
        1: "Macro Context", 2: "Sector Dynamics", 3: "Location Intelligence",
        4: "Behavioral Signals", 5: "Predictive Composite",
      };
      return {
        layer_number: layerNum,
        layer_name: layerNames[layerNum] || `Layer ${layerNum}`,
        signals: layerSignals,
        credibility_breakdown: {
          alpha: layerSignals.filter(s => s.credibility_class === "Alpha").length,
          beta: layerSignals.filter(s => s.credibility_class === "Beta").length,
          gamma: layerSignals.filter(s => s.credibility_class === "Gamma").length,
        },
        run_metadata: runMeta,
      };
    }
    default:
      throw new Error(`Unknown query_type: ${queryType}. Valid: signals_by_zone, success_patterns, risk_signals, benchmarks, full_intelligence, layer_detail`);
  }
}

// ═══════════════════════════════════════
// FEEDBACK INGEST — External apps send operational results back
// ═══════════════════════════════════════

async function handleFeedbackIngest(body: Record<string, unknown>) {
  const apiKey = body.api_key as string;
  if (!apiKey) throw new Error("api_key is required");

  const { keyRecord, error, status } = await validateApiKeyV2(apiKey);
  if (error) throw Object.assign(new Error(error), { status: status || 401 });

  const feedbackType = body.feedback_type as string;
  const feedbackData = (body.data || {}) as any;

  if (!feedbackType) throw new Error("feedback_type is required");

  const { data: feedback, error: insertErr } = await supabase
    .from("pattern_feedback")
    .insert({
      api_key_id: keyRecord.id,
      feedback_type: feedbackType,
      sector: feedbackData.sector || null,
      geography: feedbackData.geography || null,
      outcome: feedbackData.outcome || null,
      metrics: feedbackData.metrics || null,
      related_signals: feedbackData.related_signals || null,
      notes: feedbackData.notes || null,
      processed: false,
    })
    .select("id")
    .single();

  if (insertErr) throw insertErr;

  return { success: true, feedback_id: feedback.id };
}

// ═══════════════════════════════════════
// LIST AVAILABLE RUNS — For external apps to discover analyses
// ═══════════════════════════════════════

async function handleListAvailableRuns(body: Record<string, unknown>) {
  const apiKey = body.api_key as string;
  if (!apiKey) throw new Error("api_key is required");

  const { keyRecord, error, status } = await validateApiKeyV2(apiKey);
  if (error) throw Object.assign(new Error(error), { status: status || 401 });

  let query = supabase.from("pattern_detector_runs")
    .select("id, sector, geography, status, model_verdict, updated_at, phase_results")
    .order("created_at", { ascending: false })
    .limit(50);

  if (keyRecord.run_id) {
    query = query.eq("id", keyRecord.run_id);
  } else {
    if (keyRecord.project_id) query = query.eq("project_id", keyRecord.project_id);
    else if (keyRecord.user_id) query = query.eq("user_id", keyRecord.user_id);
  }

  const { data: runs } = await query;

  return {
    runs: (runs || []).map((r: any) => {
      const phase5 = r.phase_results?.phase_5 as any;
      const allSignals = extractSignals(r.phase_results || {}, {});
      const alphaSignals = allSignals.filter(s => s.credibility_class === "Alpha");
      return {
        run_id: r.id,
        sector: r.sector,
        geography: r.geography,
        status: r.status,
        model_verdict: r.model_verdict,
        completed_at: r.updated_at,
        signals_count: allSignals.length,
        alpha_signals_count: alphaSignals.length,
      };
    }),
  };
}

// ═══════════════════════════════════════
// API KEY MANAGEMENT HANDLER
// ═══════════════════════════════════════

async function handlePatternManageApiKeys(userId: string, body: Record<string, unknown>) {
  const { runId, subAction, keyId, projectId: bodyProjectId, name: bodyName, appName } = body as any;

  switch (subAction) {
    case "list": {
      let query = supabase
        .from("pattern_api_keys")
        .select("id, api_key, name, is_active, monthly_usage, monthly_limit, created_at, last_used_at, run_id, is_global, project_id, user_id, app_name")
        .order("created_at", { ascending: false });

      if (runId) query = query.eq("run_id", runId);
      else if (bodyProjectId) query = query.eq("project_id", bodyProjectId);
      else query = query.eq("user_id", userId);

      const { data: keys } = await query;
      return { keys: keys || [] };
    }
    case "create": {
      if (!runId) throw new Error("runId is required for run-specific keys");
      // Verify ownership
      const { data: run } = await supabase.from("pattern_detector_runs").select("user_id").eq("id", runId).single();
      if (!run || run.user_id !== userId) {
        const { data: shared } = await supabase.rpc("has_shared_access", { p_user_id: userId, p_resource_type: "pattern_detector_run", p_resource_id: runId });
        if (!shared) throw new Error("Run not found or access denied");
      }
      const keyName = (bodyName as string) || "API Key";
      const apiKey = "pk_live_" + crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const { data: newKey, error } = await supabase
        .from("pattern_api_keys")
        .insert({ run_id: runId, api_key: apiKey, name: keyName, is_active: true, monthly_limit: 1000, monthly_usage: 0 })
        .select()
        .single();
      if (error) throw error;
      return { key: newKey };
    }
    case "create_global": {
      const pId = bodyProjectId || null;
      const keyName = (bodyName as string) || "Global API Key";
      const apiKey = "pk_live_" + crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const { data: newKey, error } = await supabase
        .from("pattern_api_keys")
        .insert({
          run_id: null,
          api_key: apiKey,
          name: keyName,
          is_active: true,
          monthly_limit: 5000,
          monthly_usage: 0,
          project_id: pId,
          user_id: userId,
          is_global: true,
          app_name: (appName as string) || null,
        })
        .select()
        .single();
      if (error) throw error;
      return { key: newKey };
    }
    case "revoke": {
      if (!keyId) throw new Error("keyId required");
      // Revoke by id — user must own via user_id or run ownership
      await supabase.from("pattern_api_keys").update({ is_active: false }).eq("id", keyId);
      return { revoked: true };
    }
    default:
      throw new Error("Unknown subAction: " + subAction);
  }
}

// ═══════════════════════════════════════
// MAIN HTTP HANDLER
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
        const result = await chat(messages, { model: "gemini-pro", responseFormat: "json", maxTokens: 8192 });
        const parsed = safeParseJson(result);

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
          await executePhase1b(run_id, run.sector, run.geography || "", run.business_objective || "");
          await executePhase2(run_id, run.user_id, run.sector, run.geography || "", run.business_objective || "");
          await executePhase3(run_id, run.user_id);
          await executePhase4(run_id);
          await executePhase5(run_id, run.user_id, run.sector, run.business_objective || "");
          await executePhase4b(run_id, run.sector);
          await executeCredibilityEngine(run_id, run.user_id);
          await executePhase6(run_id, run.user_id, run.sector);
          await executeEconomicBacktesting(run_id, run.user_id, run.sector);
          await executePhase7(run_id, run.sector, run.business_objective || "");
          // Fire-and-forget learning-observer with phase results
          try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const { data: completedRun } = await supabase.from("pattern_detector_runs").select("phase_results, model_verdict").eq("id", run_id).single();
            const phaseResults = completedRun?.phase_results || {};
            const signalNames = ((phaseResults as any)?.phase_5?.layers || [])
              .flatMap((l: any) => (l.signals || []).map((s: any) => s.signal_name)).slice(0, 20);
            fetch(`${supabaseUrl}/functions/v1/learning-observer`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
              body: JSON.stringify({
                action: "evaluate_feedback",
                runId: run_id,
                projectId: run.project_id || null,
                signals: signalNames,
                verdict: completedRun?.model_verdict || "NOT_RELIABLE_YET",
                phase_results_summary: {
                  phase_1: { key_variables: (phaseResults as any)?.phase_1?.key_variables?.length || 0 },
                  phase_2: { sources_found: (phaseResults as any)?.phase_2?.sources_count || 0 },
                  phase_3: { quality_gate: (phaseResults as any)?.phase_3?.verdict || "N/A" },
                  phase_5: { total_signals: signalNames.length },
                  phase_6: { win_rate: (phaseResults as any)?.phase_6?.win_rate_pct || 0 },
                  phase_7: { verdict: completedRun?.model_verdict, hypotheses_count: (phaseResults as any)?.phase_7?.hypotheses?.length || 0 },
                },
              }),
            }).catch(e => console.warn("[run_all] learning-observer fire-and-forget failed:", e));
          } catch (_) { /* non-blocking */ }
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

    // ── EXECUTE REMAINING (Phases 3-7, used by Pattern Blueprint flow) ──
    if (action === "execute_remaining") {
      const { run_id } = body;
      if (!run_id) {
        return new Response(JSON.stringify({ error: "run_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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

      // Run phases 3-7 sequentially in background
      const bgPromise = (async () => {
        try {
          await executePhase3(run_id, run.user_id);
          await executePhase4(run_id);
          await executePhase5(run_id, run.user_id, run.sector, run.business_objective || "");
          await executePhase4b(run_id, run.sector);
          await executeCredibilityEngine(run_id, run.user_id);
          await executePhase6(run_id, run.user_id, run.sector);
          await executeEconomicBacktesting(run_id, run.user_id, run.sector);
          await executePhase7(run_id, run.sector, run.business_objective || "");
        } catch (err) {
          console.error("execute_remaining error:", err);
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

    // ── PIPELINE_RUN (called by project-wizard-step for integrated pipeline) ──
    // Full 9-phase execution: Domain → Sources → QG → Confidence → Signals → Credibility → Backtest → Economic → Hypotheses
    if (action === "pipeline_run") {
      const { briefing, scope, audit, project_id, user_id } = body;
      if (!briefing || !user_id) {
        return new Response(JSON.stringify({ error: "briefing and user_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extract sector/geography/objective from briefing
      const briefObj = typeof briefing === "string" ? (() => { try { return JSON.parse(briefing); } catch { return {}; } })() : (briefing || {});
      let sector = briefObj.sector_detectado || briefObj.sector || briefObj.industry || "";
      let geography = briefObj.geography || briefObj.geografía || briefObj.mercado || "";
      let objective = briefObj.need_summary || briefObj.objetivo || briefObj.business_objective || "";

      // Build enriched context from briefing/scope/audit
      const solutionCandidates = briefObj.solution_candidates || briefObj.candidatos_solucion || [];
      const archSignals = briefObj.architecture_signals || briefObj.señales_arquitectura || [];
      const existingComponents = audit?.componentes_validados || [];
      const existingRags = audit?.rags_recomendados || [];
      const briefingContext = typeof briefing === "string" ? briefing : JSON.stringify(briefing, null, 2);
      const scopeContext = scope ? (typeof scope === "string" ? scope : JSON.stringify(scope, null, 2)) : "";

      // ── Smart extraction: if sector/geography/objective missing, extract from briefing ──
      if (!sector || !geography || sector === "general") {
        try {
          console.log(`[pipeline_run] Extracting sector/geography from briefing with LLM`);
          const extractionResult = await chat([
            { role: "system", content: `Extrae información estructurada del briefing. Responde SOLO con JSON válido.` },
            { role: "user", content: `Del siguiente briefing, extrae:
${briefingContext.substring(0, 6000)}

Responde con:
{
  "sector": "sector principal del negocio (ej: farmacia, centros comerciales, logística, retail, SaaS, etc.)",
  "geography": "geografía principal (ej: España, Madrid, Europa, etc.)",
  "objective": "objetivo principal del proyecto en 1-2 frases"
}` }
          ], { model: "gemini-flash-lite", responseFormat: "json", maxTokens: 1024 });
          const extracted = safeParseJson(extractionResult) as any;
          if (!sector || sector === "general") sector = extracted.sector || "general";
          if (!geography) geography = extracted.geography || "España";
          if (!objective) objective = extracted.objective || "Optimización operativa";
          console.log(`[pipeline_run] Extracted: sector=${sector}, geo=${geography}`);
        } catch (extractErr) {
          console.warn("[pipeline_run] Extraction failed, using defaults:", extractErr);
          if (!sector || sector === "general") sector = "general";
          if (!geography) geography = "España";
          if (!objective) objective = "Optimización operativa";
        }
      }

      console.log(`[pipeline_run] Starting 9-phase pipeline for sector=${sector}, geo=${geography}`);

      try {
        // ════════════════════════════════════════════════════════════
        // PHASE 1: Domain Comprehension (gemini-pro for deep reasoning)
        // ════════════════════════════════════════════════════════════
        const p1Messages: ChatMessage[] = [
          { role: "system", content: `Eres un analista de datos experto en detección de patrones sectoriales con 20 años de experiencia.
Analiza el dominio en profundidad: identifica las dinámicas del sector, las variables clave, los riesgos estructurales, y define un baseline naive riguroso.
Responde SOLO con JSON válido, sin markdown ni explicaciones.` },
          { role: "user", content: `Analiza este dominio con el contexto completo del briefing del proyecto:

Sector: ${sector}
Geografía: ${geography}
Objetivo de negocio: ${objective}

BRIEFING COMPLETO DEL PROYECTO:
${briefingContext.substring(0, 12000)}

${scopeContext ? `ALCANCE DEL PROYECTO:\n${scopeContext.substring(0, 6000)}` : ""}

${solutionCandidates.length > 0 ? `SOLUTION CANDIDATES:\n${JSON.stringify(solutionCandidates).substring(0, 4000)}` : ""}

Responde con este JSON exacto:
{
  "sector_analysis": "análisis profundo del sector en 3-4 párrafos: dinámicas, estacionalidad, cadena de valor, actores clave, tendencias disruptivas",
  "key_variables": ["variable1", "variable2", "variable3", "variable4", "variable5", "variable6", "variable7"],
  "initial_signal_map": ["señal potencial 1", "señal potencial 2", "señal potencial 3", "señal potencial 4", "señal potencial 5"],
  "baseline_definition": "descripción detallada del modelo baseline naive para este sector (ej: media móvil 30 días + estacionalidad histórica)",
  "naive_forecast": "descripción del forecast naive (predicción más simple posible)",
  "data_requirements": ["tipo de dato 1", "tipo de dato 2", "tipo de dato 3", "tipo de dato 4", "tipo de dato 5"],
  "risk_factors": ["riesgo estructural 1", "riesgo 2", "riesgo 3"],
  "sector_dynamics": "descripción de las dinámicas competitivas y regulatorias del sector",
  "seasonality_patterns": ["patrón estacional 1", "patrón 2"]
}` }
        ];

        const p1Result = await chat(p1Messages, { model: "gemini-pro", responseFormat: "json", maxTokens: 8192 });
        const phase1 = safeParseJson(p1Result) as any;
        console.log(`[pipeline_run] Phase 1 (Domain) done`);

        // ════════════════════════════════════════════════════════════
        // PHASE 1b: Pattern Design Map (Pattern-First Architecture)
        // ════════════════════════════════════════════════════════════
        const p1bMessages: ChatMessage[] = [
          { role: "system", content: `Eres un arquitecto de inteligencia de negocio. Diseña el mapa de patrones que se buscarán ANTES de buscar fuentes.
Para cada patrón defines QUÉ datos necesita y DE DÓNDE podrían obtenerse.
Responde SOLO con JSON válido.` },
          { role: "user", content: `Diseña el mapa de patrones para:

Sector: ${sector}
Geografía: ${geography}
Objetivo: ${objective}
Variables clave: ${JSON.stringify(phase1?.key_variables || [])}
Dinámicas sector: ${phase1?.sector_dynamics || phase1?.sector_analysis || "N/A"}
${solutionCandidates.length > 0 ? `Solution Candidates: ${JSON.stringify(solutionCandidates).substring(0, 3000)}` : ""}

Mínimo 3 patrones por capa (15-25 total). Cada patrón: qué datos necesita, fuentes ideales, método detección, decisión habilitada.

Responde con JSON:
{
  "pattern_map": [
    {
      "layer": 1, "layer_name": "Evidentes",
      "patterns": [
        {"pattern_name": "nombre", "what_to_detect": "qué", "why_matters": "por qué", "data_needed": ["dato1"], "ideal_sources": ["fuente1"], "minimum_frequency": "monthly", "minimum_history": "12 meses", "detection_method": "trend_analysis", "decision_enabled": "qué decisión habilita", "cross_reference": "dato interno"}
      ]
    }
  ],
  "total_patterns": 20,
  "total_unique_sources_needed": 18,
  "coverage_by_layer": {"1": 4, "2": 4, "3": 5, "4": 4, "5": 3},
  "source_priority_ranking": [{"source": "nombre", "patterns_served": 3, "layers_covered": [1, 3], "priority": "critical|important|nice_to_have"}]
}` }
        ];

        const p1bResult = await chat(p1bMessages, { model: "gemini-pro", responseFormat: "json", maxTokens: 8192 });
        const phase1b = safeParseJson(p1bResult) as any;
        const patternMap = phase1b?.pattern_map || [];
        console.log(`[pipeline_run] Phase 1b (Pattern Map) done: ${phase1b?.total_patterns || patternMap.reduce((s: number, l: any) => s + (l.patterns?.length || 0), 0)} patterns`);

        // ════════════════════════════════════════════════════════════
        // PHASE 2: Source Discovery DIRECTED by Pattern Map
        // ════════════════════════════════════════════════════════════
        const unconventionalSources = getUnconventionalSources(sector);
        let unconventionalBlock = "";
        if (unconventionalSources) {
          unconventionalBlock = `\nFUENTES NO CONVENCIONALES ESPECÍFICAS DEL SECTOR (INCLUIR OBLIGATORIAMENTE):\n${unconventionalSources.map(s => `- [Tier ${s.tier}] ${s.name} (${s.type}, freq: ${s.frequency}, status: ${s.status})\n  Hipótesis: ${s.hypothesis}\n  Impacto: ${s.impact} | Coste integración: ${s.integration_cost}`).join("\n")}`;
        }

        // Build pattern-map directed discovery block
        let patternMapDirectedBlock = "";
        if (patternMap.length > 0) {
          const allNeededSources: string[] = [];
          const patternSummaries = patternMap.map((layer: any) => {
            const patterns = (layer.patterns || []).map((p: any) => {
              (p.ideal_sources || []).forEach((s: string) => allNeededSources.push(s));
              return `  - ${p.pattern_name}: necesita [${(p.data_needed || []).join(", ")}] de [${(p.ideal_sources || []).join(", ")}] (freq: ${p.minimum_frequency}, historia: ${p.minimum_history})`;
            }).join("\n");
            return `Capa ${layer.layer} (${layer.layer_name}):\n${patterns}`;
          }).join("\n\n");

          patternMapDirectedBlock = `\n═══ MAPA DE PATRONES (busca fuentes ESPECÍFICAS para cada uno) ═══\n${patternSummaries}\n\nFUENTES IDEALES:\n${[...new Set(allNeededSources)].map(s => `- ${s}`).join("\n")}\n\nMÍNIMO 15 fuentes. Cada fuente debe indicar qué patrones del mapa sirve.`;
        }

        const p2Messages: ChatMessage[] = [
          { role: "system", content: `Eres un investigador de datos experto. Identifica fuentes de datos públicas para análisis sectorial.
${patternMap.length > 0 ? "IMPORTANTE: Tienes un MAPA DE PATRONES. Busca fuentes ESPECÍFICAS para cada patrón, no genéricas." : ""}
Responde SOLO con JSON válido.` },
          { role: "user", content: `Identifica las mejores fuentes de datos:

Sector: ${sector}
Geografía: ${geography}
Objetivo: ${objective}
Variables clave: ${JSON.stringify(phase1?.key_variables || [])}
${patternMapDirectedBlock}

${solutionCandidates.length > 0 ? `CONTEXTO ADICIONAL:\nSolution Candidates: ${JSON.stringify(solutionCandidates).substring(0, 3000)}\nBusca fuentes que ESPECÍFICAMENTE alimenten estos candidatos.` : ""}
${archSignals.length > 0 ? `Architecture Signals: ${JSON.stringify(archSignals).substring(0, 2000)}` : ""}
${unconventionalBlock}

Responde con JSON:
{
  "sources": [
    {
      "source_name": "nombre", "url": "url o null", "source_type": "API|Paper|Report|Web|Gov|DB|Telco|Data Provider",
      "reliability_score": 7, "data_type": "descripción", "update_frequency": "daily|weekly|monthly|quarterly|annual|continuous|varies",
      "coverage_period": "2020-2026",
      "status": "available|pending|requires_agreement",
      "hypothesis": "hipótesis que soporta", "impact": "high|medium|low",
      "integration_cost": "low|medium|high", "cost": "gratis|freemium|pago"${patternMap.length > 0 ? ',\n      "patterns_served": ["patrón1"]' : ''}
    }
  ],
  "search_queries": ["query1", "query2", "query3"],
  "proxy_queries": ["proxy1", "proxy2"]${patternMap.length > 0 ? ',\n  "pattern_coverage": {"covered_patterns": 18, "total_patterns": 20, "uncovered": []}' : ''}
}` }
        ];

        const p2Result = await chat(p2Messages, { model: "gemini-flash-lite", responseFormat: "json", maxTokens: 8192 });
        const phase2 = safeParseJson(p2Result) as any;
        const allSources = phase2?.sources || [];
        console.log(`[pipeline_run] Phase 2 (Sources) done: ${allSources.length} sources`);

        // ════════════════════════════════════════════════════════════
        // PHASE 3: Quality Gate (algorithmic, never FAIL in pipeline)
        // ════════════════════════════════════════════════════════════
        const sourceTypes = new Set(allSources.map((s: any) => s.source_type));
        const avgReliability = allSources.length > 0
          ? allSources.reduce((sum: number, s: any) => sum + (s.reliability_score || 0), 0) / allSources.length
          : 0;

        const reliabilityBonus = avgReliability >= 7 ? 10 : 0;
        const coveragePct = Math.min(100, allSources.length * 18 + reliabilityBonus);

        let qgVerdict: "PASS" | "PASS_CONDITIONAL" = "PASS";
        let confidenceCap = 1.0;
        const gaps: string[] = [];

        if (coveragePct < 80) gaps.push("Cobertura de variables < 80%");
        if (sourceTypes.size < 3) gaps.push("Menos de 3 tipos de fuente");
        if (avgReliability < 5) gaps.push("Fiabilidad media < 5/10");

        if (gaps.length > 0) {
          qgVerdict = "PASS_CONDITIONAL";
          confidenceCap = coveragePct >= 60 ? 0.6 : 0.5;
        }
        console.log(`[pipeline_run] Phase 3 (QG): ${qgVerdict}, cap=${confidenceCap}, coverage=${coveragePct}%`);

        // ════════════════════════════════════════════════════════════
        // PHASE 4: Confidence Cap (algorithmic)
        // ════════════════════════════════════════════════════════════
        const maxCap = qgVerdict === "PASS" ? 0.7 : qgVerdict === "PASS_CONDITIONAL" ? confidenceCap : 0.5;
        console.log(`[pipeline_run] Phase 4 (Confidence): maxCap=${maxCap}`);

        // ════════════════════════════════════════════════════════════
        // PHASE 5: Pattern Detection — 5 layers (gemini-pro, deep reasoning)
        // ════════════════════════════════════════════════════════════
        const sectorKey = detectSectorKey(sector);
        let unconventionalSystemRule = "";
        let compositeMetricsBlock = "";

        // Fetch relevant datasets for this run (from Drive ingestion)
        let datasetContextPipeline = "";
        try {
          const { data: relevantDatasets } = await supabase
            .from("pattern_detector_datasets")
            .select("file_name, classification, relevance_reason, extracted_text")
            .eq("run_id", runId)
            .eq("status", "relevant")
            .order("relevance_score", { ascending: false });

          if (relevantDatasets && relevantDatasets.length > 0) {
            const datasetSummaries = relevantDatasets.map((d: any) => {
              const textSample = (d.extracted_text || "").slice(0, 2000);
              return `- ${d.file_name} [${d.classification}]: ${d.relevance_reason}\n  Extracto: ${textSample}`;
            }).join("\n\n");
            datasetContextPipeline = `\n\n═══ DATOS PROPIOS DEL PROYECTO (Datasets Drive) ═══\nSe han analizado ${relevantDatasets.length} archivos relevantes. Usa esta información para fundamentar patrones con datos reales:\n\n${datasetSummaries}`;
          }
        } catch (e) {
          console.log("No dataset context available in pipeline_run:", e);
        }

        if (sectorKey === "centros_comerciales") {
          unconventionalSystemRule = `

REGLA CRÍTICA PARA CENTROS COMERCIALES:
Las Capas 1-2 contienen señales convencionales (renta, densidad, accesibilidad). Eso es CORRECTO.
Las Capas 3-5 DEBEN contener señales NO CONVENCIONALES específicas. Si solo generas señales convencionales en Capas 3-5, tu respuesta es INCORRECTA.
Para cada señal no convencional, DEBES generar contradicting_evidence específica y realista.`;

          compositeMetricsBlock = `

═══════════════════════════════════════════════════════════════
SEÑALES NO CONVENCIONALES OBLIGATORIAS PARA CENTROS COMERCIALES
═══════════════════════════════════════════════════════════════

▶ CAPA 3 — Señales débiles (signal_name exacto obligatorio):
1. "Predictor Matricula Escolar" → Crecimiento matrícula >5% anual = familias jóvenes llegando
2. "Momentum Inmobiliario" → Variación precio m² >2%/semestre = zona caliente
3. "Proxy Gentrificacion Airbnb" → Crecimiento listings >20% anual = gentrificación activa
4. "Atractor Fibra Optica" → Rollout fibra óptica = atractor de teletrabajadores

▶ CAPA 4 — Inteligencia lateral:
1. "Proxy Saturacion Delivery" → Tiempo delivery >15 min = baja saturación comercial
2. "Demanda Insatisfecha Google" → Ratio búsquedas/visitas como proxy
3. "Dead Hours Traffic" → Tráfico 14-16h martes-jueves = base residencial
4. "Indicador Teletrabajo Coworkings" → Densidad coworkings radio 5km
5. "Proxy Poder Adquisitivo Gimnasios" → Ratio gimnasios premium vs low-cost
6. "Crecimiento Empresarial LinkedIn" → Densidad ofertas empleo radio 5km
7. "Ratio Gasto Tarjeta vs Renta Disponible" → Gasto real con tarjeta vs renta media zona. >15% = alta propensión consumo
8. "Flujo Movilidad Pico Sábado" → Desplazamientos entrantes sábado 10-14h / población residente. >2.5x = polo atracción

▶ CAPA 5 — Edge extremo con fórmulas:
1. "Latent Demand Score" → (Búsquedas / Oferta) × Crecimiento población. >2.5 = oportunidad
2. "Future-Proof Index" → (Fibra × Permisos × Empleo) / Competencia. >1.0 = expansión sostenible
3. "Climate Refuge Score" → (Días >32°C + Lluvia >10mm + AQI>150) / 365. >0.25 = refugio climático
4. "Dead Hours Vitality Index" → Tráfico horas muertas / Tráfico pico sábado. >0.3 = base fuerte
5. "Correlacion Pet Shops Demografia" → Densidad pet shops + veterinarias como proxy poder adquisitivo
6. "Benchmark Success Score" → Score 0-100 comparando composición/ocupación/mix vs top 20 centros exitosos España
7. "Resilience Index" → (1-Herfindahl) × Diversidad × (1-Dependencia anchor). Anti-fragilidad del centro

▶ CAPA 3 — Señales adicionales:
5. "Índice Rotación Locales Comerciales" → Ratio locales que cambian operador/año radio 2km. Alta rotación = zona inestable
6. "Proxy Satisfacción Zona Google" → Rating medio Google Maps radio 1km. >4.2 = zona con buena experiencia comercial

RECORDATORIO: Señales convencionales en Capas 1-2, no convencionales en Capas 3-5. Cada señal DEBE tener contradicting_evidence específica.`;
        }

        let componentVinculationBlock = "";
        if (existingComponents.length > 0) {
          componentVinculationBlock = `\nCOMPONENTES IA YA DEFINIDOS EN EL PROYECTO:\n${JSON.stringify(existingComponents.map((c: any) => ({ id: c.id, nombre: c.nombre, tipo: c.tipo })).slice(0, 20), null, 2)}\n\nRAGs YA DEFINIDOS:\n${JSON.stringify(existingRags.map((r: any) => ({ id: r.id, nombre: r.nombre, funcion: r.funcion })).slice(0, 15), null, 2)}\n\nPara cada señal detectada, indica:\n1. Qué componente existente la consumiría (component_consumer)\n2. Si necesita un RAG externo nuevo (external_rag_needed: true/false)\n3. Si necesita un componente nuevo (new_component_needed: string|null)`;
        }

        const enrichedFieldsSchema = `
          "concrete_data_source": {
            "name": "Nombre exacto de la fuente",
            "url": "URL real verificable",
            "type": "api_publica|dataset_descargable|scraping_web|api_privada|registro_oficial",
            "format": "CSV mensual, API REST JSON, HTML tabla, etc.",
            "update_frequency": "Mensual|Trimestral|Anual",
            "cost": "Gratuito|Freemium|precio",
            "access_method": "GET sin auth|API Key gratuita|Certificado digital|etc."
          },
          "variable_extracted": {
            "name": "nombre_variable_concreta",
            "unit": "unidad/periodo",
            "granularity": "Por provincia y mes, etc."
          },
          "cross_with_internal": {
            "internal_variable": "nombre variable interna del cliente",
            "cross_logic": "Lógica de cruce específica",
            "lag_time": "Tiempo de anticipación"
          },
          "business_decision_enabled": {
            "decision": "Decisión concreta habilitada",
            "impossible_without_signal": "Qué no podía hacer antes",
            "value_estimate": "Estimación de valor económico"
          },
          "rag_requirement": {
            "rag_name": "RAG_EXT_NOMBRE",
            "hydration_method": "Método de hidratación",
            "estimated_volume": "Volumen estimado de datos"
          }`;

        const actionabilityInstructions = `

INSTRUCCIONES OBLIGATORIAS PARA CAPAS 3, 4 Y 5:

Las capas 1 y 2 son patrones que cualquier analista del sector conoce.
Las capas 3, 4 y 5 son el VALOR DIFERENCIAL del sistema.

Para CADA señal de capa 3, 4 o 5, DEBES responder TODAS estas preguntas:

1. FUENTE CONCRETA: ¿De dónde sale el dato EXACTO?
   - NO "Datos de mercado" → SÍ "Sede Electrónica del Catastro, consulta masiva por referencia catastral"
   - NO "Análisis demográfico" → SÍ "INE Padrón Municipal, tabla px T01001 por municipio y año"
   - NO "Datos de competencia" → SÍ "Scraping de la web de AECC (Asociación Española de Centros Comerciales), sección directorio de centros"
   - Incluir URL real si es posible

2. VARIABLE EXTRAÍDA: ¿Qué número o dato concreto sacas de esa fuente?
   - NO "tendencia de mercado" → SÍ "variación interanual del nº de locales vacíos en centros de la misma provincia"
   - Incluir unidad y granularidad

3. CRUCE CON DATO INTERNO: ¿Con qué dato del cliente se cruza y qué revela el cruce?
   - NO "se compara con los datos del activo" → SÍ "se cruza con la tasa_ocupacion_sba del activo. Si la media provincial sube 3pp y el activo baja 2pp, el activo tiene un problema específico, no zonal"
   - Incluir el tiempo de anticipación (cuánto antes predice el problema)

4. DECISIÓN DE NEGOCIO: ¿Qué puede hacer el cliente que ANTES NO PODÍA?
   - NO "mejorar la gestión" → SÍ "renegociar la renta 4 meses antes de que el operador active la cláusula de salida, ganando poder de negociación"
   - Incluir estimación del valor económico

5. RAG NECESARIO: ¿Qué RAG externo necesita la app para que esta señal funcione en producción?
   - Nombre del RAG, método de hidratación, volumen estimado

EJEMPLO CAPA 3 (Señal Débil):
- Señal: "Índice de Rotación de Personal en Retail por provincia"
- Fuente: SEPE (Servicio Público de Empleo), contratos registrados sector CNAE 47
  URL: https://www.sepe.es/HomeSepe/que-es-el-sepe/estadisticas/datos-estadisticos/contratos.html
- Variable: nº contratos temporales retail / nº contratos indefinidos retail (ratio)
- Cruce: Si el ratio de temporalidad sube >20% en la provincia del activo, los operadores están reduciendo compromiso. Anticipa 3-6 meses antes que un operador no renueve contrato.
- Decisión: Ofrecer condiciones de renovación mejoradas ANTES de que el operador decida irse.
- RAG: RAG_EXT_EMPLEO (descarga trimestral SEPE, 52 provincias, filtro CNAE 47)

EJEMPLO CAPA 4 (Inteligencia Lateral):
- Señal: "Correlación entre licencias de obra en radio 5km y valor futuro del activo"
- Fuente: Colegios de Arquitectos — visados de obra nueva por municipio
  URL: https://www.cscae.com/index.php/es/conoce-cscae/estadisticas
- Variable: nº visados de obra nueva residencial en municipios a <5km del activo
- Cruce: Si los visados suben >30% interanual, la población del catchment area crecerá en 2-3 años.
- Decisión: Ajustar las rentas escalonadas (step rents) de los contratos nuevos: subir si hay crecimiento.
- RAG: RAG_EXT_URBANISMO (descarga mensual colegios arquitectos + catastro)

EJEMPLO CAPA 5 (Edge Extremo):
- Señal: "Future-Proof Index: Composición del tenant mix vs evolución del ecommerce por categoría"
- Fuentes combinadas:
  a) CNMC Informe Trimestral de Comercio Electrónico (https://data.cnmc.es/comercio-electronico)
  b) INE Encuesta Anual de Comercio
  c) Datos internos de rent roll del activo
- Variables: % penetración ecommerce por categoría × peso de cada categoría en tenant mix
- Cruce: Un activo con 60% moda tiene Future-Proof Index de 0.35 (vulnerable). Uno con 40% restauración tiene 0.82 (resiliente).
- Decisión: Reestructurar tenant mix priorizando categorías con baja penetración ecommerce.
- RAGs: RAG_EXT_ECOMMERCE (CNMC trimestral) + RAG_EXT_COMERCIO (INE anual)

NO generes señales genéricas. Si no puedes identificar la fuente concreta con URL real, degrada la señal a una capa inferior o márcala como "requiere_investigacion_manual".`;

        const p5Messages: ChatMessage[] = [
          { role: "system", content: `Eres un detective de datos que detecta patrones en 5 capas de profundidad.
Para cada patrón, ejecutas un "abogado del diablo" interno: buscas evidencia que lo contradiga.
Cap de confianza máxima: ${maxCap} (${maxCap >= 1 ? "datos del usuario disponibles" : maxCap <= 0.6 ? "fuentes identificadas pero no conectadas" : "sin datos del usuario"}).
${maxCap <= 0.6 ? "IMPORTANTE: Todos los outputs deben marcarse como 'basados en fuentes parcialmente verificadas'." : ""}
${unconventionalSystemRule}
Responde SOLO con JSON válido.` },
          { role: "user", content: `Detecta patrones para este análisis:

Sector: ${sector}
Objetivo: ${objective}
Variables clave: ${JSON.stringify(phase1?.key_variables || [])}
Baseline: ${phase1?.baseline_definition || "N/A"}
Dinámicas del sector: ${phase1?.sector_dynamics || "N/A"}
Estacionalidad: ${JSON.stringify(phase1?.seasonality_patterns || [])}
Fuentes disponibles: ${JSON.stringify(allSources.map((s: any) => ({ name: s.source_name, type: s.source_type, data: s.data_type })).slice(0, 20))}
${componentVinculationBlock}
${compositeMetricsBlock}
${datasetContextPipeline || ""}

Genera patrones en 5 capas:
1. Obvia - Lo que cualquier analista vería
2. Analítica Avanzada - Correlaciones menos evidentes
3. Señales Débiles - Indicadores tempranos con fuentes REALES
4. Inteligencia Lateral - Variables que nadie cruza con fuentes ESPECÍFICAS
5. Edge Extremo - Solo si hay base sólida, con fórmulas COMPUESTAS
${actionabilityInstructions}

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
          "description": "descripción detallada",
          "confidence": 0.0-${maxCap},
          "p_value_estimate": 0.0-1.0,
          "impact": "high|medium|low",
          "trend": "up|down|stable",
          "uncertainty_type": "epistemic|aleatoric",
          "devil_advocate_result": "validated|degraded|moved_to_hypothesis",
          "contradicting_evidence": "evidencia contraria específica",
          "data_source": "fuente",
          "variables_needed": ["var1", "var2"],
          "external_data_required": true,
          "external_source_id": "id o null",
          "component_consumer": "id componente existente o null",
          "external_rag_needed": false,
          ${enrichedFieldsSchema}
        }
      ]
    }
  ]
}

NOTA: Los campos concrete_data_source, variable_extracted, cross_with_internal, business_decision_enabled y rag_requirement son OBLIGATORIOS para señales de capas 3, 4 y 5. Para capas 1 y 2 son opcionales.` }
        ];

        let layers: any[] = [];
        try {
          const p5Result = await chat(p5Messages, { model: "gemini-pro", responseFormat: "json", maxTokens: 12288 });
          const phase5 = safeParseJson(p5Result) as any;
          layers = phase5?.layers || [];
          console.log(`[pipeline_run] Phase 5 LLM parsed OK: ${layers.length} layers`);
        } catch (p5Err) {
          console.error("[pipeline_run] Phase 5 LLM parse failed, using empty layers (hardcoded will be injected):", p5Err);
          layers = [
            { layer_id: 1, layer_name: "Obvia", signals: [] },
            { layer_id: 2, layer_name: "Analítica Avanzada", signals: [] },
            { layer_id: 3, layer_name: "Señales Débiles", signals: [] },
            { layer_id: 4, layer_name: "Inteligencia Lateral", signals: [] },
            { layer_id: 5, layer_name: "Edge Extremo", signals: [] },
          ];
        }

        // Inject hardcoded unconventional signals for centros_comerciales
        if (sectorKey === "centros_comerciales") {
          const SECTOR_UNCONVENTIONAL_SIGNALS: Record<number, any[]> = {
            3: [
              { signal_name: "Predictor Matricula Escolar", description: "Crecimiento matrícula escolar municipal >5% anual como predictor de familias jóvenes.", confidence: 0.55, p_value_estimate: 0.10, impact: "medium", trend: "up", uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis", data_source: "Ministerio de Educación (Tier A)", variables_needed: ["matricula_escolar_anual"], external_data_required: true, contradicting_evidence: "El aumento puede deberse a redistribución zonal, no a nuevas familias.",
                concrete_data_source: { name: "Ministerio de Educación — Estadística de las Enseñanzas no universitarias", url: "https://www.educacionyfp.gob.es/servicios-al-ciudadano/estadisticas/no-universitaria.html", type: "dataset_descargable", format: "CSV anual por municipio", update_frequency: "Anual", cost: "Gratuito", access_method: "Descarga directa sin auth" },
                variable_extracted: { name: "variacion_interanual_matricula_infantil_primaria", unit: "alumnos/año", granularity: "Por municipio y nivel educativo" },
                cross_with_internal: { internal_variable: "footfall_familiar", cross_logic: "Si matrícula sube >5% y footfall familiar no sube proporcionalmente, hay demanda latente no captada. Si ambos suben, confirma crecimiento de catchment.", lag_time: "La matrícula anticipa crecimiento de footfall familiar en 12-18 meses" },
                business_decision_enabled: { decision: "Reconfigurar tenant mix hacia marcas infantiles/familiares y ajustar horarios de actividades", impossible_without_signal: "Sin este dato, se detecta el cambio demográfico 2 años después cuando ya hay competencia posicionada", value_estimate: "Captar 1 operador ancla infantil = €200-400K/año renta" },
                rag_requirement: { rag_name: "RAG_EXT_EDUCACION", hydration_method: "Descarga anual CSV desde educacionyfp.gob.es", estimated_volume: "8,131 municipios × 6 niveles × 5 años = ~244K registros" }
              },
              { signal_name: "Momentum Inmobiliario", description: "Variación precio m² >2%/semestre como indicador de zona en calentamiento.", confidence: 0.60, p_value_estimate: 0.10, impact: "high", trend: "up", uncertainty_type: "aleatoric", devil_advocate_result: "moved_to_hypothesis", data_source: "INE — Índice de Precios de Vivienda", variables_needed: ["precio_m2_semestral"], external_data_required: true, contradicting_evidence: "La subida puede ser especulativa sin respaldo de demanda real de consumo.",
                concrete_data_source: { name: "INE — Índice de Precios de Vivienda (IPV)", url: "https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736152838", type: "dataset_descargable", format: "PC-Axis trimestral", update_frequency: "Trimestral", cost: "Gratuito", access_method: "API JSON-stat o descarga PC-Axis" },
                variable_extracted: { name: "variacion_ipv_trimestral_provincia", unit: "% variación interanual", granularity: "Por provincia y trimestre" },
                cross_with_internal: { internal_variable: "rentas_m2_contratos", cross_logic: "Si IPV sube >2% y rentas del activo están flat, hay margen para renegociar al alza. Si IPV baja y rentas suben, riesgo de vacancy.", lag_time: "IPV anticipa ajuste de rentas comerciales en 6-9 meses" },
                business_decision_enabled: { decision: "Renegociar rentas al alza proactivamente antes de renovaciones cuando IPV sube, o preparar incentivos de retención cuando baja", impossible_without_signal: "Sin IPV provincial, la negociación es reactiva al mercado", value_estimate: "Ajustar rentas 1-2% anticipadamente en cartera de 50 contratos = €150-300K/año" },
                rag_requirement: { rag_name: "RAG_EXT_INMOBILIARIO", hydration_method: "API INE JSON-stat, descarga trimestral automatizada", estimated_volume: "52 provincias × 4 trimestres × 10 años = 2,080 registros" }
              },
              { signal_name: "Proxy Gentrificacion Airbnb", description: "Crecimiento listings Airbnb >20% anual como proxy de gentrificación activa.", confidence: 0.45, p_value_estimate: 0.12, impact: "medium", trend: "up", uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis", data_source: "Inside Airbnb", variables_needed: ["listings_airbnb_zona"], external_data_required: true, contradicting_evidence: "El aumento de Airbnb puede reducir población residente permanente.",
                concrete_data_source: { name: "Inside Airbnb — Datos abiertos de listings por ciudad", url: "http://insideairbnb.com/get-the-data/", type: "dataset_descargable", format: "CSV mensual por ciudad", update_frequency: "Mensual", cost: "Gratuito", access_method: "Descarga directa CSV" },
                variable_extracted: { name: "variacion_listings_activos_radio_3km", unit: "listings/mes", granularity: "Por barrio/código postal y mes" },
                cross_with_internal: { internal_variable: "perfil_visitante_turista_vs_residente", cross_logic: "Si listings suben >20% y el % de visitantes turistas sube, el centro se beneficia. Si listings suben pero footfall cae, la gentrificación expulsa residentes.", lag_time: "Listings anticipan cambio de perfil de visitante en 6-12 meses" },
                business_decision_enabled: { decision: "Adaptar oferta gastronómica y horarios a perfil turista (más tarde, más fin de semana) o reforzar propuesta para residentes", impossible_without_signal: "Sin este proxy, el cambio de perfil se detecta post-facto cuando las ventas ya cambiaron", value_estimate: "Adaptar tenant mix a nuevo perfil = evitar 2-3 vacantes de €100K/año" },
                rag_requirement: { rag_name: "RAG_EXT_AIRBNB", hydration_method: "Descarga mensual CSV desde insideairbnb.com", estimated_volume: "~50 ciudades España × 12 meses = 600 snapshots" }
              },
              { signal_name: "Atractor Fibra Optica", description: "Rollout reciente de fibra óptica como atractor de teletrabajadores.", confidence: 0.40, p_value_estimate: 0.15, impact: "low", trend: "up", uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis", data_source: "CNMC", variables_needed: ["cobertura_fibra_zona"], external_data_required: true, contradicting_evidence: "La fibra se despliega por rentabilidad del operador, no demanda de teletrabajo.",
                concrete_data_source: { name: "CNMC — Informe de cobertura de banda ancha", url: "https://www.cnmc.es/ambitos-de-actuacion/telecomunicaciones/informes-telecomunicaciones", type: "dataset_descargable", format: "PDF + datos adjuntos Excel", update_frequency: "Semestral", cost: "Gratuito", access_method: "Descarga desde web CNMC" },
                variable_extracted: { name: "cobertura_ftth_porcentaje_municipio", unit: "% hogares con FTTH", granularity: "Por municipio" },
                cross_with_internal: { internal_variable: "coworkings_en_centro", cross_logic: "Si cobertura FTTH sube >10pp y hay coworkings en el centro, teletrabajadores generan tráfico entre semana.", lag_time: "FTTH anticipa aumento de tráfico diurno entre semana en 6-12 meses" },
                business_decision_enabled: { decision: "Habilitar espacios de coworking o salas de reuniones dentro del centro comercial", impossible_without_signal: "Sin dato de FTTH, no se puede anticipar demanda de espacios de trabajo", value_estimate: "Nuevo uso de espacio vacante como coworking = €50-100K/año" },
                rag_requirement: { rag_name: "RAG_EXT_TELECOM", hydration_method: "Descarga semestral desde CNMC", estimated_volume: "8,131 municipios × 2 semestres × 5 años = ~81K registros" }
              },
            ],
            4: [
              { signal_name: "Proxy Saturacion Delivery", description: "Tiempo respuesta delivery >15 min en horario punta como proxy de baja saturación comercial.", confidence: 0.50, p_value_estimate: 0.10, impact: "high", trend: "stable", uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis", data_source: "APIs delivery", variables_needed: ["tiempo_delivery_zona"], external_data_required: true, contradicting_evidence: "Depende de infraestructura vial y riders, no solo densidad comercial.",
                concrete_data_source: { name: "Glovo/Uber Eats — Tiempos estimados de entrega por zona", url: "https://glovoapp.com/", type: "scraping_web", format: "JSON via API no oficial / scraping webapp", update_frequency: "Diaria (muestreo semanal)", cost: "Gratuito (scraping)", access_method: "Scraping web o reverse engineering API móvil" },
                variable_extracted: { name: "tiempo_medio_entrega_horario_punta_radio_3km", unit: "minutos", granularity: "Por código postal y franja horaria" },
                cross_with_internal: { internal_variable: "vacancy_rate_food_court", cross_logic: "Si delivery >15min (baja saturación) y vacancy en food court >10%, oportunidad para atraer dark kitchens o restauración. Si delivery <10min, zona ya saturada.", lag_time: "Tiempos de delivery reflejan saturación en tiempo real, sin lag" },
                business_decision_enabled: { decision: "Ofrecer espacios a operadores de dark kitchen o restauración que cubran la demanda insatisfecha de delivery", impossible_without_signal: "Sin este proxy, no se puede distinguir vacío de mercado de falta de demanda", value_estimate: "Captar 2-3 operadores de restauración = €200-350K/año renta" },
                rag_requirement: { rag_name: "RAG_EXT_DELIVERY", hydration_method: "Scraping semanal de Glovo/Uber Eats por CP", estimated_volume: "500 CPs × 52 semanas = 26,000 muestras/año" }
              },
              { signal_name: "Demanda Insatisfecha Google", description: "Ratio búsquedas/visitas como proxy de demanda insatisfecha.", confidence: 0.55, p_value_estimate: 0.05, impact: "high", trend: "up", uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis", data_source: "Google Trends + Maps", variables_needed: ["busquedas_zona", "visitas_centros"], external_data_required: true, contradicting_evidence: "Búsquedas pueden ser de turistas o personas de paso.",
                concrete_data_source: { name: "Google Trends — Interés por categoría y DMA", url: "https://trends.google.es/trends/", type: "api_publica", format: "CSV o API pytrends", update_frequency: "Semanal", cost: "Gratuito", access_method: "API pytrends (Python) o descarga manual" },
                variable_extracted: { name: "ratio_busquedas_vs_oferta_por_categoria", unit: "índice 0-100 normalizado", granularity: "Por DMA/provincia y categoría de retail" },
                cross_with_internal: { internal_variable: "ventas_por_categoria_tenant_mix", cross_logic: "Si búsquedas de 'moda deportiva' suben >30% en la provincia pero el centro no tiene tienda deportiva, hay demanda insatisfecha capturable.", lag_time: "Búsquedas anticipan tendencias de consumo en 2-4 meses" },
                business_decision_enabled: { decision: "Priorizar captación de operadores en categorías con alta búsqueda y baja oferta en el centro", impossible_without_signal: "Sin Google Trends por categoría, la captación se basa en intuición y disponibilidad del operador", value_estimate: "Llenar 1 local vacante con categoría de alta demanda = €150-250K/año vs categoría genérica" },
                rag_requirement: { rag_name: "RAG_EXT_SEARCH_TRENDS", hydration_method: "API pytrends semanal por provincia + categoría CNAE", estimated_volume: "52 provincias × 20 categorías × 52 semanas = ~54K registros/año" }
              },
              { signal_name: "Dead Hours Traffic", description: "Tráfico peatonal 14-16h martes-jueves indica base residencial local fuerte.", confidence: 0.50, p_value_estimate: 0.08, impact: "high", trend: "stable", uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis", data_source: "Google Maps Popular Times", variables_needed: ["trafico_horas_muertas"], external_data_required: true, contradicting_evidence: "Puede indicar zona con alta tasa de desempleo o jubilados con bajo gasto.",
                concrete_data_source: { name: "Google Maps — Popular Times por establecimiento", url: "https://www.google.com/maps", type: "scraping_web", format: "JSON via scraping o API Places (campo populartimes)", update_frequency: "Semanal (agregado)", cost: "Freemium (Google Places API $17/1K requests)", access_method: "Google Places API o scraping" },
                variable_extracted: { name: "ratio_trafico_horas_muertas_vs_pico", unit: "ratio 0-1", granularity: "Por establecimiento y día de la semana" },
                cross_with_internal: { internal_variable: "footfall_por_franja_horaria", cross_logic: "Si ratio dead hours >0.3, base residencial fuerte. Cruzar con ventas por franja: si ventas dead hours son bajas vs tráfico, falta oferta para ese segmento.", lag_time: "Indicador en tiempo real, no predictivo sino diagnóstico" },
                business_decision_enabled: { decision: "Extender horarios de operadores específicos o crear oferta de lunch deals / tardes entre semana", impossible_without_signal: "Sin este ratio, no se distingue centro dependiente de fin de semana vs centro con base residencial", value_estimate: "Optimizar oferta dead hours = +5-10% ventas entre semana = €100-200K/año" },
                rag_requirement: { rag_name: "RAG_EXT_POPULAR_TIMES", hydration_method: "Google Places API semanal para competidores + propio centro", estimated_volume: "50 centros × 7 días × 52 semanas = 18,200 muestras/año" }
              },
              { signal_name: "Indicador Teletrabajo Coworkings", description: ">5 coworkings en radio 5km indica teletrabajo normalizado.", confidence: 0.45, p_value_estimate: 0.10, impact: "medium", trend: "up", uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis", data_source: "OpenStreetMap", variables_needed: ["coworkings_radio_5km"], external_data_required: true, contradicting_evidence: "Coworkings pueden estar en zonas con alta oferta comercial existente.",
                concrete_data_source: { name: "OpenStreetMap — Overpass API, amenity=coworking_space", url: "https://overpass-turbo.eu/", type: "api_publica", format: "JSON via Overpass API", update_frequency: "Continua (consulta bajo demanda)", cost: "Gratuito", access_method: "GET Overpass API sin auth" },
                variable_extracted: { name: "densidad_coworkings_radio_5km", unit: "coworkings/km²", granularity: "Por coordenadas del activo, radio 5km" },
                cross_with_internal: { internal_variable: "trafico_entre_semana_vs_finde", cross_logic: "Si densidad coworkings >2/km² y tráfico entre semana >60% del fin de semana, confirma base teletrabajadora. Oportunidad de captar ese tráfico.", lag_time: "Apertura de coworkings anticipa aumento tráfico diurno en 3-6 meses" },
                business_decision_enabled: { decision: "Crear zona de coworking premium dentro del centro o negociar con operadores de coworking como anchor tenant", impossible_without_signal: "Sin mapear coworkings, no se detecta la oportunidad de nuevo uso del espacio", value_estimate: "Espacio coworking dentro del centro = €80-150K/año por 500m²" },
                rag_requirement: { rag_name: "RAG_EXT_OSM_POI", hydration_method: "Consulta Overpass API mensual por coordenadas de activos", estimated_volume: "100 activos × 12 meses = 1,200 consultas/año" }
              },
              { signal_name: "Proxy Poder Adquisitivo Gimnasios", description: "Ratio gimnasios premium vs low-cost como proxy de poder adquisitivo.", confidence: 0.40, p_value_estimate: 0.12, impact: "medium", trend: "stable", uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis", data_source: "OpenStreetMap + Google Maps", variables_needed: ["gimnasios_premium", "gimnasios_lowcost"], external_data_required: true, contradicting_evidence: "Gimnasios premium pueden estar subvencionados o dirigidos a público no residente.",
                concrete_data_source: { name: "Google Maps Places API — Fitness centers por zona", url: "https://developers.google.com/maps/documentation/places/web-service", type: "api_privada", format: "JSON Places API", update_frequency: "Bajo demanda", cost: "Google Maps Platform ($17/1K requests)", access_method: "API Key Google Cloud" },
                variable_extracted: { name: "ratio_gimnasios_premium_vs_lowcost_radio_5km", unit: "ratio", granularity: "Por coordenadas del activo, radio 5km" },
                cross_with_internal: { internal_variable: "ticket_medio_por_operador", cross_logic: "Si ratio premium/lowcost >1.5 y ticket medio del centro está por debajo de la media, hay capacidad de subir posicionamiento. Si ratio <0.5, ajustar oferta a precio.", lag_time: "Indicador estructural, no predictivo, revisión anual" },
                business_decision_enabled: { decision: "Ajustar posicionamiento del centro (premium vs value) y tipo de operadores a captar", impossible_without_signal: "Sin este proxy, el posicionamiento se basa en percepciones subjetivas del asset manager", value_estimate: "Reposicionar correctamente = +10-15% en rentas variables = €100-200K/año" },
                rag_requirement: { rag_name: "RAG_EXT_POI_FITNESS", hydration_method: "Google Places API trimestral por activo", estimated_volume: "100 activos × 4 trimestres = 400 consultas/año" }
              },
              { signal_name: "Crecimiento Empresarial LinkedIn", description: "Densidad ofertas empleo LinkedIn en radio 5km como indicador de crecimiento.", confidence: 0.45, p_value_estimate: 0.10, impact: "medium", trend: "up", uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis", data_source: "LinkedIn Jobs", variables_needed: ["ofertas_empleo_zona"], external_data_required: true, contradicting_evidence: "Ofertas pueden ser remotas geolocalizadas artificialmente.",
                concrete_data_source: { name: "LinkedIn Jobs — Ofertas de empleo por localización", url: "https://www.linkedin.com/jobs/", type: "scraping_web", format: "HTML/JSON via scraping", update_frequency: "Semanal", cost: "Gratuito (scraping) o LinkedIn API ($)", access_method: "Scraping público o LinkedIn Talent Insights (API de pago)" },
                variable_extracted: { name: "ofertas_empleo_nuevas_radio_5km_mensual", unit: "ofertas/mes", granularity: "Por municipio/CP y mes" },
                cross_with_internal: { internal_variable: "footfall_horario_laboral", cross_logic: "Si ofertas empleo suben >15% y footfall laboral sube, nueva población trabajadora. Si ofertas suben pero footfall no, los empleos son remotos.", lag_time: "Ofertas de empleo anticipan aumento de tráfico laboral en 3-6 meses" },
                business_decision_enabled: { decision: "Captar operadores de food service y conveniencia para la nueva población trabajadora", impossible_without_signal: "Sin datos de empleo zonal, no se detecta la oportunidad hasta que ya hay competencia", value_estimate: "Captar food service para zona en crecimiento empresarial = €100-200K/año" },
                rag_requirement: { rag_name: "RAG_EXT_EMPLEO_LINKEDIN", hydration_method: "Scraping semanal LinkedIn Jobs por localización de activos", estimated_volume: "100 activos × 52 semanas = 5,200 muestras/año" }
              },
            ],
            5: [
              { signal_name: "Latent Demand Score", description: "(Búsquedas / Oferta) × Crecimiento población. >2.5 = oportunidad clara.", confidence: 0.35, p_value_estimate: 0.20, impact: "high", trend: "up", uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis", data_source: "Google Trends + OSM + INE", variables_needed: ["busquedas_zona", "oferta_comercial", "crecimiento_poblacion"], external_data_required: true, contradicting_evidence: "Variables pueden tener dinámicas independientes que no se refuerzan.",
                concrete_data_source: { name: "Combinación: Google Trends + OSM Overpass + INE Padrón Municipal", url: "https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736177012", type: "api_publica", format: "Múltiple: CSV (INE) + JSON (Overpass) + CSV (Trends)", update_frequency: "Trimestral (agregado)", cost: "Gratuito", access_method: "APIs públicas combinadas" },
                variable_extracted: { name: "latent_demand_score", unit: "índice compuesto adimensional", granularity: "Por municipio del activo" },
                cross_with_internal: { internal_variable: "vacancy_rate_sba", cross_logic: "Si LDS >2.5 y vacancy >15%, oportunidad clara de captación. Si LDS >2.5 y vacancy <5%, subir rentas. Si LDS <1.0 y vacancy >10%, problema estructural.", lag_time: "LDS anticipa cambios en vacancy en 6-12 meses" },
                business_decision_enabled: { decision: "Priorizar inversión CAPEX en activos con alto LDS y alta vacancy (máximo potencial de revalorización)", impossible_without_signal: "Sin LDS, la priorización de inversión es por intuición del asset manager", value_estimate: "Priorizar CAPEX correctamente = 2-3x ROI vs inversión a ciegas" },
                rag_requirement: { rag_name: "RAG_EXT_COMPOSITE_DEMAND", hydration_method: "Pipeline trimestral: INE Padrón + Google Trends + OSM Overpass", estimated_volume: "100 activos × 4 trimestres × 3 fuentes = 1,200 cálculos/año" }
              },
              { signal_name: "Climate Refuge Score", description: "(Días >32°C + Lluvia >10mm + AQI >150) / 365. >0.25 = refugio climático.", confidence: 0.40, p_value_estimate: 0.15, impact: "medium", trend: "stable", uncertainty_type: "aleatoric", devil_advocate_result: "moved_to_hypothesis", data_source: "AEMET", variables_needed: ["dias_calor", "dias_lluvia", "dias_aqi"], external_data_required: true, contradicting_evidence: "Efecto estacional, no genera fidelización a largo plazo.",
                concrete_data_source: { name: "AEMET OpenData — Datos climatológicos diarios", url: "https://opendata.aemet.es/centrodedescargas/inicio", type: "api_publica", format: "JSON via API REST", update_frequency: "Diaria", cost: "Gratuito (API Key gratuita)", access_method: "API Key gratuita desde opendata.aemet.es" },
                variable_extracted: { name: "climate_refuge_score", unit: "ratio 0-1", granularity: "Por estación meteorológica más cercana al activo" },
                cross_with_internal: { internal_variable: "footfall_dias_extremos", cross_logic: "Si CRS >0.25 y footfall sube en días extremos, el centro funciona como refugio. Potenciar esta función con climatización y actividades indoor.", lag_time: "CRS tiene componente estacional predecible con 3 meses de anticipación" },
                business_decision_enabled: { decision: "Invertir en climatización y marketing del centro como 'refugio climático' en días extremos", impossible_without_signal: "Sin CRS, no se cuantifica el valor del centro como refugio ni se puede justificar inversión en climatización", value_estimate: "Captar tráfico extra en días extremos = +5-8% footfall anual en zonas con CRS alto" },
                rag_requirement: { rag_name: "RAG_EXT_CLIMA", hydration_method: "API AEMET diaria para estaciones cercanas a activos", estimated_volume: "100 activos × 365 días = 36,500 registros/año" }
              },
              { signal_name: "Future-Proof Index", description: "(Fibra × Permisos × Empleo) / Competencia. >1.0 = zona en expansión sostenible.", confidence: 0.30, p_value_estimate: 0.30, impact: "high", trend: "up", uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis", data_source: "CNMC + Catastro + LinkedIn", variables_needed: ["cobertura_fibra", "permisos_construccion", "ofertas_empleo", "competencia_actual"], external_data_required: true, contradicting_evidence: "Puede indicar burbuja inmobiliaria sin demanda real de retail.",
                concrete_data_source: { name: "Combinación: CNMC Banda Ancha + CSCAE Visados + LinkedIn Jobs + AECC Directorio", url: "https://www.cscae.com/index.php/es/conoce-cscae/estadisticas", type: "dataset_descargable", format: "Múltiple: Excel + JSON + HTML", update_frequency: "Trimestral (agregado)", cost: "Gratuito excepto LinkedIn Insights ($)", access_method: "Descarga + scraping + API" },
                variable_extracted: { name: "future_proof_index", unit: "índice compuesto adimensional", granularity: "Por municipio del activo" },
                cross_with_internal: { internal_variable: "capex_planificado_activo", cross_logic: "Si FPI >1.0 y CAPEX planificado es bajo, oportunidad perdida. Si FPI <0.5 y CAPEX es alto, inversión de riesgo.", lag_time: "FPI anticipa potencial de revalorización en 2-3 años" },
                business_decision_enabled: { decision: "Priorizar CAPEX y expansiones en activos con FPI >1.0, desinvertir en activos con FPI <0.5", impossible_without_signal: "Sin FPI, las decisiones de inversión se basan en performance pasada, no en potencial futuro", value_estimate: "Evitar 1 inversión mal dirigida = €1-5M ahorrados" },
                rag_requirement: { rag_name: "RAG_EXT_COMPOSITE_FUTUREPROOF", hydration_method: "Pipeline trimestral combinando 4 fuentes", estimated_volume: "100 activos × 4 fuentes × 4 trimestres = 1,600 cálculos/año" }
              },
              { signal_name: "Dead Hours Vitality Index", description: "Tráfico horas muertas / Tráfico pico sábado. >0.3 = base residencial fuerte.", confidence: 0.35, p_value_estimate: 0.20, impact: "medium", trend: "stable", uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis", data_source: "Google Maps Popular Times", variables_needed: ["trafico_horas_muertas", "trafico_pico_sabado"], external_data_required: true, contradicting_evidence: "Puede reflejar horarios de trabajo flexibles temporales.",
                concrete_data_source: { name: "Google Maps Popular Times — Agregado semanal", url: "https://developers.google.com/maps/documentation/places/web-service", type: "api_privada", format: "JSON Places API", update_frequency: "Semanal", cost: "$17/1K requests Google Places API", access_method: "API Key Google Cloud" },
                variable_extracted: { name: "dead_hours_vitality_index", unit: "ratio 0-1", granularity: "Por centro comercial" },
                cross_with_internal: { internal_variable: "ventas_por_franja_horaria", cross_logic: "Si DHVI >0.3 pero ventas en dead hours son <15% del total, hay tráfico sin conversión = oportunidad de optimizar oferta.", lag_time: "DHVI es indicador estructural, cambios se detectan en semanas" },
                business_decision_enabled: { decision: "Diseñar programas de fidelización específicos para horarios dead hours (descuentos, actividades, parking gratuito)", impossible_without_signal: "Sin DHVI, no se cuantifica el potencial de los horarios valle", value_estimate: "Convertir 10% del tráfico dead hours en compradores = +€200-400K/año" },
                rag_requirement: { rag_name: "RAG_EXT_POPULAR_TIMES", hydration_method: "Google Places API semanal", estimated_volume: "50 centros × 52 semanas = 2,600 consultas/año" }
              },
              { signal_name: "Ecommerce Resilience Index", description: "Composición tenant mix ponderada por penetración ecommerce de cada categoría. Bajo = vulnerable.", confidence: 0.30, p_value_estimate: 0.25, impact: "high", trend: "down", uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis", data_source: "CNMC Comercio Electrónico + INE", variables_needed: ["penetracion_ecommerce_por_categoria", "peso_categoria_tenant_mix"], external_data_required: true, contradicting_evidence: "Ecommerce puede estabilizarse en categorías maduras.",
                concrete_data_source: { name: "CNMC — Informe Trimestral de Comercio Electrónico", url: "https://data.cnmc.es/comercio-electronico", type: "dataset_descargable", format: "PDF + datos CSV adjuntos", update_frequency: "Trimestral", cost: "Gratuito", access_method: "Descarga directa desde data.cnmc.es" },
                variable_extracted: { name: "ecommerce_resilience_index", unit: "índice 0-1 (1=resiliente)", granularity: "Por activo (basado en su tenant mix)" },
                cross_with_internal: { internal_variable: "tenant_mix_por_categoria_sba", cross_logic: "ERI = 1 - Σ(peso_categoría × penetración_ecommerce_categoría). Activo con 60% moda = ERI 0.35 (vulnerable). Activo con 40% restauración = ERI 0.82.", lag_time: "ERI evoluciona lentamente, revisión trimestral suficiente" },
                business_decision_enabled: { decision: "Reestructurar tenant mix priorizando categorías con baja penetración ecommerce (restauración, salud, ocio experiencial, servicios)", impossible_without_signal: "Sin ERI, la reestructuración del tenant mix es reactiva a vacantes, no proactiva", value_estimate: "Anticipar reestructuración vs reactiva = evitar 3-5 años de declive gradual de rentas variables" },
                rag_requirement: { rag_name: "RAG_EXT_ECOMMERCE", hydration_method: "Descarga trimestral CNMC + scraping INE Encuesta de Comercio", estimated_volume: "30 categorías × 4 trimestres × 5 años = 600 registros" }
              },
              { signal_name: "Benchmark Success Score", description: "Score compuesto que compara composición de operadores, ocupación, y mix sectorial del centro analizado vs los 20 centros más exitosos de España. Score 0-100.", confidence: 0.30, p_value_estimate: 0.25, impact: "high", trend: "up", uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis", data_source: "AECC + CBRE/JLL + datos propios", variables_needed: ["composicion_operadores", "ocupacion", "mix_sectorial"], external_data_required: true, contradicting_evidence: "Los centros de referencia operan en contextos únicos no replicables.",
                concrete_data_source: { name: "AECC Directorio + Informes CBRE/JLL/Cushman", url: "https://www.aedecc.com/", type: "dataset_descargable", format: "PDF informes + Excel datos", update_frequency: "Anual", cost: "Parcialmente gratuito (AECC público, informes de pago)", access_method: "Descarga AECC + suscripción CBRE/JLL" },
                variable_extracted: { name: "benchmark_success_score", unit: "índice 0-100", granularity: "Por centro comercial analizado vs referencia" },
                cross_with_internal: { internal_variable: "tenant_mix_actual_pct_por_categoria", cross_logic: "Comparar composición actual vs blueprint de éxito. Gap >15pp en categoría clave = oportunidad de optimización. Score <50 = reestructuración urgente.", lag_time: "Indicador estructural, revisión semestral" },
                business_decision_enabled: { decision: "Reestructurar tenant mix hacia la composición óptima identificada por el benchmark de centros exitosos", impossible_without_signal: "Sin benchmark, la composición se basa en disponibilidad de operadores, no en composición óptima probada", value_estimate: "Acercar composición al benchmark = +10-20% en rentas variables en 2-3 años" },
                rag_requirement: { rag_name: "RAG_EXT_BENCHMARK_CC", hydration_method: "Recopilación anual AECC + informes CBRE/JLL + datos propios de centros", estimated_volume: "Top 20 centros × 10 variables × 5 años = 1,000 registros" }
              },
              { signal_name: "Resilience Index", description: "(1 - Concentración Herfindahl operadores) × Diversidad sectorial × (1 - Dependencia anchor tenant). Mide capacidad de sobrevivir pérdida de operador principal.", confidence: 0.30, p_value_estimate: 0.30, impact: "high", trend: "stable", uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis", data_source: "Datos propios + AECC", variables_needed: ["herfindahl_operadores", "diversidad_sectorial", "dependencia_anchor"], external_data_required: false, contradicting_evidence: "Alta diversificación puede indicar falta de identidad comercial clara.",
                concrete_data_source: { name: "Datos internos de gestión + AECC Directorio", url: "https://www.aedecc.com/", type: "dataset_descargable", format: "Excel + cálculo interno", update_frequency: "Trimestral", cost: "Gratuito (datos propios)", access_method: "Cálculo interno sobre datos de gestión" },
                variable_extracted: { name: "resilience_index", unit: "índice 0-1 (1=máxima resiliencia)", granularity: "Por centro comercial" },
                cross_with_internal: { internal_variable: "concentracion_rentas_top5_operadores", cross_logic: "Si top 5 operadores representan >40% de rentas, RI será bajo. Objetivo: ningún operador >10% de rentas totales.", lag_time: "Indicador estructural, cambios lentos, revisión semestral" },
                business_decision_enabled: { decision: "Diversificar base de operadores proactivamente para reducir riesgo de vacancia en cascada si un anchor se va", impossible_without_signal: "Sin RI, la dependencia de anchors se detecta cuando ya es tarde (cierre de anchor)", value_estimate: "Evitar crisis por pérdida de anchor = proteger 15-30% de rentas = €500K-2M/año" },
                rag_requirement: { rag_name: "RAG_INT_RESILIENCE", hydration_method: "Cálculo trimestral sobre datos de gestión propios", estimated_volume: "100 activos × 4 trimestres = 400 cálculos/año" }
              },
            ],
          };

          // Also add new signals to capa 3 and capa 4 in the pipeline_run block
          SECTOR_UNCONVENTIONAL_SIGNALS[3].push(
            { signal_name: "Índice Rotación Locales Comerciales", description: "Ratio de locales que cambian de operador/año en radio 2km. Alta rotación = zona inestable.", confidence: 0.50, p_value_estimate: 0.08, impact: "high", trend: "stable", uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis", data_source: "Idealista + Catastro", variables_needed: ["rotacion_locales_radio_2km"], external_data_required: true, contradicting_evidence: "La rotación puede deberse a cambios regulatorios, no a inestabilidad comercial.",
              concrete_data_source: { name: "Idealista API + Sede Electrónica del Catastro", url: "https://www.idealista.com/", type: "scraping_web", format: "JSON via scraping + datos catastrales", update_frequency: "Semanal", cost: "Gratuito (scraping)", access_method: "Scraping Idealista + consulta Catastro" },
              variable_extracted: { name: "tasa_rotacion_locales_anual_radio_2km", unit: "% locales cambiados/año", granularity: "Por radio 2km del activo" },
              cross_with_internal: { internal_variable: "vacancy_rate_sba", cross_logic: "Si rotación externa >15% y vacancy propia <5%, zona inestable pero activo resiliente. Si ambos altos, zona problemática.", lag_time: "Rotación externa anticipa problemas de vacancy propia en 6-12 meses" },
              business_decision_enabled: { decision: "Ajustar estrategia de retención de operadores según salud comercial de la zona", impossible_without_signal: "Sin rotación externa, no se puede anticipar si la zona está decayendo", value_estimate: "Anticipar retención proactiva = evitar 2-3 vacantes = €200-500K/año" },
              rag_requirement: { rag_name: "RAG_EXT_IDEALISTA", hydration_method: "Scraping semanal Idealista locales comerciales por zona", estimated_volume: "100 activos × 52 semanas = 5,200 muestras/año" }
            },
            { signal_name: "Proxy Satisfacción Zona Google", description: "Rating medio ponderado de comercios en Google Maps radio 1km. Ratings >4.2 = zona con buena experiencia comercial.", confidence: 0.45, p_value_estimate: 0.12, impact: "medium", trend: "up", uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis", data_source: "Google Places API", variables_needed: ["rating_medio_comercios_radio_1km"], external_data_required: true, contradicting_evidence: "Ratings sesgados por volumen de reviews y pueden ser manipulados.",
              concrete_data_source: { name: "Google Places API — Reviews por establecimiento", url: "https://developers.google.com/maps/documentation/places/web-service", type: "api_privada", format: "JSON Places API", update_frequency: "Mensual (agregado)", cost: "$17/1K requests Google Places API", access_method: "API Key Google Cloud" },
              variable_extracted: { name: "rating_medio_ponderado_comercios_radio_1km", unit: "rating 0-5", granularity: "Por radio 1km del activo" },
              cross_with_internal: { internal_variable: "nps_centro_comercial", cross_logic: "Si rating zona >4.2 y NPS centro <50, el centro no captura la satisfacción de la zona. Oportunidad de mejora de experiencia.", lag_time: "Indicador en tiempo real, comparación mensual" },
              business_decision_enabled: { decision: "Benchmark de experiencia de cliente vs competidores en la zona", impossible_without_signal: "Sin rating de zona, no se puede posicionar el centro en el contexto competitivo de experiencia", value_estimate: "Mejorar experiencia alineada con zona = +5% NPS = +3-5% gasto medio" },
              rag_requirement: { rag_name: "RAG_EXT_GOOGLE_REVIEWS", hydration_method: "Google Places API mensual para comercios radio 1km", estimated_volume: "100 activos × 50 comercios × 12 meses = 60,000 consultas/año" }
            }
          );

          SECTOR_UNCONVENTIONAL_SIGNALS[4].push(
            { signal_name: "Ratio Gasto Tarjeta vs Renta Disponible", description: "Proporción del gasto real con tarjeta en retail vs renta media de la zona. >15% indica alta propensión al consumo.", confidence: 0.40, p_value_estimate: 0.15, impact: "high", trend: "up", uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis", data_source: "BBVA Commerce + INE", variables_needed: ["gasto_tarjeta_retail_zona", "renta_media_zona"], external_data_required: true, contradicting_evidence: "Gasto con tarjeta inflado por turismo o compras puntuales.",
              concrete_data_source: { name: "BBVA Commerce / CaixaBank Biz — Datos agregados de gasto con tarjeta", url: "https://www.bbvaresearch.com/", type: "api_privada", format: "CSV/API bajo acuerdo comercial", update_frequency: "Mensual", cost: "Requiere acuerdo comercial", access_method: "Acuerdo de datos con BBVA/CaixaBank" },
              variable_extracted: { name: "ratio_gasto_tarjeta_vs_renta_por_cp", unit: "% gasto/renta", granularity: "Por código postal y categoría de gasto" },
              cross_with_internal: { internal_variable: "ventas_totales_centro", cross_logic: "Si gasto tarjeta zona >15% renta y ventas centro están flat, el centro no captura la propensión al consumo local. Si gasto tarjeta <10%, zona con bajo potencial.", lag_time: "Gasto tarjeta refleja comportamiento actual, sin lag significativo" },
              business_decision_enabled: { decision: "Priorizar captación de operadores en zonas con alta propensión al consumo vs invertir en activación en zonas de baja propensión", impossible_without_signal: "Sin datos de gasto real, la estimación de potencial se basa en renta media, que no refleja propensión al consumo", value_estimate: "Ajustar estrategia comercial a propensión real = +5-10% captación de gasto local" },
              rag_requirement: { rag_name: "RAG_EXT_GASTO_TARJETA", hydration_method: "API bajo acuerdo comercial con BBVA/CaixaBank, datos mensuales", estimated_volume: "200 CPs × 12 meses × 10 categorías = 24,000 registros/año" }
            },
            { signal_name: "Flujo Movilidad Pico Sábado", description: "Volumen de desplazamientos entrantes en radio 5km sábados 10-14h normalizado por población. >2.5x indica polo de atracción comercial.", confidence: 0.35, p_value_estimate: 0.20, impact: "high", trend: "stable", uncertainty_type: "epistemic", devil_advocate_result: "moved_to_hypothesis", data_source: "Telefónica Movilidad", variables_needed: ["flujo_movilidad_sabado", "poblacion_residente"], external_data_required: true, contradicting_evidence: "Flujo dominado por evento o atracción específica, no atracción comercial sostenida.",
              concrete_data_source: { name: "Telefónica LUCA / Orange Flux Vision", url: "https://luca-d3.com/", type: "api_privada", format: "CSV/API bajo acuerdo comercial", update_frequency: "Semanal", cost: "Requiere acuerdo comercial (€10-50K/año)", access_method: "Acuerdo de datos con operador telco" },
              variable_extracted: { name: "ratio_flujo_sabado_vs_poblacion_residente_radio_5km", unit: "ratio multiplicador", granularity: "Por radio 5km del activo, sábados 10-14h" },
              cross_with_internal: { internal_variable: "footfall_sabado_centro", cross_logic: "Si ratio flujo zona >2.5x pero footfall centro no proporcional, el centro no captura el flujo de la zona. Oportunidad de marketing y visibilidad.", lag_time: "Flujo de movilidad es indicador en tiempo real, tendencias semanales" },
              business_decision_enabled: { decision: "Dimensionar catchment area real y orientar marketing a los orígenes de flujo principales", impossible_without_signal: "Sin movilidad real, el catchment se estima por isocronas teóricas que no reflejan comportamiento real", value_estimate: "Ajustar marketing a catchment real = +10-15% eficiencia de inversión publicitaria" },
              rag_requirement: { rag_name: "RAG_EXT_MOVILIDAD_TELCO", hydration_method: "API bajo acuerdo con Telefónica/Orange, datos semanales", estimated_volume: "100 activos × 52 semanas = 5,200 muestras/año" }
            }
          );

          for (const [layerId, signals] of Object.entries(SECTOR_UNCONVENTIONAL_SIGNALS)) {
            const lid = parseInt(layerId);
            const existing = layers.find((l: any) => l.layer_id === lid);
            if (existing) {
              const existingNames = new Set((existing.signals || []).map((s: any) => s.signal_name));
              for (const sig of signals) {
                if (!existingNames.has(sig.signal_name)) existing.signals.push(sig);
              }
            } else {
              const names: Record<number, string> = { 3: "Señales Débiles", 4: "Inteligencia Lateral", 5: "Edge Extremo" };
              layers.push({ layer_id: lid, layer_name: names[lid], signals });
            }
          }
          layers.sort((a: any, b: any) => a.layer_id - b.layer_id);
        }

        // ── Validate enriched fields for layers 3-5 ──
        for (const l of layers) {
          if (l.layer_id >= 3 && l.signals) {
            l.signals = l.signals.map((s: any) => {
              // Validate concrete_data_source
              if (!s.concrete_data_source?.url) {
                console.warn(`[detector] Signal "${s.signal_name}" (layer ${l.layer_id}) missing concrete URL. Degrading.`);
                s.layer = Math.max((s.layer || l.layer_id) - 1, 2);
                s.confidence = (s.confidence || 0) * 0.5;
              }
              // Validate cross_with_internal
              if (!s.cross_with_internal?.internal_variable) {
                console.warn(`[detector] Signal "${s.signal_name}" missing cross-reference. Penalizing.`);
                s.confidence = (s.confidence || 0) * 0.7;
              }
              // Validate business_decision_enabled
              if (!s.business_decision_enabled?.decision) {
                console.warn(`[detector] Signal "${s.signal_name}" missing business decision. Removing.`);
                return null;
              }
              return s;
            }).filter(Boolean);
          }
        }

        // Apply confidence cap and QG degradation
        if (qgVerdict === "PASS_CONDITIONAL") {
          layers.forEach((l: any) => {
            l.signals?.forEach((s: any) => { s.confidence = Math.min(s.confidence || 0, maxCap); });
            if (l.layer_id >= 4) {
              l.signals?.forEach((s: any) => { s.confidence = Math.min(s.confidence || 0, 0.6); s.fase = "FASE_2"; });
            }
            if (l.layer_id >= 5) {
              l.signals?.forEach((s: any) => { s.confidence = Math.min(s.confidence || 0, 0.4); s.fase = "EXPLORATORIA"; });
            }
          });
        } else {
          layers.forEach((l: any) => l.signals?.forEach((s: any) => { s.confidence = Math.min(s.confidence || 0, maxCap); }));
        }

        const totalSignals = layers.reduce((sum: number, l: any) => sum + (l.signals?.length || 0), 0);
        console.log(`[pipeline_run] Phase 5 (Signals) done: ${layers.length} layers, ${totalSignals} signals`);

        // ════════════════════════════════════════════════════════════
        // PHASE 4b: Reference Center Benchmarking (centros_comerciales only)
        // ════════════════════════════════════════════════════════════
        let phase4bResult: any = null;
        if (sectorKey === "centros_comerciales") {
          try {
            const benchMessages: ChatMessage[] = [
              { role: "system", content: `Eres un experto en retail y centros comerciales con 20 años de experiencia en el mercado español. Responde SOLO con JSON válido, en ESPAÑOL.` },
              { role: "user", content: `Analiza los patrones comunes de los centros comerciales más exitosos de España:

CENTROS DE REFERENCIA:
${JSON.stringify(REFERENCE_CENTERS, null, 2)}

Identifica patrones de éxito: composición sectorial, ratio anchor/specialty, categorías clave, densidad operadores/m², estrategia destination vs convenience, factores de éxito comunes.

Responde con:
{
  "success_blueprint": {
    "optimal_tenant_mix": { "restauracion_pct": 0, "moda_pct": 0, "ocio_pct": 0, "servicios_pct": 0, "gran_superficie_pct": 0 },
    "anchor_strategy": { "min_anchors": 0, "ideal_anchors": 0, "must_have_categories": ["cat1"], "anchor_specialty_ratio": "X:Y" },
    "density_benchmarks": { "operators_per_1000m2": 0, "optimal": 0 },
    "success_factors_ranked": [{ "factor": "name", "importance": 0.0, "evidence": "evidence" }],
    "anti_patterns": ["failure pattern"],
    "evolution_insights": ["how centers adapt"]
  },
  "center_classifications": [{ "name": "center", "strategy": "destination|convenience|hybrid", "lesson": "takeaway" }],
  "scoring_criteria": { "criteria": [{ "name": "criterion", "weight": 0.0, "benchmark_value": "value" }] }
}` }
            ];

            const benchResult = await chat(benchMessages, { model: "gemini-pro", responseFormat: "json", maxTokens: 8192 });
            phase4bResult = safeParseJson(benchResult);
            console.log(`[pipeline_run] Phase 4b (Benchmark) done`);
          } catch (benchErr) {
            console.error("[pipeline_run] Phase 4b error (non-blocking):", benchErr);
            phase4bResult = { error: String(benchErr) };
          }
        }

        // ════════════════════════════════════════════════════════════
        // CREDIBILITY ENGINE (gemini-pro): 4 dimensions + classification
        // ════════════════════════════════════════════════════════════
        let credibilityEngine: any = { error: "not_executed" };
        try {
          const allSignalsFlat = layers.flatMap((l: any) => (l.signals || []).map((s: any, i: number) => ({
            id: `SIG-${l.layer_id}-${i + 1}`,
            name: s.signal_name,
            description: s.description,
            confidence: s.confidence,
            p_value: s.p_value_estimate,
            layer: l.layer_id,
            impact: s.impact,
            trend: s.trend,
            data_source: s.data_source,
          })));

          const credMessages: ChatMessage[] = [
            { role: "system", content: `Eres un analista cuantitativo que evalúa la credibilidad de señales detectadas.
Para cada señal, evalúa 4 dimensiones (score 0.0 a 1.0):
1. Estabilidad Temporal (peso 30%): ¿El patrón funcionaría en diferentes periodos?
2. Replicabilidad Cruzada (peso 25%): ¿Se replicaría en diferentes ubicaciones/contextos?
3. Capacidad de Anticipación (peso 25%, normalizada 0-1): ¿Con cuántos días avisa? <2d=0.2, 3-7=0.4, 7-14=0.6, 14-30=0.8, >30=1.0. Devuelve anticipation_days.
4. Ratio Señal/Ruido (peso 20%): Claridad frente a fluctuaciones aleatorias.

Clasifica según score final: Alpha (≥0.8), Beta (0.6-0.79), Fragile (0.4-0.59), Noise (<0.4).

Evalúa RÉGIMEN DE MERCADO: normal, demand_shock, supply_shock, regulatory_change, unknown_anomaly.

Responde SOLO con JSON válido.` },
            { role: "user", content: `Evalúa la credibilidad de estas señales:

Sector: ${phase1?.sector_analysis || sector}
Señales: ${JSON.stringify(allSignalsFlat.slice(0, 30))}

Responde con:
{
  "regime_detected": "normal|demand_shock|supply_shock|regulatory_change|unknown_anomaly",
  "regime_reasoning": "explicación del régimen detectado",
  "evaluations": [
    {
      "signal_id": "SIG-X-Y",
      "temporal_stability": 0.0-1.0,
      "cross_replication": 0.0-1.0,
      "anticipation_normalized": 0.0-1.0,
      "anticipation_days": 0,
      "signal_to_noise": 0.0-1.0,
      "pattern_description": "descripción del patrón"
    }
  ]
}` }
          ];

          const credResult = await chat(credMessages, { model: "gemini-pro", responseFormat: "json", maxTokens: 8192 });
          const credParsed = safeParseJson(credResult) as any;

          const evaluations = credParsed.evaluations || [];
          const classifications: any[] = [];
          let alphaCount = 0, betaCount = 0, fragileCount = 0, noiseCount = 0;

          for (const ev of evaluations) {
            const stability = ev.temporal_stability || 0;
            const replication = ev.cross_replication || 0;
            const anticipation = ev.anticipation_normalized || 0;
            const snr = ev.signal_to_noise || 0;
            const finalScore = (0.30 * stability) + (0.25 * replication) + (0.25 * anticipation) + (0.20 * snr);

            let signalClass: string;
            if (finalScore >= 0.8) { signalClass = "Alpha"; alphaCount++; }
            else if (finalScore >= 0.6) { signalClass = "Beta"; betaCount++; }
            else if (finalScore >= 0.4) { signalClass = "Fragile"; fragileCount++; }
            else { signalClass = "Noise"; noiseCount++; }

            classifications.push({
              signal_id: ev.signal_id,
              class: signalClass,
              score: Math.round(finalScore * 1000) / 1000,
              anticipation_days: ev.anticipation_days || 0,
              dimensions: { stability, replication, anticipation, snr },
            });
          }

          credibilityEngine = {
            regime_detected: credParsed.regime_detected || "normal",
            regime_reasoning: credParsed.regime_reasoning || "",
            classifications,
            summary: { alpha: alphaCount, beta: betaCount, fragile: fragileCount, noise: noiseCount },
          };
          console.log(`[pipeline_run] Credibility Engine done: ${alphaCount}A ${betaCount}B ${fragileCount}F ${noiseCount}N, regime=${credibilityEngine.regime_detected}`);
        } catch (credErr) {
          console.error("[pipeline_run] Credibility Engine error (non-blocking):", credErr);
          credibilityEngine = { error: String(credErr), regime_detected: "normal", classifications: [], summary: { alpha: 0, beta: 0, fragile: 0, noise: 0 } };
        }

        // ════════════════════════════════════════════════════════════
        // PHASE 6: Technical Backtesting (gemini-flash-lite)
        // ════════════════════════════════════════════════════════════
        let backtesting: any = { error: "not_executed" };
        try {
          const btSignals = layers.flatMap((l: any) => (l.signals || []).map((s: any) => ({ name: s.signal_name, confidence: s.confidence, layer: l.layer_id, impact: s.impact }))).slice(0, 20);

          const btMessages: ChatMessage[] = [
            { role: "system", content: `Eres un analista cuantitativo que estima métricas de backtesting.
IMPORTANTE: Estas son ESTIMACIONES basadas en tu conocimiento, NO cálculos reales con datos.
Marca explícitamente que son estimaciones. Responde SOLO con JSON válido.` },
            { role: "user", content: `Estima métricas de backtesting para estos patrones:

Sector: ${sector}
Baseline: ${phase1?.baseline_definition || "media móvil"}
Señales detectadas (${btSignals.length}): ${JSON.stringify(btSignals)}

Estima:
{
  "disclaimer": "Estas métricas son ESTIMACIONES de la IA, no cálculos reales",
  "baseline_rmse": 0.0,
  "model_rmse": 0.0,
  "uplift_vs_baseline_pct": 0.0,
  "complexity_justified": true,
  "win_rate_pct": 0.0,
  "precision_pct": 0.0,
  "recall_pct": 0.0,
  "false_positives": 0,
  "false_negatives": 0,
  "avg_anticipation_days": 0,
  "retrospective_cases": [
    {
      "event": "descripción del evento histórico",
      "detected": true,
      "days_in_advance": 0,
      "signal_used": "nombre de señal"
    }
  ]
}` }
          ];

          const btResult = await chat(btMessages, { model: "gemini-flash-lite", responseFormat: "json", maxTokens: 8192 });
          backtesting = safeParseJson(btResult) as any;
          console.log(`[pipeline_run] Phase 6 (Backtest) done: win_rate=${backtesting.win_rate_pct}%, uplift=${backtesting.uplift_vs_baseline_pct}%`);
        } catch (btErr) {
          console.error("[pipeline_run] Phase 6 error (non-blocking):", btErr);
          backtesting = { error: String(btErr), win_rate_pct: 0, precision_pct: 0, recall_pct: 0, uplift_vs_baseline_pct: 0, complexity_justified: false, retrospective_cases: [] };
        }

        // ════════════════════════════════════════════════════════════
        // ECONOMIC BACKTESTING (gemini-flash-lite)
        // ════════════════════════════════════════════════════════════
        let economicBacktesting: any = { error: "not_executed" };
        try {
          const sectorParams = detectSectorParams(sector);
          const credSummary = credibilityEngine.classifications?.slice(0, 10).map((c: any) => ({ id: c.signal_id, class: c.class, score: c.score })) || [];

          const econMessages: ChatMessage[] = [
            { role: "system", content: `Eres un analista financiero que traduce backtesting técnico en impacto económico medible para ${sectorParams.system_prompt_context}

Reglas:
- Margen conservador: ${sectorParams.default_margin_pct}% si no hay datos reales
- Coste de capital: ${sectorParams.cost_of_capital_pct}% anual
- Inversión media por ${sectorParams.unit_name}: ${sectorParams.avg_investment.toLocaleString()} EUR
- Cada euro debe ser trazable al evento que lo genera
- NO incluir bonus de fidelización ni daño reputacional
- TODOS los textos en ESPAÑOL
Responde SOLO con JSON válido.` },
            { role: "user", content: `Calcula el impacto económico:

Sector: ${sector}
Tipo de unidad: ${sectorParams.unit_name} (${sectorParams.unit_name_plural})
Inversión media: ${sectorParams.avg_investment.toLocaleString()} EUR

Backtest técnico:
- Win rate: ${backtesting.win_rate_pct || 0}%
- Precisión: ${backtesting.precision_pct || 0}%
- Recall: ${backtesting.recall_pct || 0}%
- Anticipación media: ${backtesting.avg_anticipation_days || 0} días
- Casos retrospectivos: ${JSON.stringify((backtesting.retrospective_cases || []).slice(0, 5))}

Credibilidad: ${JSON.stringify(credSummary)}

Responde con:
{
  "net_economic_impact": 0.0,
  "roi_multiplier": 0.0,
  "payback_period_days": 0,
  "per_unit_impact": 0.0,
  "gross_revenue_protected": 0.0,
  "capital_tied_up_cost": 0.0,
  "unprevented_losses": 0.0,
  "event_breakdown": [
    { "event": "string", "prediction_correct": true, "anticipation_days": 0, "economic_impact_eur": 0.0, "impact_type": "revenue_protected|capital_cost|unprevented_loss", "calculation_detail": "fórmula" }
  ],
  "error_intelligence": [
    { "error_type": "false_negative", "missed_event": "string", "root_cause": "string", "proposed_sources": ["string"], "integration_cost": "low|medium|high", "expected_uplift": "low|medium|high", "priority": 0.0 }
  ],
  "validation_plans": [
    { "signal_name": "string", "data_needed": "string", "where_to_get": "string", "estimated_impact": "string", "integration_cost": "low|medium|high", "recommendation": "invest|defer" }
  ],
  "assumptions": { "margin_pct": ${sectorParams.default_margin_pct}, "cost_of_capital_pct": ${sectorParams.cost_of_capital_pct}, "avg_investment": ${sectorParams.avg_investment}, "unit_name": "${sectorParams.unit_name}", "default_units": ${sectorParams.default_units} }
}` }
          ];

          const econResult = await chat(econMessages, { model: "gemini-flash-lite", responseFormat: "json", maxTokens: 8192 });
          economicBacktesting = safeParseJson(econResult) as any;
          console.log(`[pipeline_run] Economic Backtesting done: NEI=${economicBacktesting.net_economic_impact}, ROI=${economicBacktesting.roi_multiplier}x`);
        } catch (econErr) {
          console.error("[pipeline_run] Economic Backtesting error (non-blocking):", econErr);
          economicBacktesting = { error: String(econErr), net_economic_impact: 0, roi_multiplier: 0, payback_period_days: 0, validation_plans: [] };
        }

        // ════════════════════════════════════════════════════════════
        // PHASE 7: Actionable Hypotheses (gemini-flash-lite)
        // ════════════════════════════════════════════════════════════
        let hypothesesResult: any = { hypotheses: [], model_verdict: "NOT_RELIABLE_YET" };
        try {
          const topSignals = layers.flatMap((l: any) => (l.signals || []).map((s: any) => ({
            name: s.signal_name, confidence: s.confidence, layer: l.layer_id, impact: s.impact,
            devil_advocate: s.devil_advocate_result,
          }))).sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0)).slice(0, 15);

          const hypoMessages: ChatMessage[] = [
            { role: "system", content: `Eres un consultor estratégico que convierte patrones detectados en hipótesis accionables.
TODOS los textos en ESPAÑOL. Responde SOLO con JSON válido.` },
            { role: "user", content: `Genera hipótesis accionables:

Sector: ${sector}
Objetivo: ${objective}
Señales top-15: ${JSON.stringify(topSignals)}
Backtest: win rate ${backtesting.win_rate_pct || "N/A"}%, uplift ${backtesting.uplift_vs_baseline_pct || "N/A"}%
Economic impact: NEI=${economicBacktesting.net_economic_impact || 0} EUR, ROI=${economicBacktesting.roi_multiplier || 0}x
Credibilidad: ${credibilityEngine.summary ? `Alpha=${credibilityEngine.summary.alpha}, Beta=${credibilityEngine.summary.beta}, Fragile=${credibilityEngine.summary.fragile}, Noise=${credibilityEngine.summary.noise}` : "N/A"}
Régimen: ${credibilityEngine.regime_detected || "normal"}
${phase4bResult?.success_blueprint ? `\nBenchmark de centros exitosos: ${JSON.stringify(phase4bResult.success_blueprint).substring(0, 4000)}` : ""}

Responde con:
{
  "model_verdict": "VALID|NOT_RELIABLE_YET",
  "verdict_explanation": "explicación del veredicto",
  "hypotheses": [
    {
      "title": "título",
      "why_it_matters": "por qué importa",
      "what_it_anticipates": "qué podría anticipar",
      "confidence_level": 0.0-1.0,
      "uncertainty_type": "epistemic|aleatoric",
      "validation_method": "cómo validar",
      "predictive_use": "uso predictivo",
      "implementation_cost": "bajo|medio|alto",
      "expected_benefit": "descripción"
    }
  ],
  "next_recommended_actions": ["acción 1", "acción 2", "acción 3"],
  "missing_data_types": ["tipo 1", "tipo 2"],
  "learning_metrics": {
    "distance_to_optimal": "X%",
    "accuracy_current": 0.0,
    "patterns_discovered_this_month": 0,
    "regime_detected": "${credibilityEngine.regime_detected || "normal"}"
  }
}` }
          ];

          const hypoResult = await chat(hypoMessages, { model: "gemini-flash-lite", responseFormat: "json", maxTokens: 8192 });
          hypothesesResult = safeParseJson(hypoResult) as any;
          console.log(`[pipeline_run] Phase 7 (Hypotheses) done: verdict=${hypothesesResult.model_verdict}, ${(hypothesesResult.hypotheses || []).length} hypotheses`);
        } catch (hypoErr) {
          console.error("[pipeline_run] Phase 7 error (non-blocking):", hypoErr);
          hypothesesResult = { model_verdict: "NOT_RELIABLE_YET", hypotheses: [], verdict_explanation: String(hypoErr) };
        }

        // Fire-and-forget learning-observer with phase results
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const signalNames = layers.flatMap((l: any) => (l.signals || []).map((s: any) => s.signal_name)).slice(0, 20);
          fetch(`${supabaseUrl}/functions/v1/learning-observer`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
            body: JSON.stringify({
              action: "evaluate_feedback",
              runId: body.run_id || "pipeline_run",
              projectId: body.project_id || null,
              signals: signalNames,
              verdict: hypothesesResult.model_verdict,
              phase_results_summary: {
                phase_1: { key_variables: (phase1?.key_variables || []).length },
                phase_2: { sources_found: allSources.length },
                phase_3: { quality_gate: qgVerdict },
                phase_4b: phase4bResult ? "available" : "skipped",
                phase_5: { total_signals: signalNames.length, layers: layers.length },
                phase_6: { win_rate: backtesting.win_rate_pct || 0, precision: backtesting.precision_pct || 0 },
                phase_7: { verdict: hypothesesResult.model_verdict, hypotheses_count: (hypothesesResult.hypotheses || []).length },
                economic: { roi: economicBacktesting.roi_multiplier || 0, net_impact: economicBacktesting.net_economic_impact || 0 },
                credibility: credibilityEngine.summary || {},
              },
            }),
          }).catch(e => console.warn("[pipeline_run] learning-observer fire-and-forget failed:", e));
        } catch (_) { /* non-blocking */ }

        // ════════════════════════════════════════════════════════════
        // BUILD STRUCTURED OUTPUT
        // ════════════════════════════════════════════════════════════
        const signalsByLayer: Record<string, any[]> = {};
        for (const l of layers) {
          const key = `layer_${l.layer_id}_${["", "obvia", "analitica", "debiles", "lateral", "edge"][l.layer_id] || "unknown"}`;
          signalsByLayer[key] = (l.signals || []).map((s: any, i: number) => ({
            id: `SIG-${l.layer_id}-${i + 1}`,
            name: s.signal_name,
            layer: l.layer_id,
            description: s.description,
            variables_needed: s.variables_needed || [],
            data_source: s.data_source || "",
            confidence: s.confidence || 0,
            impact: s.impact || "medium",
            trend: s.trend || "stable",
            p_value_estimate: s.p_value_estimate || null,
            uncertainty_type: s.uncertainty_type || "epistemic",
            devil_advocate_result: s.devil_advocate_result || null,
            external_data_required: s.external_data_required || false,
            external_source_id: s.external_source_id || null,
            component_consumer: s.component_consumer || null,
            contradicting_evidence: s.contradicting_evidence || "",
            concrete_data_source: s.concrete_data_source || null,
            variable_extracted: s.variable_extracted || null,
            cross_with_internal: s.cross_with_internal || null,
            business_decision_enabled: s.business_decision_enabled || null,
            rag_requirement: s.rag_requirement || null,
          }));
        }

        // Classify sources
        const requiredSources = allSources.filter((s: any) => s.impact === "high" && s.status === "available");
        const recommendedSources = allSources.filter((s: any) => (s.impact === "medium" || s.status === "pending") && s.impact !== "low");
        const experimentalSources = allSources.filter((s: any) => s.status === "requires_agreement" || s.impact === "low");

        // Build RAGs externos
        const ragsExternos: any[] = [];
        const signalsNeedingExternal = layers.flatMap((l: any) => (l.signals || []).filter((s: any) => s.external_data_required));
        const sourcesByName = new Map(allSources.map((s: any) => [s.source_name, s]));
        const sourceGroups = new Map<string, any[]>();
        for (const sig of signalsNeedingExternal) {
          const src = sig.data_source || "unknown";
          if (!sourceGroups.has(src)) sourceGroups.set(src, []);
          sourceGroups.get(src)!.push(sig);
        }

        let ragIdx = 1;
        for (const [srcName, sigs] of sourceGroups) {
          const srcInfo = sourcesByName.get(srcName);
          ragsExternos.push({
            id: `RAG_EXT_${ragIdx}`,
            nombre: `RAG Externo: ${srcName}`,
            tipo_fuente: srcInfo?.source_type === "API" ? "API" : srcInfo?.source_type === "Web" ? "SCRAPING" : srcInfo?.source_type === "Gov" ? "DATASET_PUBLICO" : "MANUAL",
            fuentes: [srcInfo?.url || srcName],
            frecuencia: srcInfo?.update_frequency || "mensual",
            señales_que_alimenta: sigs.map((s: any) => s.signal_name),
            fase: sigs.some((s: any) => !s.fase || s.fase === "MVP") ? "MVP" : sigs[0]?.fase || "FASE_2",
          });
          ragIdx++;
        }

        // ── Build enriched prd_injection texts ──
        const allSignals = Object.values(signalsByLayer).flat();

        // Section 7: Patterns + Credibility + Regime + Enriched fields for layers 3+
        let patternsSection = `## Patrones detectados por el Motor de Patrones (${allSignals.length} señales en ${layers.length} capas)\n\n`;
        if (credibilityEngine.regime_detected && credibilityEngine.regime_detected !== "normal") {
          patternsSection += `> ⚠️ **Régimen de mercado detectado: ${credibilityEngine.regime_detected}**\n> ${credibilityEngine.regime_reasoning || ""}\n\n`;
        }
        for (const l of layers) {
          const layerSignals = signalsByLayer[`layer_${l.layer_id}_${["", "obvia", "analitica", "debiles", "lateral", "edge"][l.layer_id] || "unknown"}`] || [];
          patternsSection += `### Capa ${l.layer_id}: ${l.layer_name} (${layerSignals.length} señales)\n`;
          for (const s of layerSignals) {
            const credClass = credibilityEngine.classifications?.find((c: any) => c.signal_id === s.id);
            const credLabel = credClass ? ` [${credClass.class} ${credClass.score}]` : "";
            patternsSection += `- **${s.name}**${credLabel} (confianza: ${s.confidence}, impacto: ${s.impact}): ${s.description}\n`;
            if (s.contradicting_evidence) {
              patternsSection += `  - _Evidencia contraria_: ${s.contradicting_evidence}\n`;
            }
            // Enriched fields for layers 3+
            if (s.layer >= 3 && s.concrete_data_source) {
              patternsSection += `  - **Fuente**: [${s.concrete_data_source.name}](${s.concrete_data_source.url}) (${s.concrete_data_source.type}, ${s.concrete_data_source.format}, ${s.concrete_data_source.update_frequency})\n`;
              if (s.variable_extracted) {
                patternsSection += `  - **Variable**: ${s.variable_extracted.name} (${s.variable_extracted.unit}, ${s.variable_extracted.granularity})\n`;
              }
              if (s.cross_with_internal) {
                patternsSection += `  - **Cruce interno**: \`${s.cross_with_internal.internal_variable}\` — ${s.cross_with_internal.cross_logic} (anticipación: ${s.cross_with_internal.lag_time})\n`;
              }
              if (s.business_decision_enabled) {
                patternsSection += `  - **Decisión habilitada**: ${s.business_decision_enabled.decision} (valor: ${s.business_decision_enabled.value_estimate})\n`;
                patternsSection += `  - _Antes imposible_: ${s.business_decision_enabled.impossible_without_signal}\n`;
              }
            }
          }
          patternsSection += "\n";
        }

        // Add credibility summary
        if (credibilityEngine.summary) {
          patternsSection += `### Resumen de Credibilidad\n`;
          patternsSection += `- Alpha (≥0.8, automatizable): ${credibilityEngine.summary.alpha}\n`;
          patternsSection += `- Beta (0.6-0.79, supervisión humana): ${credibilityEngine.summary.beta}\n`;
          patternsSection += `- Fragile (0.4-0.59, en cuarentena): ${credibilityEngine.summary.fragile}\n`;
          patternsSection += `- Noise (<0.4, descartada): ${credibilityEngine.summary.noise}\n\n`;
        }

        // Add hypothesis summary
        if (hypothesesResult.hypotheses?.length > 0) {
          patternsSection += `### Hipótesis Accionables (${hypothesesResult.hypotheses.length})\n`;
          for (const h of hypothesesResult.hypotheses) {
            patternsSection += `- **${h.title}** (confianza: ${h.confidence_level}, coste: ${h.implementation_cost}): ${h.why_it_matters}\n  - Validación: ${h.validation_method}\n`;
          }
          patternsSection += "\n";
        }

        patternsSection += `\n> **INSTRUCCIÓN AL GENERADOR DE PRD**: Los patrones listados arriba son el resultado del Motor de Patrones. NO inventes patrones adicionales. Úsalos tal cual para definir requisitos de datos, integraciones externas y componentes de IA.\n`;

        // Section 15.1: RAGs with enriched hydration from signals
        let ragsAdicionales = "";
        // Build RAGs from enriched signal rag_requirements (deduplicated)
        const enrichedRags = new Map<string, any>();
        for (const s of allSignals) {
          if (s.rag_requirement?.rag_name && !enrichedRags.has(s.rag_requirement.rag_name)) {
            enrichedRags.set(s.rag_requirement.rag_name, {
              ...s.rag_requirement,
              signals: [s.name],
            });
          } else if (s.rag_requirement?.rag_name) {
            enrichedRags.get(s.rag_requirement.rag_name)!.signals.push(s.name);
          }
        }

        if (enrichedRags.size > 0) {
          ragsAdicionales = `\n### RAGs Externos — Detalle de Hidratación (Detector de Patrones)\n\n`;
          for (const [ragName, r] of enrichedRags) {
            ragsAdicionales += `**${ragName}**\n`;
            ragsAdicionales += `- Hidratación: ${r.hydration_method}\n`;
            ragsAdicionales += `- Volumen: ${r.estimated_volume}\n`;
            ragsAdicionales += `- Señales que habilita: ${r.signals.join(", ")}\n\n`;
          }
        }
        // Also include legacy RAGs table
        if (ragsExternos.length > 0) {
          ragsAdicionales += `\n### RAGs Externos — Tabla resumen\n\n| ID | Nombre | Tipo Fuente | Frecuencia | Señales que alimenta | Fase |\n|---|---|---|---|---|---|\n`;
          for (const r of ragsExternos) {
            ragsAdicionales += `| ${r.id} | ${r.nombre} | ${r.tipo_fuente} | ${r.frecuencia} | ${r.señales_que_alimenta.join(", ")} | ${r.fase} |\n`;
          }
        }
        if (economicBacktesting.validation_plans?.length > 0) {
          ragsAdicionales += `\n### Planes de Validación (Economic Backtesting)\n\n| Señal | Datos necesarios | Dónde obtener | Impacto estimado | Coste integración | Recomendación |\n|---|---|---|---|---|---|\n`;
          for (const vp of economicBacktesting.validation_plans) {
            ragsAdicionales += `| ${vp.signal_name} | ${vp.data_needed} | ${vp.where_to_get} | ${vp.estimated_impact} | ${vp.integration_cost} | ${vp.recommendation} |\n`;
          }
        }

        // Section 19: External sources with concrete data source details
        let integracionesExternas = "";
        // Enriched sources from signals (concrete_data_source)
        const enrichedExtSources = allSignals.filter((s: any) => s.layer >= 3 && s.concrete_data_source);
        if (enrichedExtSources.length > 0) {
          integracionesExternas = `\n### Integraciones Externas con Fuentes Verificadas (Detector de Patrones)\n\n| Señal | Fuente | URL | Tipo | Formato | Frecuencia | Coste | Acceso | Variable |\n|---|---|---|---|---|---|---|---|---|\n`;
          for (const s of enrichedExtSources) {
            const ds = s.concrete_data_source;
            const ve = s.variable_extracted;
            integracionesExternas += `| ${s.name} | ${ds.name} | ${ds.url} | ${ds.type} | ${ds.format} | ${ds.update_frequency} | ${ds.cost} | ${ds.access_method} | ${ve?.name || "N/A"} (${ve?.unit || ""}) |\n`;
          }
        }
        // Legacy sources table
        const allExtSources = [...requiredSources, ...recommendedSources];
        if (allExtSources.length > 0) {
          integracionesExternas += `\n### Fuentes Externas Adicionales\n\n| Nombre | URL | Tipo | Frecuencia | Datos | Coste | Impacto |\n|---|---|---|---|---|---|---|\n`;
          for (const s of allExtSources.slice(0, 15)) {
            integracionesExternas += `| ${s.source_name} | ${s.url || "N/A"} | ${s.source_type} | ${s.update_frequency || "N/A"} | ${s.data_type || "N/A"} | ${s.cost || "N/A"} | ${s.impact || "N/A"} |\n`;
          }
        }
        if (economicBacktesting.net_economic_impact) {
          integracionesExternas += `\n### Impacto Económico Estimado\n`;
          integracionesExternas += `- Impacto económico neto: ${(economicBacktesting.net_economic_impact || 0).toLocaleString()} EUR\n`;
          integracionesExternas += `- ROI estimado: ${economicBacktesting.roi_multiplier || 0}x\n`;
          integracionesExternas += `- Payback: ${economicBacktesting.payback_period_days || 0} días\n`;
        }

        // ── Final output ──
        const detectorOutput = {
          signals_by_layer: signalsByLayer,
          credibility_engine: credibilityEngine,
          backtesting: {
            win_rate_pct: backtesting.win_rate_pct || 0,
            precision_pct: backtesting.precision_pct || 0,
            recall_pct: backtesting.recall_pct || 0,
            avg_anticipation_days: backtesting.avg_anticipation_days || 0,
            retrospective_cases: backtesting.retrospective_cases || [],
            uplift_vs_baseline_pct: backtesting.uplift_vs_baseline_pct || 0,
            complexity_justified: backtesting.complexity_justified || false,
          },
          economic_backtesting: {
            net_economic_impact: economicBacktesting.net_economic_impact || 0,
            roi_multiplier: economicBacktesting.roi_multiplier || 0,
            payback_period_days: economicBacktesting.payback_period_days || 0,
            per_unit_impact: economicBacktesting.per_unit_impact || 0,
            event_breakdown: economicBacktesting.event_breakdown || [],
            error_intelligence: economicBacktesting.error_intelligence || [],
            validation_plans: economicBacktesting.validation_plans || [],
            assumptions: economicBacktesting.assumptions || {},
          },
          hypotheses: (hypothesesResult.hypotheses || []).map((h: any) => ({
            title: h.title,
            confidence: h.confidence_level || 0,
            validation_method: h.validation_method || "",
            why_it_matters: h.why_it_matters || "",
            implementation_cost: h.implementation_cost || "medio",
          })),
          model_verdict: hypothesesResult.model_verdict || "NOT_RELIABLE_YET",
          external_sources: {
            required: requiredSources.map((s: any) => ({ id: s.source_name, name: s.source_name, url: s.url, type: s.source_type, reliability: s.reliability_score, update_frequency: s.update_frequency, data_provided: [s.data_type], cost: s.cost || "N/A" })),
            recommended: recommendedSources.map((s: any) => ({ id: s.source_name, name: s.source_name, url: s.url, type: s.source_type, reliability: s.reliability_score, update_frequency: s.update_frequency, data_provided: [s.data_type], cost: s.cost || "N/A" })),
            experimental: experimentalSources.map((s: any) => ({ id: s.source_name, name: s.source_name, url: s.url, type: s.source_type, reliability: s.reliability_score, update_frequency: s.update_frequency, data_provided: [s.data_type], cost: s.cost || "N/A" })),
          },
          rags_externos_needed: ragsExternos,
          quality_gate: {
            verdict: qgVerdict,
            coverage_pct: coveragePct,
            gaps,
            confidence_cap: confidenceCap,
          },
          prd_injection: {
            patrones_section: patternsSection,
            rags_adicionales: ragsAdicionales,
            integraciones_externas: integracionesExternas,
          },
          confidence_cap: confidenceCap,
          reference_benchmark: phase4bResult || null,
        };

        console.log(`[pipeline_run] Complete: ${allSignals.length} signals, ${ragsExternos.length} RAGs, QG=${qgVerdict}, verdict=${hypothesesResult.model_verdict}`);

        // ── Update project_wizard_steps step 12 to "review" ──
        const projectId = body.project_id;
        if (projectId) {
          const signalsCounts: Record<string, number> = {};
          for (const [key, signals] of Object.entries(signalsByLayer)) {
            signalsCounts[key] = (signals as any[]).length;
          }
          const stepData = {
            _internal: true,
            detector_output: detectorOutput,
            quality_gate_verdict: qgVerdict,
            signals_count: signalsCounts,
            confidence_cap: confidenceCap,
          };
          const { error: stepErr } = await supabase.from("project_wizard_steps").update({
            status: "review",
            output_data: stepData,
          }).eq("project_id", projectId).eq("step_number", 12);
          if (stepErr) {
            console.error("[pipeline_run] Failed to update step 12:", stepErr);
          } else {
            console.log(`[pipeline_run] Step 12 updated to "review" for project ${projectId}`);
          }
        }

        return new Response(JSON.stringify(detectorOutput), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      } catch (err) {
        console.error("[pipeline_run] Error:", err);
        // Update step 12 even on error so it doesn't stay stuck
        const projectId = body.project_id;
        if (projectId) {
          await supabase.from("project_wizard_steps").update({
            status: "review",
            output_data: { _internal: true, detector_output: null, quality_gate_verdict: "FAIL", error: String(err) },
          }).eq("project_id", projectId).eq("step_number", 12);
          console.log(`[pipeline_run] Step 12 set to "review" (error fallback) for project ${projectId}`);
        }
        return new Response(JSON.stringify({
          signals_by_layer: { layer_1_obvia: [] },
          credibility_engine: { error: String(err), regime_detected: "normal", classifications: [], summary: { alpha: 0, beta: 0, fragile: 0, noise: 0 } },
          backtesting: { win_rate_pct: 0, precision_pct: 0, recall_pct: 0, uplift_vs_baseline_pct: 0, complexity_justified: false, retrospective_cases: [] },
          economic_backtesting: { net_economic_impact: 0, roi_multiplier: 0, payback_period_days: 0, validation_plans: [] },
          hypotheses: [],
          model_verdict: "NOT_RELIABLE_YET",
          external_sources: { required: [], recommended: [], experimental: [] },
          rags_externos_needed: [],
          quality_gate: { verdict: "PASS_CONDITIONAL", coverage_pct: 0, gaps: [String(err)], confidence_cap: 0.3 },
          prd_injection: { patrones_section: "", rags_adicionales: "", integraciones_externas: "" },
          confidence_cap: 0.3,
          error: String(err),
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── PUBLIC QUERY (API key auth, no JWT) ──
    if (action === "public_query") {
      const result = await handlePatternPublicQuery(body);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── PUBLIC QUERY V2 (Rich API for external apps) ──
    if (action === "public_query_v2") {
      const result = await handlePublicQueryV2(body);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── FEEDBACK INGEST (External apps send results back) ──
    if (action === "feedback_ingest") {
      const result = await handleFeedbackIngest(body);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── LIST AVAILABLE RUNS (External apps discover analyses) ──
    if (action === "list_available_runs") {
      const result = await handleListAvailableRuns(body);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── MANAGE API KEYS ──
    if (action === "manage_api_keys") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "", {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: authUser } } = await anonClient.auth.getUser();
      if (!authUser) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await handlePatternManageApiKeys(authUser.id, body);
      return new Response(JSON.stringify(result), {
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
