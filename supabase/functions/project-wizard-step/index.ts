import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PHASE_CONTRACTS, buildContractPromptBlock, gateInputs } from "./contracts.ts";
import { runAllValidators } from "./validators.ts";
import { sanitizeClientOutput } from "./sanitizer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const FETCH_TIMEOUT_MS = 380_000; // 380s — abort before Supabase 400s wall clock

function createTimeoutSignal(ms = FETCH_TIMEOUT_MS): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

/** Truncate long strings to avoid prompt bloat and timeouts */
function truncate(s: string, max = 15000): string {
  if (!s || s.length <= max) return s;
  return s.substring(0, max) + "\n\n[... truncado a " + max + " caracteres]";
}

async function recordCost(
  supabase: ReturnType<typeof createClient>,
  params: {
    projectId: string;
    stepNumber: number;
    service: string;
    operation: string;
    tokensInput: number;
    tokensOutput: number;
    costUsd: number;
    userId: string;
    metadata?: Record<string, unknown>;
  }
) {
  await supabase.from("project_costs").insert({
    project_id: params.projectId,
    step_number: params.stepNumber,
    service: params.service,
    operation: params.operation,
    tokens_input: params.tokensInput,
    tokens_output: params.tokensOutput,
    cost_usd: params.costUsd,
    user_id: params.userId,
    metadata: params.metadata || {},
  });
}

// ── Gemini Flash for extraction ────────────────────────────────────────────

async function callGeminiFlash(systemPrompt: string, userPrompt: string) {
  const apiKey = GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const { signal, clear } = createTimeoutSignal();
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 65536, responseMimeType: "application/json" },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      if (response.status === 404) {
        throw new Error(`Modelo Gemini no disponible. Verifica que tu API key tenga acceso al modelo solicitado. Detalle: ${err}`);
      }
      throw new Error(`Gemini API error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const finishReason = data.candidates?.[0]?.finishReason || "UNKNOWN";
    const usage = data.usageMetadata || {};
    if (finishReason === "MAX_TOKENS") {
      console.warn(`[wizard] ⚠️ Gemini output TRUNCATED (finishReason=MAX_TOKENS). Output tokens: ${usage.candidatesTokenCount}`);
    }
    return {
      text,
      tokensInput: usage.promptTokenCount || 0,
      tokensOutput: usage.candidatesTokenCount || 0,
      finishReason,
    };
  } finally {
    clear();
  }
}

// ── Gemini Flash for markdown (no JSON mime type) ─────────────────────────

async function callGeminiFlashMarkdown(systemPrompt: string, userPrompt: string) {
  const apiKey = GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const { signal, clear } = createTimeoutSignal();
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 16384 },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const usage = data.usageMetadata || {};
    return {
      text,
      tokensInput: usage.promptTokenCount || 0,
      tokensOutput: usage.candidatesTokenCount || 0,
    };
  } finally {
    clear();
  }
}

// ── Claude Sonnet for scope generation ─────────────────────────────────────

async function callClaudeSonnet(systemPrompt: string, userPrompt: string) {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

  const { signal, clear } = createTimeoutSignal();
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      signal,
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        temperature: 0.4,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const text = data.content?.find((b: { type: string }) => b.type === "text")?.text || "";
    return {
      text,
      tokensInput: data.usage?.input_tokens || 0,
      tokensOutput: data.usage?.output_tokens || 0,
    };
  } finally {
    clear();
  }
}

// ── Gemini Pro fallback for scope generation ──────────────────────────────

async function callGeminiPro(systemPrompt: string, userPrompt: string) {
  const apiKey = GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const model = "gemini-3.1-pro-preview";
  const { signal, clear } = createTimeoutSignal();
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 16384 },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      if (response.status === 429) {
        console.warn(`[callGeminiPro] ${model} rate limited (429), falling back to Claude Sonnet 4...`);
        return await callClaudeSonnet(systemPrompt, userPrompt);
      }
      throw new Error(`Gemini API error (${model}): ${response.status} - ${err}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const usage = data.usageMetadata || {};
    return {
      text,
      tokensInput: usage.promptTokenCount || 0,
      tokensOutput: usage.candidatesTokenCount || 0,
    };
  } finally {
    clear();
  }
}

// ── Parallel Projects Detection & Filtering (P0 Global Fix) ──────────────

interface ParallelProject {
  name: string;
  evidence: string;
  reason: "context" | "future_idea" | "other_vertical" | "separate_client";
}

/**
 * A) F2 Post-Process: Detect parallel projects mentioned in transcription/input.
 * Scans raw input text for contextual markers indicating out-of-scope initiatives.
 * Cross-checks against included modules to avoid false positives.
 */
function detectParallelProjects(inputText: string, briefing: any): ParallelProject[] {
  if (!inputText || typeof inputText !== "string") return [];

  const markers: Array<{ pattern: RegExp; reason: ParallelProject["reason"] }> = [
    { pattern: /(?:en\s+otro\s+proyecto|de\s+otro\s+proyecto|el\s+otro\s+proyecto)/gi, reason: "other_vertical" },
    { pattern: /(?:para\s+otro\s+cliente|de\s+otro\s+cliente|otro\s+cliente)/gi, reason: "separate_client" },
    { pattern: /(?:otra\s+vertical|otras?\s+verticales|otro\s+negocio)/gi, reason: "other_vertical" },
    { pattern: /(?:más\s+adelante|en\s+el\s+futuro|a\s+futuro|para\s+después|cuando\s+terminemos\s+esto)/gi, reason: "future_idea" },
    { pattern: /(?:en\s+paralelo|por\s+separado|aparte\s+de\s+esto|independientemente)/gi, reason: "context" },
    { pattern: /(?:también\s+estamos\s+con|lo\s+de\s+\w+\s+que\s+vimos|lo\s+otro\s+que)/gi, reason: "context" },
    { pattern: /(?:no\s+tiene\s+que\s+ver\s+con|fuera\s+de\s+esto|otro\s+tema\s+(?:es|sería))/gi, reason: "context" },
  ];

  // Build set of in-scope module/feature names for cross-check
  const inScopeNames = new Set<string>();
  try {
    // Support both v2 (alcance_preliminar.incluido) and v3 (solution_candidates) schemas
    if (briefing?.alcance_preliminar?.incluido && Array.isArray(briefing.alcance_preliminar.incluido)) {
      for (const item of briefing.alcance_preliminar.incluido) {
        const names = [item.funcionalidad, item.módulo, item.modulo].filter(Boolean);
        for (const n of names) inScopeNames.add(n.toLowerCase().trim());
      }
    }
    if (briefing?.solution_candidates && Array.isArray(briefing.solution_candidates)) {
      for (const item of briefing.solution_candidates) {
        if (item.title) inScopeNames.add(item.title.toLowerCase().trim());
      }
    }
    if (briefing?.observed_facts && Array.isArray(briefing.observed_facts)) {
      for (const item of briefing.observed_facts) {
        if (item.title) inScopeNames.add(item.title.toLowerCase().trim());
      }
    }
  } catch { /* ignore */ }

  const sentences = inputText.split(/[.!?\n]+/).map(s => s.trim()).filter(s => s.length > 10);
  const detected: ParallelProject[] = [];
  const seenNames = new Set<string>();

  for (const sentence of sentences) {
    for (const { pattern, reason } of markers) {
      pattern.lastIndex = 0;
      if (pattern.test(sentence)) {
        // Extract a project/initiative name from the sentence
        // Look for quoted names, capitalized words, or "lo de X"
        let name = "";
        const quotedMatch = sentence.match(/["«"']([^"»"']+)["»"']/);
        const loDeMatch = sentence.match(/lo\s+de\s+(\w[\w\s]{2,30}?)(?:\s+que|\s*[,.])/i);
        const proyectoMatch = sentence.match(/(?:proyecto|iniciativa|plataforma|app|vertical)\s+(?:de\s+)?(\w[\w\s]{2,30}?)(?:\s*[,.]|\s+(?:que|para|con|es|y))/i);

        if (quotedMatch) name = quotedMatch[1].trim();
        else if (loDeMatch) name = loDeMatch[1].trim();
        else if (proyectoMatch) name = proyectoMatch[1].trim();
        else {
          // Use first 6 words after marker as evidence snippet
          const afterMarker = sentence.substring(sentence.search(pattern));
          const words = afterMarker.split(/\s+/).slice(0, 8);
          name = words.join(" ");
        }

        if (!name || name.length < 3) continue;

        // Cross-check: skip if this name matches an in-scope module
        const nameLower = name.toLowerCase();
        let isInScope = false;
        for (const scopeName of inScopeNames) {
          if (nameLower.includes(scopeName) || scopeName.includes(nameLower)) {
            isInScope = true;
            break;
          }
        }
        if (isInScope) continue;

        // Deduplicate
        if (seenNames.has(nameLower)) continue;
        seenNames.add(nameLower);

        detected.push({
          name,
          evidence: sentence.substring(0, 200),
          reason,
        });
        break; // one marker match per sentence is enough
      }
    }
  }

  return detected;
}

/**
 * B) F3/F5 Post-Process: Inject parallel project exclusions into the document.
 * Finds or creates the "Exclusiones" section and appends the parallel projects block.
 */
function injectParallelProjectExclusions(document: string, parallelProjects: ParallelProject[] | undefined): string {
  if (!parallelProjects || parallelProjects.length === 0 || !document) return document;

  const reasonLabels: Record<string, string> = {
    context: "contexto de reunión",
    future_idea: "idea futura",
    other_vertical: "otra vertical/proyecto",
    separate_client: "proyecto de otro cliente",
  };

  const block = `\n\n### Proyectos paralelos mencionados (fuera de alcance)\nLos siguientes proyectos/iniciativas fueron mencionados durante la reunión como contexto pero **NO forman parte del alcance** del presente proyecto:\n${parallelProjects.map(p =>
    `- **${p.name}**: Mencionado como ${reasonLabels[p.reason] || "contexto"}. No forma parte del alcance del presente proyecto.`
  ).join("\n")}\n`;

  // Try to find Exclusiones section (5.4 or similar)
  const exclusionesPatterns = [
    /^(#{1,3}\s*(?:\d+\.?\d*\.?\s*)?Exclusiones\s*(?:Explícitas|del\s+proyecto)?.*$)/mi,
    /^(#{1,3}\s*5\.4\s+Exclusiones.*$)/mi,
    /^(#{1,3}\s*Exclu(?:siones|ido).*$)/mi,
  ];

  for (const pattern of exclusionesPatterns) {
    const match = document.match(pattern);
    if (match && match.index !== undefined) {
      // Find the end of this section (next heading of same or higher level)
      const headingLevel = (match[1].match(/^#+/) || ["#"])[0].length;
      const afterSection = document.substring(match.index + match[1].length);
      const nextHeadingMatch = afterSection.match(new RegExp(`^#{1,${headingLevel}}\\s`, "m"));

      if (nextHeadingMatch && nextHeadingMatch.index !== undefined) {
        const insertPos = match.index + match[1].length + nextHeadingMatch.index;
        return document.substring(0, insertPos) + block + "\n" + document.substring(insertPos);
      } else {
        // No next heading found — append at end of document
        return document + block;
      }
    }
  }

  // No exclusiones section found — insert before Supuestos (5.5) or at end of section 5
  const supuestosMatch = document.match(/^(#{1,3}\s*(?:\d+\.?\d*\.?\s*)?Supuestos)/mi);
  if (supuestosMatch && supuestosMatch.index !== undefined) {
    return document.substring(0, supuestosMatch.index) + "## 5.4 Exclusiones Explícitas\n" + block + "\n\n" + document.substring(supuestosMatch.index);
  }

  // Last resort: append before section 6 or at end
  const section6Match = document.match(/^#{1,2}\s*6[\.\s]/m);
  if (section6Match && section6Match.index !== undefined) {
    return document.substring(0, section6Match.index) + "\n## Exclusiones Explícitas\n" + block + "\n\n" + document.substring(section6Match.index);
  }

  return document + "\n\n## Exclusiones Explícitas\n" + block;
}

/**
 * C) F4 Post-Process: Filter audit findings that match parallel projects.
 * Converts matching OMISIÓN findings to NO_APLICA without score penalty.
 */
function filterParallelProjectFindings(
  auditJson: any,
  parallelProjects: ParallelProject[] | undefined,
  documentText?: string
): any {
  if (!auditJson || !auditJson.hallazgos) return auditJson;

  // Collect all parallel project names (from briefing + from document exclusions)
  const ppNames: string[] = [];

  if (parallelProjects && parallelProjects.length > 0) {
    for (const pp of parallelProjects) {
      ppNames.push(pp.name.toLowerCase());
    }
  }

  // Also parse "Proyectos paralelos mencionados" section from document
  if (documentText) {
    const ppSection = documentText.match(/###?\s*Proyectos paralelos mencionados[\s\S]*?(?=\n#{1,3}\s|\n---|\$)/i);
    if (ppSection) {
      const bulletMatches = ppSection[0].matchAll(/\*\*([^*]+)\*\*/g);
      for (const m of bulletMatches) {
        const extracted = m[1].toLowerCase().trim();
        if (extracted && !ppNames.includes(extracted)) ppNames.push(extracted);
      }
    }
  }

  if (ppNames.length === 0) return auditJson;

  const hallazgosOpen: any[] = [];
  const hallazgosNoAplica: any[] = auditJson.hallazgos_no_aplica || [];
  let filteredCrit = 0, filteredImp = 0, filteredMen = 0;

  for (const h of auditJson.hallazgos) {
    const desc = (h.descripción || h.descripcion || "").toLowerCase();
    const seccion = (h.sección_afectada || h.seccion_afectada || "").toLowerCase();
    const searchText = desc + " " + seccion;

    let isParallel = false;
    for (const ppName of ppNames) {
      // Fuzzy: check if any significant word (3+ chars) of the PP name appears in the finding
      const ppWords = ppName.split(/\s+/).filter(w => w.length >= 3);
      const matchCount = ppWords.filter(w => searchText.includes(w)).length;
      if (matchCount >= Math.max(1, Math.ceil(ppWords.length * 0.6))) {
        isParallel = true;
        break;
      }
    }

    if (isParallel && (h.tipo === "OMISIÓN" || h.tipo === "OMISION")) {
      // Convert to NO_APLICA
      h.tipo_original = h.tipo;
      h.tipo = "NO_APLICA";
      h.nota_filtro = "[[NO_APLICA:proyecto_paralelo_mencionado]]";
      hallazgosNoAplica.push(h);

      const sev = (h.severidad || "").toUpperCase();
      if (sev === "CRÍTICO" || sev === "CRITICO") filteredCrit++;
      else if (sev === "IMPORTANTE") filteredImp++;
      else filteredMen++;
    } else {
      hallazgosOpen.push(h);
    }
  }

  auditJson.hallazgos = hallazgosOpen;
  auditJson.hallazgos_no_aplica = hallazgosNoAplica;

  // Recalculate score and summary
  if (filteredCrit + filteredImp + filteredMen > 0) {
    const summary = auditJson.resumen_hallazgos || {};
    summary.total = (summary.total || 0) - (filteredCrit + filteredImp + filteredMen);
    summary.críticos = (summary.críticos || summary.criticos || 0) - filteredCrit;
    summary.importantes = (summary.importantes || 0) - filteredImp;
    summary.menores = (summary.menores || 0) - filteredMen;
    if (summary.total < 0) summary.total = 0;
    if (summary.críticos < 0) summary.críticos = 0;
    if (summary.importantes < 0) summary.importantes = 0;
    if (summary.menores < 0) summary.menores = 0;
    auditJson.resumen_hallazgos = summary;

    // Recalc score: 100 - (CRIT*20 + IMP*10 + MEN*3)
    const newScore = 100 - (summary.críticos * 20 + summary.importantes * 10 + summary.menores * 3);
    auditJson.puntuación_global = Math.max(0, Math.min(100, newScore));

    console.log(`[Parallel Projects Filter] Filtered ${filteredCrit} CRIT, ${filteredImp} IMP, ${filteredMen} MEN findings. New score: ${auditJson.puntuación_global}`);
  }

  return auditJson;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("authorization");
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, projectId, stepData } = body;
    const supabase = getSupabaseAdmin();

    // ── Action: extract (Step 2) ─────────────────────────────────────────

    if (action === "extract") {
      const { projectName, companyName, projectType, clientNeed, inputContent, inputType } = stepData;

      // ── Transcript filter (Step 1.5) ────────────────────────────────────
      function needsTranscriptFilter(iType: string, content: string): boolean {
        if (iType === "audio") return true;
        // Classic transcript markers
        const transcriptMarkers = [/Speaker\s*\d/i, /\d{1,2}:\d{2}/, /Conversación\s*#/i, /\[?\d{1,2}:\d{2}(:\d{2})?\]?/];
        if (transcriptMarkers.filter(m => m.test(content)).length >= 2) return true;
        // Also filter if content is long enough to likely contain off-topic sections
        // (conversations, meeting notes, multi-topic documents)
        if (content.length > 2000) return true;
        return false;
      }

      let contentForExtraction = inputContent;
      let filteredContent: string | null = null;
      let wasFiltered = false;

      if (needsTranscriptFilter(inputType || "", inputContent || "")) {
        console.log("[wizard] Transcript filter triggered for project:", projectId);
        const filterPrompt = `Eres un editor de transcripciones especializado en aislar UN SOLO proyecto de entre múltiples temas discutidos.

PROYECTO OBJETIVO: ${projectName}
EMPRESA OBJETIVO: ${companyName}

REGLAS ESTRICTAS:
- Tu ÚNICO trabajo es extraer lo relevante para "${projectName}" de "${companyName}"
- ELIMINA completamente cualquier discusión sobre OTROS proyectos, otras empresas, otros clientes, otros sectores
- Si se habla de "farmacias" pero el proyecto es de "centros comerciales", ELIMINA todo lo de farmacias (salvo que sea una analogía directa para el proyecto objetivo)
- Si mencionan otro proyecto como comparación o referencia, conserva SOLO si es una analogía útil y márcalo como [REFERENCIA EXTERNA: nombre_proyecto]
- Elimina conversaciones personales, saludos, despedidas, cortesías, temas logísticos no relacionados
- Elimina discusiones sobre presupuestos o plazos de OTROS proyectos
- Si hay duda sobre si algo es del proyecto objetivo o de otro, DESCÁRTALO
- CONSERVA: requisitos, funcionalidades, datos técnicos, stakeholders, plazos, presupuesto, y cualquier detalle operativo de "${projectName}"
- Mantén las citas textuales importantes del proyecto objetivo

TRANSCRIPCIÓN/MATERIAL ORIGINAL:
${inputContent}

Devuelve SOLO el texto filtrado, sin explicaciones ni comentarios.`;

        const filterResult = await callGeminiFlashMarkdown("", filterPrompt);

        filteredContent = filterResult.text.trim();
        wasFiltered = true;
        contentForExtraction = filteredContent;

        // Record filter cost
        const filterCostUsd = (filterResult.tokensInput / 1_000_000) * 0.075 + (filterResult.tokensOutput / 1_000_000) * 0.30;
        await recordCost(supabase, {
          projectId, stepNumber: 2, service: "gemini-flash", operation: "transcript_filter",
          tokensInput: filterResult.tokensInput, tokensOutput: filterResult.tokensOutput,
          costUsd: filterCostUsd, userId: user.id,
        });
        console.log(`[wizard] Transcript filtered: ${inputContent.length} → ${filteredContent.length} chars`);
      }

      const systemPrompt = `Eres un analista senior de extracción de información con 15 años de experiencia en consultoría tecnológica.

TU MISIÓN: Transformar transcripciones, notas o documentos iniciales en un BRIEF ESTRUCTURADO con separación estricta entre hechos, necesidades, hipótesis y señales.

REGLAS FUNDAMENTALES DE ESTA CAPA:
- Esta capa NO diseña arquitectura.
- Esta capa NO decide número de RAGs, especialistas, motores o módulos definitivos.
- Esta capa NO formaliza componentes listos para implementación.
- Esta capa SOLO prepara una base fiable, trazable y conservadora para fases posteriores.
- Prefiere una extracción conservadora y bien separada a una extracción brillante que contamine la arquitectura posterior.

REGLAS DE CLASIFICACIÓN:
1. Si algo parece un catálogo, corpus, taxonomía, histórico, reglas de negocio o documentación → clasifícalo como knowledge candidate (candidate_component_type: "knowledge_asset"), NO como especialista.
2. Si algo parece una acción, recomendación, clasificación operativa o decisión → clasifícalo como execution candidate (candidate_component_type: "ai_specialist" o "workflow_module").
3. Si algo implica fórmulas, scoring reproducible, cálculos financieros o salidas verificables → clasifícalo como deterministic candidate (candidate_component_type: "deterministic_engine").
4. Si algo aparece solo como idea o ejemplo en la conversación → NO puede salir como componente confirmado. Status: "proposed", certainty: "low".
5. Si un nombre técnico aparece mencionado por las personas → debe salir como candidate_component_type apropiado con status "proposed", NO como componente formal confirmado.
6. Ningún elemento del brief puede convertirse directamente en RAG final, especialista final o motor final dentro de esta capa.

REGLAS DE INTEGRIDAD:
- NUNCA mezcles hechos observados con propuestas de solución en el mismo bloque.
- NUNCA conviertas necesidades inferidas en componentes finales.
- Si un mismo dominio aparece como knowledge candidate Y como ai_specialist, DEBES explicitar la relación en "inferred_from".
- NUNCA marques como "confirmed" algo que solo fue sugerido.
- NUNCA uses nombres de componentes finales sin una fuente clara en evidence_snippets.

REGLA ANTI-SCOPE-LEAK (B-00):
- SOLO extrae información del proyecto indicado. Si se habla de otro proyecto como contexto, clasifícalo en extraction_warnings.

REGLA DE IDENTIDAD (B-01):
El nombre comercial se confirma SOLO si aparece en membrete oficial o declaración explícita. Si no: [[PENDING:nombre_comercial]].

REGLA URGENCIA-PLAZO (B-02):
Si detectas urgencia CRÍTICA/ALTA con plazo declarado, añade un item en constraints_and_risks con blocked_by y downstream_impact.

METADATOS OBLIGATORIOS POR ITEM:
- id: string (ej: "OF-001", "IN-001", "SC-001", "CR-001", "OQ-001", "AS-001")
- title: string
- description: string
- source_kind: "transcript" | "uploaded_doc" | "user_note" | "structured_summary" | "derived_inference"
- abstraction_level: "observed" | "inferred" | "proposed"
- certainty: "high" | "medium" | "low"
- status: "confirmed" | "inferred" | "proposed" | "unknown"
- evidence_snippets: string[] (citas textuales del input, MÁXIMO 2 por item, MÁXIMO 100 caracteres cada una)
- inferred_from: string[] (IDs de otros items de los que se deriva, máximo 3)
- likely_layer: "business" | "knowledge" | "execution" | "deterministic" | "orchestration" | "integration" | "presentation"
- candidate_component_type: "none" | "knowledge_asset" | "ai_specialist" | "workflow_module" | "deterministic_engine" | "orchestrator" | "dashboard" | "connector" | "analytics_module"
- blocked_by: string[] (IDs de items que bloquean este, máximo 3)
- downstream_impact: string[] (qué fases o decisiones posteriores dependen de este item, máximo 3)

LÍMITES DE VOLUMEN (OBLIGATORIO para evitar truncamiento):
- observed_facts: MÁXIMO 15 items
- inferred_needs: MÁXIMO 10 items
- solution_candidates: MÁXIMO 8 items
- constraints_and_risks: MÁXIMO 8 items
- open_questions: MÁXIMO 8 items
- architecture_signals: MÁXIMO 8 items
- Si hay más elementos, prioriza los de mayor certainty y relevancia.

Responde SOLO con JSON válido. Sin explicaciones, sin markdown, sin backticks.
${buildContractPromptBlock(2)}`;

      const userPrompt = `INPUT DEL USUARIO:
Nombre del proyecto: ${projectName}
Empresa cliente: ${companyName}
Tipo de proyecto: ${projectType}
Necesidad declarada por el cliente: ${clientNeed || "No proporcionada — extraer del material"}

Material de entrada:
${contentForExtraction}

GENERA UN BRIEF ESTRUCTURADO CON ESTA ESTRUCTURA EXACTA (JSON):
{
  "project_summary": {
    "title": "",
    "context": "3-5 frases: qué empresa, qué problema, qué se plantea, magnitud",
    "primary_goal": "objetivo principal en 1-2 frases",
    "complexity_level": "low|medium|high|very_high",
    "urgency_level": "low|medium|high|critical"
  },
  "observed_facts": [
    {
      "id": "OF-001", "title": "", "description": "",
      "source_kind": "transcript", "abstraction_level": "observed",
      "certainty": "high", "status": "confirmed",
      "evidence_snippets": ["cita textual"],
      "inferred_from": [], "likely_layer": "business",
      "candidate_component_type": "none",
      "blocked_by": [], "downstream_impact": []
    }
  ],
  "inferred_needs": [
    {
      "id": "IN-001", "title": "", "description": "necesidad deducida, NO solución",
      "source_kind": "derived_inference", "abstraction_level": "inferred",
      "certainty": "medium", "status": "inferred",
      "evidence_snippets": [], "inferred_from": ["OF-XXX"],
      "likely_layer": "business",
      "candidate_component_type": "none",
      "blocked_by": [], "downstream_impact": []
    }
  ],
  "solution_candidates": [
    {
      "id": "SC-001", "title": "posible capa/módulo (NO nombre final)",
      "description": "hipótesis de solución con razón de existencia",
      "source_kind": "derived_inference", "abstraction_level": "proposed",
      "certainty": "medium", "status": "proposed",
      "evidence_snippets": [], "inferred_from": ["IN-XXX"],
      "likely_layer": "knowledge",
      "candidate_component_type": "knowledge_asset",
      "blocked_by": [], "downstream_impact": []
    }
  ],
  "constraints_and_risks": [
    {
      "id": "CR-001", "title": "", "description": "",
      "source_kind": "transcript", "abstraction_level": "observed",
      "certainty": "high", "status": "confirmed",
      "evidence_snippets": [], "inferred_from": [],
      "likely_layer": "business", "candidate_component_type": "none",
      "blocked_by": [], "downstream_impact": []
    }
  ],
  "open_questions": [
    {
      "id": "OQ-001", "title": "", "description": "",
      "source_kind": "derived_inference", "abstraction_level": "inferred",
      "certainty": "low", "status": "unknown",
      "evidence_snippets": [], "inferred_from": [],
      "likely_layer": "business", "candidate_component_type": "none",
      "blocked_by": [], "downstream_impact": []
    }
  ],
  "architecture_signals": [
    {
      "id": "AS-001", "title": "señal (sin instanciación final)",
      "description": "señal detectada con capa probable",
      "source_kind": "derived_inference", "abstraction_level": "proposed",
      "certainty": "medium", "status": "proposed",
      "evidence_snippets": [], "inferred_from": ["IN-XXX", "SC-XXX"],
      "likely_layer": "knowledge",
      "candidate_component_type": "knowledge_asset",
      "blocked_by": [], "downstream_impact": []
    }
  ],
  "extraction_warnings": [
    {
      "type": "parallel_project|ambiguous_scope|missing_evidence|premature_formalization|duplicate_domain",
      "description": "", "affected_items": [], "recommendation": ""
    }
  ]
}`;

      const result = await callGeminiFlash(systemPrompt, userPrompt);
      console.log(`[wizard] F2 finishReason=${result.finishReason}, outputTokens=${result.tokensOutput}`);

      // Parse JSON from response — robust cleaning with truncation repair
      let briefing;
      try {
        let cleaned = result.text.trim();
        cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/gm, '').replace(/\n?```\s*$/gm, '').trim();
        briefing = JSON.parse(cleaned);
      } catch {
        // Fallback: find first { and last } in text
        try {
          const text = result.text;
          const firstBrace = text.indexOf('{');
          const lastBrace = text.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace > firstBrace) {
            briefing = JSON.parse(text.substring(firstBrace, lastBrace + 1));
          } else {
            briefing = { raw_text: result.text, parse_error: true };
          }
        } catch {
          // Truncation repair: try closing open brackets
          if (result.finishReason === "MAX_TOKENS") {
            console.warn("[wizard] Attempting truncated JSON repair...");
            try {
              let truncated = result.text;
              const firstBrace = truncated.indexOf('{');
              if (firstBrace !== -1) {
                truncated = truncated.substring(firstBrace);
                // Remove trailing incomplete string/value
                truncated = truncated.replace(/,\s*"[^"]*$/, '').replace(/,\s*$/, '');
                // Count unclosed brackets and close them
                let openBraces = 0, openBrackets = 0;
                for (const ch of truncated) {
                  if (ch === '{') openBraces++;
                  else if (ch === '}') openBraces--;
                  else if (ch === '[') openBrackets++;
                  else if (ch === ']') openBrackets--;
                }
                truncated += ']'.repeat(Math.max(0, openBrackets)) + '}'.repeat(Math.max(0, openBraces));
                briefing = JSON.parse(truncated);
                briefing._truncation_repaired = true;
                console.log("[wizard] Truncated JSON repaired successfully");
              } else {
                briefing = { raw_text: result.text, parse_error: true };
              }
            } catch {
              console.error("[wizard] Truncated JSON repair failed");
              briefing = { raw_text: result.text, parse_error: true };
            }
          } else {
            briefing = { raw_text: result.text, parse_error: true };
          }
        }
      }

      // ── P0: Detect parallel projects in raw input ──
      if (!briefing.parse_error) {
        const parallelProjects = detectParallelProjects(contentForExtraction || inputContent || "", briefing);
        if (parallelProjects.length > 0) {
          briefing.parallel_projects = parallelProjects;
          console.log(`[wizard] Detected ${parallelProjects.length} parallel projects:`, parallelProjects.map(p => p.name));
        }
      }

      // Calculate cost
      const costUsd = (result.tokensInput / 1_000_000) * 0.075 + (result.tokensOutput / 1_000_000) * 0.30;

      // Record cost
      await recordCost(supabase, {
        projectId, stepNumber: 2, service: "gemini-flash", operation: "extract_briefing",
        tokensInput: result.tokensInput, tokensOutput: result.tokensOutput,
        costUsd, userId: user.id,
      });

      // Save step
      const { data: existingStep } = await supabase
        .from("project_wizard_steps")
        .select("id, version")
        .eq("project_id", projectId)
        .eq("step_number", 2)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      const newVersion = existingStep ? existingStep.version + 1 : 1;

      // Mark briefing with filter metadata
      if (wasFiltered) {
        briefing._was_filtered = true;
        briefing._filtered_content = filteredContent;
      }

      // ── Contract validation (Step 2) ──
      const validation2 = runAllValidators(2, briefing, JSON.stringify(briefing));
      if (Object.keys(validation2.flags).length > 0) {
        briefing._contract_validation = validation2.flags;
      }

      await supabase.from("project_wizard_steps").upsert({
        id: existingStep?.id || undefined,
        project_id: projectId,
        step_number: 2,
        step_name: "Extracción Inteligente",
        status: "review",
        input_data: {
          projectName, companyName, projectType, clientNeed,
          inputContent: inputContent.substring(0, 500),
          filtered_content: wasFiltered ? filteredContent?.substring(0, 500) : undefined,
          was_filtered: wasFiltered,
        },
        output_data: briefing,
        model_used: "gemini-2.5-flash",
        version: newVersion,
        user_id: user.id,
      });

      // Update project current_step
      await supabase.from("business_projects").update({ current_step: 2 }).eq("id", projectId);

      return new Response(JSON.stringify({ briefing, cost: costUsd, version: newVersion }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: generate_scope (Step 3) ──────────────────────────────────

    if (action === "generate_scope") {
      const { briefingJson, contactName, currentDate, attachmentsContent } = stepData;

      const systemPrompt = `Eres un director de proyectos senior de una consultora tecnológica premium. Generas documentos de alcance que se presentan directamente a comités de dirección y que sirven como base contractual.

ESTILO Y FORMATO:
- Profesional, preciso y accionable. Cada sección debe aportar valor, no relleno.
- Cuantifica SIEMPRE: plazos en semanas, costes en rangos, recursos necesarios, métricas de éxito.
- Las recomendaciones deben ser concretas y justificadas, nunca genéricas.
- Vincula SIEMPRE el cronograma con los costes: cada fase tiene tiempo Y coste asociado.
- Prioriza usando P0/P1/P2 heredados del briefing.
- Si detectas inconsistencias o riesgos no mencionados en el briefing, señálalos en la sección de riesgos.
- Idioma: español (España).
- Formato: Markdown con estructura clara.
- NO uses frases vacías tipo "se estudiará", "se analizará oportunamente". Sé específico.

REGLA DE ORO: Un lector debe poder entender el proyecto completo, su coste, sus fases y sus riesgos leyendo SOLO este documento.
- REGLA STAKEHOLDERS: Si hay stakeholders sin identificar, NO los incluyas con nombre "Desconocido" ni variantes como "Desconocido-1". Usa "[Por confirmar]" como nombre y en responsabilidad escribe "Pendiente de identificación por el cliente".
- REGLA REDUCCIÓN PERSONAL: Cuando un objetivo mencione reducción de plantilla o ahorro de costes, clasifícalo como "Aspiración estratégica" con prioridad P2 a menos que el briefing contenga datos cuantitativos confirmados por el cliente.
- REGLA PENDIENTES: Los datos faltantes o pendientes deben presentarse SIEMPRE como tabla con columnas: Qué falta | Impacto si no se obtiene | Responsable de aportarlo | Prioridad (ALTA/MEDIA/BAJA) | Fecha límite sugerida.
- REGLA COSTES API: SIEMPRE incluye una subsección de costes recurrentes estimados de APIs y servicios cloud (modelos de IA, infraestructura) porque son datos técnicos verificables, independientemente del nivel de detalle de inversión.

RECONCILIACIÓN URGENCIA-TIMELINE (D-01 — ejecutar siempre antes de generar fases):
DEFINICIÓN OPERATIVA DE ENTREGABLE FUNCIONAL:
"Entregable funcional demostrable = una pantalla, proceso o flujo que produce un output operativo (matching, búsqueda, scoring, análisis) sobre datos reales o muestra representativa del cliente. Un documento, wireframe o maqueta NO cuenta como entregable funcional."
PROTOCOLO:
1. Extrae del briefing: plazo_mvp_cliente (en semanas)
2. Suma semanas hasta el primer entregable funcional según definición anterior
3. Compara:
   - suma <= plazo_mvp_cliente → continúa normalmente
   - suma > plazo_mvp_cliente → OBLIGATORIO añadir al inicio de la sección de fases:
     "NOTA MVP: El cliente requiere un entregable funcional en [X semanas]. La Fase 0/PoC ([Y semanas], [€]) constituye el MVP para ese plazo: incluye [lista de outputs operativos concretos]. Las Fases 1-N representan la plataforma completa y se ejecutan tras validación del MVP."
4. Si no puedes reconciliarlos con los datos disponibles: → [[NEEDS_CLARIFICATION:plazo_mvp_vs_alcance]]

CONSISTENCIA DE IDENTIDAD (D-02):
Usa exactamente el mismo identificador en TODAS las secciones: portada, resumen ejecutivo, stakeholders y bloque de firmas.
Si el nombre está pendiente → [[PENDING:nombre_comercial]] en todas las secciones.
El bloque de firmas usa exactamente el mismo valor que la portada. Sin excepciones.

REGLA DE MÉTRICAS DE IA (D-03):
Cualquier métrica dependiente de rendimiento de modelo (precisión, reducción de tiempo, tasas de error, recall) NO puede ser criterio de aceptación fijo.
Formato obligatorio:
❌ "Precisión del 85% en predicciones de solvencia"
✅ "Objetivo de precisión ≥85%, a validar con datos históricos del cliente en Fase [X]. El criterio se confirma una vez establecido el baseline con los primeros [N] casos reales."
Aplica a todos los campos MÉTRICA DE ÉXITO con porcentajes basados en IA.

PROPAGACIÓN DE CORRECCIONES (D-04):
El changelog documenta QUÉ se cambió y POR QUÉ. El cuerpo del documento muestra el resultado FINAL ya corregido.
Si el changelog reclasifica algo (ej: P0 → Aspiración estratégica), esa reclasificación DEBE reflejarse en el cuerpo: resumen ejecutivo, tablas de objetivos, sección de fases. No solo en el changelog.
Regla: si existe contradicción entre changelog y cuerpo, el changelog manda.

ETIQUETADO DUAL OBLIGATORIO (D-05):
SIEMPRE [[INTERNAL_ONLY]] — NUNCA en versión cliente:
- Changelog y auditoría interna
- Costes de generación del documento (tokens, tiempo de proceso)
- Gasto actual en APIs del cliente (ej: "3.000€/mes en tokens")
- Detalles de infraestructura personal del cliente (Plaud, bots propios, sistemas personales no corporativos)
- Hallazgos de auditoría cruzada
- Metodología interna del proveedor
SIEMPRE CLIENTE — nunca ocultar:
- Objetivos y métricas (formato correcto según D-03)
- Plan de fases y criterios de aceptación
- Análisis de riesgos (sin datos internos)
- Datos pendientes y bloqueos
- Bloque de firmas
El renderer elimina mecánicamente bloques [[INTERNAL_ONLY]]. Si tienes duda sobre un bloque: [[INTERNAL_ONLY]] por defecto.

TRANSPARENCIA DE COSTES EN POC (D-06):
Si existe Fase 0 o PoC, añadir siempre nota en sección de costes:
"Los costes recurrentes de APIs e infraestructura ([rango €/mes]) aplican desde el inicio de la Fase 0. Para la duración del PoC ([N semanas]): coste adicional estimado ~[€] sobre el coste fijo de la fase."
Cálculo: (coste_mensual_medio / 4) × semanas_fase_0
${buildContractPromptBlock(3)}`;

      const briefingStr = typeof briefingJson === 'string' ? briefingJson : JSON.stringify(briefingJson, null, 2);

      // Build attachments section if present
      let attachmentsSection = "";
      if (attachmentsContent && Array.isArray(attachmentsContent) && attachmentsContent.length > 0) {
        attachmentsSection = `\n\nDOCUMENTOS ADICIONALES DEL CLIENTE:
Los siguientes documentos fueron proporcionados por el cliente. Analiza su contenido e incorpora toda la información relevante al documento de alcance (requisitos, datos, restricciones, procesos, etc.):\n\n`;
        for (const att of attachmentsContent) {
          attachmentsSection += `--- DOCUMENTO: ${att.name} (${att.type}) ---\n${truncate(att.content, 20000)}\n\n`;
        }
      }

      const userPrompt = `BRIEFING APROBADO DEL PROYECTO:
${briefingStr}
${attachmentsSection}
DATOS DE CONTEXTO:
- Empresa ejecutora: ManIAS Lab. (consultora tecnológica, IA y marketing digital)
- Responsable del proyecto: Agustín Cifuentes
- Contacto cliente: ${contactName || "No especificado"}
- Fecha: ${currentDate || new Date().toISOString().split('T')[0]}

GENERA UN DOCUMENTO DE ALCANCE COMPLETO EN MARKDOWN con estas secciones:

# 1. PORTADA
Nombre del proyecto, cliente, ejecutor, fecha, versión, confidencialidad.

# 2. RESUMEN EJECUTIVO
3-5 párrafos: contexto del cliente, problema, solución propuesta, magnitud y beneficio esperado.

# 3. OBJETIVOS DEL PROYECTO
| Objetivo | Prioridad (P0/P1/P2) | Métrica de éxito | Plazo estimado |

# 4. STAKEHOLDERS Y RESPONSABILIDADES
| Nombre | Rol | Responsabilidad en el proyecto | Poder de decisión |

# 5. ALCANCE DETALLADO
## 5.1 Módulos y funcionalidades
| Módulo | Funcionalidades clave | Prioridad | Fase |
## 5.2 Arquitectura técnica
## 5.3 Integraciones
| Sistema | Tipo | Estado | Riesgo |
## 5.4 Exclusiones explícitas
## 5.5 Supuestos y dependencias

# 6. PLAN DE IMPLEMENTACIÓN POR FASES
Para CADA fase: nombre, duración en semanas, módulos/entregables, dependencias, criterios de aceptación.

# 7. INVERSIÓN Y ESTRUCTURA DE COSTES
## 7.1 Inversión por fase
| Fase | Alcance | Duración | Rango de inversión |
## 7.2 Costes recurrentes mensuales
## 7.3 Comparativa con alternativas (si aplica)

# 8. ANÁLISIS DE RIESGOS
| Riesgo | Probabilidad | Impacto | Mitigación | Responsable |

# 9. DATOS PENDIENTES Y BLOQUEOS
| Dato faltante | Impacto si no se obtiene | Responsable | Fecha límite sugerida |

# 10. DECISIONES TÉCNICAS CONFIRMADAS

# 11. PRÓXIMOS PASOS
| Acción | Responsable | Fecha Límite |

# 12. CONDICIONES Y ACEPTACIÓN
Validez de la propuesta, condiciones de cambio de alcance, firma.`;

      // A1: Pricing mode adjustment
      const pricingMode = stepData.pricingMode || 'none';
      let finalUserPrompt = userPrompt;
      if (pricingMode === 'none') {
        finalUserPrompt += '\n\nREGLA OBLIGATORIA DE INVERSIÓN: NO incluyas cifras absolutas de inversión (€) ni cálculos de ROI en la sección 7. Para cada fase escribe "A definir según alcance confirmado en fase de propuesta económica" en lugar de rangos numéricos. SÍ incluye una subsección de costes recurrentes estimados de APIs y servicios cloud porque son datos técnicos verificables.';
      } else if (pricingMode === 'custom') {
        finalUserPrompt += '\n\nINSTRUCCIÓN DE INVERSIÓN: NO calcules ROI automáticamente. SÍ incluye costes recurrentes de APIs y servicios cloud.';
      }

      let result: { text: string; tokensInput: number; tokensOutput: number };
      let modelUsed = "gemini-3.1-pro-preview";
      let fallbackUsed = false;

      try {
        result = await callGeminiPro(systemPrompt, finalUserPrompt);
      } catch (geminiError) {
        console.warn("Gemini Pro failed, falling back to Claude Sonnet 4:", geminiError instanceof Error ? geminiError.message : geminiError);
        try {
          result = await callClaudeSonnet(systemPrompt, finalUserPrompt);
          modelUsed = "claude-sonnet-4";
          fallbackUsed = true;
        } catch (claudeError) {
          console.error("Claude also failed:", claudeError instanceof Error ? claudeError.message : claudeError);
          throw geminiError;
        }
      }

      const costUsd = fallbackUsed
        ? (result.tokensInput / 1_000_000) * 3.00 + (result.tokensOutput / 1_000_000) * 15.00
        : (result.tokensInput / 1_000_000) * 1.25 + (result.tokensOutput / 1_000_000) * 10.00;

      await recordCost(supabase, {
        projectId, stepNumber: 3, service: fallbackUsed ? "gemini-pro" : "claude-sonnet", operation: "generate_scope",
        tokensInput: result.tokensInput, tokensOutput: result.tokensOutput,
        costUsd, userId: user.id,
        metadata: fallbackUsed ? { fallback: true, original_error: "claude_unavailable" } : {},
      });

      // ── P0: Inject parallel project exclusions into scope document ──
      const briefingObj = typeof briefingJson === 'object' && briefingJson !== null ? briefingJson : {};
      if (briefingObj.parallel_projects && briefingObj.parallel_projects.length > 0) {
        result.text = injectParallelProjectExclusions(result.text, briefingObj.parallel_projects);
        console.log(`[wizard] Injected ${briefingObj.parallel_projects.length} parallel project exclusions into scope document`);
      }

      // ── Contract validation (Step 3) ──
      const validation3 = runAllValidators(3, null, result.text, {
        2: briefingStr.substring(0, 5000),
      });
      const scopeOutputData: Record<string, any> = { document: result.text };
      if (Object.keys(validation3.flags).length > 0) {
        scopeOutputData._contract_validation = validation3.flags;
      }

      // Save step
      const { data: existingStep } = await supabase
        .from("project_wizard_steps")
        .select("id, version")
        .eq("project_id", projectId)
        .eq("step_number", 3)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      const newVersion = existingStep ? existingStep.version + 1 : 1;

      await supabase.from("project_wizard_steps").upsert({
        id: existingStep?.id || undefined,
        project_id: projectId,
        step_number: 3,
        step_name: "Documento de Alcance",
        status: "review",
        input_data: { briefingJson: briefingStr.substring(0, 500) },
        output_data: scopeOutputData,
        model_used: modelUsed,
        version: newVersion,
        user_id: user.id,
      });

      // Save document
      await supabase.from("project_documents").insert({
        project_id: projectId,
        step_number: 3,
        version: newVersion,
        content: result.text,
        format: "markdown",
        user_id: user.id,
      });

      await supabase.from("business_projects").update({ current_step: 3 }).eq("id", projectId);

      return new Response(JSON.stringify({ document: result.text, cost: costUsd, version: newVersion, modelUsed, fallbackUsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: generate_prd_chained (New 4-step pipeline: F3→F4→F5 in one call) ──
    if (action === "generate_prd_chained") {
      const sd = stepData;
      const briefingJson = sd.briefingJson;
      const briefStr = typeof briefingJson === 'string' ? briefingJson : JSON.stringify(briefingJson || {}, null, 2);

      // Mark step 3 as "generating" immediately (PRD in new pipeline)
      const { data: existingStep3 } = await supabase
        .from("project_wizard_steps")
        .select("id, version")
        .eq("project_id", projectId)
        .eq("step_number", 3)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      const initVersion = existingStep3 ? existingStep3.version + 1 : 1;

      await supabase.from("project_wizard_steps").upsert({
        id: existingStep3?.id || undefined,
        project_id: projectId,
        step_number: 3,
        step_name: "PRD Técnico",
        status: "generating",
        input_data: { action: "generate_prd_chained" },
        output_data: null,
        version: initVersion,
        user_id: user.id,
      });

      // Run chained generation in background
      const chainedWork = async () => {
        try {
          // ── PHASE 1: Generate Scope (internal step 10) ──
          console.log("[Chained PRD] Phase 1: Generating Scope...");
          
          // Save internal marker for scope phase
          await supabase.from("project_wizard_steps").upsert({
            project_id: projectId,
            step_number: 10,
            step_name: "Alcance (interno)",
            status: "generating",
            input_data: { _internal: true },
            output_data: null,
            version: 1,
            user_id: user.id,
          });

          // Call scope generation inline (reusing existing logic)
          const scopeSystemPrompt = `Eres un director de proyectos senior de una consultora tecnológica premium. Generas documentos de alcance concisos y profesionales que sirven como base para el PRD técnico.
REGLAS: Profesional, preciso, cuantificado. Markdown con estructura clara. Español (España).
${buildContractPromptBlock(3)}`;

          const scopeUserPrompt = `BRIEFING APROBADO:\n${briefStr}\n\nDATOS:\n- Empresa ejecutora: ManIAS Lab.\n- Fecha: ${sd.currentDate || new Date().toISOString().split('T')[0]}\n- Contacto: ${sd.companyName || "No especificado"}\n\nGenera un documento de alcance conciso en Markdown con: Resumen ejecutivo, Objetivos, Stakeholders, Alcance (módulos, arquitectura, integraciones, exclusiones), Plan de fases, Inversión, Riesgos, Datos pendientes, Próximos pasos.`;

          let scopeResult;
          let scopeModel = "gemini-3.1-pro-preview";
          try {
            scopeResult = await callGeminiPro(scopeSystemPrompt, scopeUserPrompt);
          } catch {
            scopeResult = await callClaudeSonnet(scopeSystemPrompt, scopeUserPrompt);
            scopeModel = "claude-sonnet-4";
          }

          // Inject parallel project exclusions
          const briefObj = typeof briefingJson === 'object' && briefingJson !== null ? briefingJson : {};
          if (briefObj.parallel_projects?.length > 0) {
            scopeResult.text = injectParallelProjectExclusions(scopeResult.text, briefObj.parallel_projects);
          }

          const scopeCost = (scopeResult.tokensInput / 1_000_000) * 1.25 + (scopeResult.tokensOutput / 1_000_000) * 10.00;
          await recordCost(supabase, {
            projectId, stepNumber: 10, service: scopeModel, operation: "generate_scope_internal",
            tokensInput: scopeResult.tokensInput, tokensOutput: scopeResult.tokensOutput,
            costUsd: scopeCost, userId: user.id, metadata: { _internal: true },
          });

          await supabase.from("project_wizard_steps").update({
            status: "review", output_data: { document: scopeResult.text, _internal: true },
          }).eq("project_id", projectId).eq("step_number", 10);

          console.log("[Chained PRD] Phase 1 done: Scope generated");

          // ── PHASE 2: AI Audit (internal step 11) ──
          console.log("[Chained PRD] Phase 2: Running AI Audit...");

          await supabase.from("project_wizard_steps").upsert({
            project_id: projectId,
            step_number: 11,
            step_name: "Auditoría IA (interno)",
            status: "generating",
            input_data: { _internal: true },
            output_data: null,
            version: 1,
            user_id: user.id,
          });

          // Reuse run_ai_leverage prompt from STEP_ACTION_MAP
          const aiLevSystemPrompt = `Eres un arquitecto de soluciones de IA con experiencia práctica implementando sistemas en producción. Analiza el proyecto y propón dónde la IA aporta valor real.
${buildContractPromptBlock(4)}
Responde SOLO con JSON válido.`;

          const finalStr = truncate(scopeResult.text);
          const aiLevUserPrompt = `DOCUMENTO DE ALCANCE:\n${finalStr}\n\nBRIEFING:\n${truncate(briefStr)}\n\nGenera análisis de oportunidades IA en JSON con: resumen, oportunidades (id, nombre, módulo, tipo, modelo, coste, ROI, es_mvp, prioridad), quick_wins, stack_ia, services_decision (rag, pattern_detector).`;

          let aiLevResult;
          try {
            aiLevResult = await callGeminiPro(aiLevSystemPrompt, aiLevUserPrompt);
          } catch {
            aiLevResult = await callClaudeSonnet(aiLevSystemPrompt, aiLevUserPrompt);
          }

          let auditData: any;
          try {
            let cleaned = aiLevResult.text.trim().replace(/^```(?:json|JSON)?\s*\n?/gm, '').replace(/\n?```\s*$/gm, '').trim();
            auditData = JSON.parse(cleaned);
          } catch {
            try {
              const fb = aiLevResult.text.indexOf('{');
              const lb = aiLevResult.text.lastIndexOf('}');
              if (fb !== -1 && lb > fb) auditData = JSON.parse(aiLevResult.text.substring(fb, lb + 1));
              else auditData = { raw_text: aiLevResult.text, parse_error: true };
            } catch { auditData = { raw_text: aiLevResult.text, parse_error: true }; }
          }

          const auditCost = (aiLevResult.tokensInput / 1_000_000) * 1.25 + (aiLevResult.tokensOutput / 1_000_000) * 10.00;
          await recordCost(supabase, {
            projectId, stepNumber: 11, service: "gemini-pro", operation: "ai_audit_internal",
            tokensInput: aiLevResult.tokensInput, tokensOutput: aiLevResult.tokensOutput,
            costUsd: auditCost, userId: user.id, metadata: { _internal: true },
          });

          await supabase.from("project_wizard_steps").update({
            status: "review", output_data: { ...auditData, _internal: true },
          }).eq("project_id", projectId).eq("step_number", 11);

          console.log("[Chained PRD] Phase 2 done: AI Audit generated");

          // ── PHASE 3: Generate PRD (reuse existing generate_prd logic) ──
          console.log("[Chained PRD] Phase 3: Generating PRD...");

          // Prepare stepData for generate_prd action (inline the heavy work)
          const prdStepData = {
            ...sd,
            finalDocument: scopeResult.text,
            scopeDocument: scopeResult.text,
            aiLeverageJson: auditData,
            briefingJson: briefingJson,
          };

          // Instead of duplicating PRD logic, call the edge function recursively
          const prdResp = await fetch(`${SUPABASE_URL}/functions/v1/project-wizard-step`, {
            method: "POST",
            headers: {
              Authorization: authHeader || `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
              apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
            },
            body: JSON.stringify({
              action: "generate_prd",
              projectId,
              stepData: prdStepData,
            }),
          });

          if (!prdResp.ok) {
            const errText = await prdResp.text();
            throw new Error(`PRD generation failed: ${errText}`);
          }

          // PRD runs in background via waitUntil, so we need to poll for it
          const prdMaxWait = 600000;
          const prdStart = Date.now();
          while (Date.now() - prdStart < prdMaxWait) {
            await new Promise(r => setTimeout(r, 8000));
            const { data: prdCheck } = await supabase
              .from("project_wizard_steps")
              .select("status, output_data")
              .eq("project_id", projectId)
              .eq("step_number", 5)
              .order("version", { ascending: false })
              .limit(1)
              .single();

            if (prdCheck?.status === "review") {
              // PRD done! Copy output to step 3 (new pipeline step)
              const prdOutput = prdCheck.output_data;
              
              // Attach internal scope & audit for traceability
              const finalOutput = {
                ...prdOutput,
                _internal_scope: { document: scopeResult.text },
                _internal_audit: auditData,
              };

              await supabase.from("project_wizard_steps").update({
                status: "review",
                output_data: finalOutput,
              }).eq("project_id", projectId).eq("step_number", 3).eq("version", initVersion);

              await supabase.from("business_projects").update({ current_step: 3 }).eq("id", projectId);

              console.log("[Chained PRD] All 3 phases completed successfully!");
              return;
            }
            if (prdCheck?.status === "error") {
              throw new Error(prdCheck.output_data?.error || "PRD generation failed");
            }
          }
          throw new Error("Timeout waiting for PRD generation (10 min)");

        } catch (err) {
          console.error("[Chained PRD] Failed:", err instanceof Error ? err.message : err);
          await supabase.from("project_wizard_steps").update({
            status: "error",
            output_data: { error: err instanceof Error ? err.message : String(err) },
          }).eq("project_id", projectId).eq("step_number", 3).eq("version", initVersion);
        }
      };

      (globalThis as any).EdgeRuntime?.waitUntil?.(chainedWork());

      return new Response(JSON.stringify({
        status: "generating",
        message: "PRD encadenado en generación (Alcance → Auditoría → PRD). El resultado aparecerá automáticamente.",
        version: initVersion,
      }), {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: generate_prd (Step 5) — ASYNC via waitUntil — 6 PARTS LOW-LEVEL ──
    if (action === "generate_prd") {
      // Mark step as "generating" immediately
      const { data: existingStepInit } = await supabase
        .from("project_wizard_steps")
        .select("id, version")
        .eq("project_id", projectId)
        .eq("step_number", 5)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      const initVersion = existingStepInit ? existingStepInit.version + 1 : 1;

      await supabase.from("project_wizard_steps").upsert({
        id: existingStepInit?.id || undefined,
        project_id: projectId,
        step_number: 5,
        step_name: "PRD Técnico",
        status: "generating",
        input_data: { action: "generate_prd", targetPhase: stepData.targetPhase || "Fase 0 + Fase 1 (MVP)" },
        output_data: null,
        version: initVersion,
        user_id: user.id,
      });

      // Run heavy work in background
      const backgroundWork = async () => {
        try {
      const sd = stepData;
      const finalStr = truncate(typeof sd.finalDocument === "string" ? sd.finalDocument : JSON.stringify(sd.finalDocument || {}, null, 2));
      const aiLevStr = truncate(typeof sd.aiLeverageJson === "string" ? sd.aiLeverageJson : JSON.stringify(sd.aiLeverageJson || {}, null, 2));
      const briefStr = truncate(typeof sd.briefingJson === "string" ? sd.briefingJson : JSON.stringify(sd.briefingJson || {}, null, 2));
      const targetPhase = sd.targetPhase || "Fase 0 + Fase 1 (MVP)";

      // ── Read services_decision from step 4 output (AI audit) ──
      let servicesDecision: Record<string, any> | null = null;
      try {
        // Try new step 4 first, fallback to legacy step 6
        let step4Data: any = null;
        const { data: s4 } = await supabase
          .from("project_wizard_steps")
          .select("output_data")
          .eq("project_id", projectId)
          .eq("step_number", 4)
          .order("version", { ascending: false })
          .limit(1)
          .single();
        step4Data = s4;
        if (!step4Data) {
          const { data: s6 } = await supabase
            .from("project_wizard_steps")
            .select("output_data")
            .eq("project_id", projectId)
            .eq("step_number", 6)
            .order("version", { ascending: false })
            .limit(1)
            .single();
          step4Data = s6;
        }
        if (step4Data?.output_data?.services_decision) {
          servicesDecision = step4Data.output_data.services_decision;
          console.log("[PRD] services_decision loaded:", JSON.stringify(servicesDecision));
        }
      } catch (e) {
        console.warn("[PRD] Could not read services_decision:", e);
      }

      const prdSystemPrompt = `Eres un Product Manager técnico senior + Arquitecto de Soluciones. Generas PRDs de nivel LOW-LEVEL DESIGN que se convierten directamente en aplicaciones funcionales via Lovable.

## NIVEL DE DETALLE REQUERIDO
NO generes un PRD resumen. Genera un DISEÑO OPERATIVO LOW-LEVEL con ontología de entidades, catálogo exhaustivo de variables (50-150), patrones operativos (20-30), motor de scoring con fórmulas, Signal Objects, modelo de datos SQL completo, Edge Functions con cadencias, y checklist maestro.

## STACK OBLIGATORIO
- Frontend: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- Backend: Supabase (Auth, PostgreSQL, Storage, Edge Functions con Deno, Realtime)
- Routing: react-router-dom | Iconos: lucide-react | Charts: recharts
- Estado: React hooks — NO Redux, NO Zustand
PROHIBIDO: Next.js, Express, NestJS, microservicios, JWT custom, AWS, Azure, Docker, Kubernetes, MongoDB, Firebase.

## REGLAS DE ESCRITURA
1. Markdown plano con tablas, bloques de código y listas. NUNCA JSON anidado.
2. Cada requisito testeable. 3. Cada módulo mapea a pantallas + entidades + endpoints.
4. IA con fallback, logging, coste, precisión. 5. Hipótesis marcadas como [HIPÓTESIS].
6. CREATE TABLE SQL ejecutable, RLS incluidas. 7. Por fase (0, 1, 2...).
8. Español (España). 9. EXHAUSTIVIDAD: NO "etc." ni "y similares" — lista TODO.
10. Profundidad de dominio: variables y patrones específicos del sector.

## NOMBRES PROPIOS
El nombre canónico del cliente es: "${sd.companyName || sd.briefingJson?.company_name || sd.briefingJson?.cliente?.empresa || sd.briefingJson?.cliente?.nombre_comercial || 'el cliente'}".
Usa SIEMPRE esta grafía exacta.`;

      let totalTokensInput = 0;
      let totalTokensOutput = 0;
      let mainModelUsed = "gemini-3.1-pro-preview";
      let prdFallbackUsed = false;

      // Helper: call Gemini Pro with fallback to Claude Sonnet 4
      const callPrdModel = async (system: string, user: string): Promise<{ text: string; tokensInput: number; tokensOutput: number }> => {
        const apiKey = GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
        
        const model = "gemini-3.1-pro-preview";
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: `${system}\n\n${user}` }] }],
                generationConfig: { temperature: 0.4, maxOutputTokens: 12288 },
              }),
            }
          );
          if (!response.ok) {
            const err = await response.text();
            if (response.status === 429) {
              console.warn(`[PRD] ${model} rate limited (429), falling back to Claude Sonnet 4...`);
              prdFallbackUsed = true;
              mainModelUsed = "claude-sonnet-4";
              return await callClaudeSonnet(system, user);
            }
            throw new Error(`Gemini API error (${model}): ${response.status} - ${err}`);
          }
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const usage = data.usageMetadata || {};
          return { text, tokensInput: usage.promptTokenCount || 0, tokensOutput: usage.candidatesTokenCount || 0 };
        } catch (geminiError) {
          console.warn(`[PRD] ${model} failed, falling back to Claude Sonnet 4:`, geminiError instanceof Error ? geminiError.message : geminiError);
          prdFallbackUsed = true;
          mainModelUsed = "claude-sonnet-4";
          return await callClaudeSonnet(system, user);
        }
      };

      // ── BUILD SHARED CONTEXT for parallel execution ──
      const briefObj = typeof sd.briefingJson === 'object' && sd.briefingJson !== null ? sd.briefingJson : {};
      const companyName = sd.companyName || briefObj.company_name || briefObj.cliente?.empresa || briefObj.cliente?.nombre_comercial || 'el cliente';

      let modulesList = "Ver documento de alcance";
      try {
        const moduleMatches = finalStr.match(/##\s+\d+\.\d+\s+(.+)/g) || finalStr.match(/\|\s*([A-ZÀ-Ú][a-záàéèíìóòúùñ\s&]+)\s*\|/g) || [];
        if (moduleMatches.length > 0) {
          modulesList = moduleMatches.slice(0, 15).map((m: string) => m.replace(/^##\s+\d+\.\d+\s+/, '').replace(/^\|\s*/, '').replace(/\s*\|$/, '').trim()).join(", ");
        } else if (briefObj.alcance_preliminar?.incluido) {
          const mods = briefObj.alcance_preliminar.incluido.map((i: any) => i.módulo || i.modulo || i.funcionalidad).filter(Boolean);
          if (mods.length > 0) modulesList = [...new Set(mods)].join(", ");
        }
      } catch { /* keep default */ }

      let rolesList = "Ver briefing";
      try {
        if (briefObj.stakeholders && Array.isArray(briefObj.stakeholders)) {
          const roles = briefObj.stakeholders.map((s: any) => s.tipo || s.rol).filter(Boolean);
          if (roles.length > 0) rolesList = [...new Set(roles)].join(", ");
        }
      } catch { /* keep default */ }

      // ── DATA PROFILE injection ──
      let dataProfileBlock = "";
      const dp = sd.dataProfile;
      if (dp?.has_client_data) {
        const vars = (dp.detected_variables || []).map((v: any) =>
          `  - ${v.name} (${v.type}): ${v.records} registros, calidad ${v.quality}% — ${v.description}`
        ).join("\n");
        const entities = (dp.detected_entities || []).slice(0, 30).join(", ");
        const temporal = dp.temporal_coverage ? `${dp.temporal_coverage.from} — ${dp.temporal_coverage.to}` : "No disponible";
        const geo = (dp.geographic_coverage || []).join(", ") || "No disponible";
        dataProfileBlock = `\nDATOS REALES DEL CLIENTE (Data Snapshot):\n- Variables: ${vars}\n- Entidades: ${entities}\n- Temporal: ${temporal}\n- Geográfico: ${geo}\n- Calidad: ${dp.data_quality_score}/100\n- Contexto: ${dp.business_context}\nUSA estos datos para calibrar variables, patrones y métricas.\n`;
      }

      const sharedContext = `CONTEXTO COMPARTIDO:
- Empresa: ${companyName}
- Módulos: ${modulesList}
- Roles: ${rolesList}
- Fase objetivo: ${targetPhase}
${dataProfileBlock}
DOCUMENTO FINAL APROBADO:
${finalStr}

AI LEVERAGE (oportunidades IA):
${aiLevStr}

BRIEFING ORIGINAL:
${briefStr}`;

      // ── Services context for Part 2 ──
      let servicesContextBlock = "";
      if (servicesDecision?.rag?.necesario) {
        servicesContextBlock += `\nSERVICIO EXTERNO: RAG — Dominio: ${servicesDecision.rag.dominio_sugerido || "del proyecto"}`;
      }
      if (servicesDecision?.pattern_detector?.necesario) {
        servicesContextBlock += `\nSERVICIO EXTERNO: Detector de Patrones — Variables clave: ${(servicesDecision.pattern_detector.variables_clave_sugeridas || []).join(", ")}`;
      }

      // ── CALL 1: Sections 1-4 (Resumen, Marco, Principios, Métricas) ──
      const userPrompt1 = `${sharedContext}\n\nGENERA LAS SECCIONES 1 A 4 DEL PRD LOW-LEVEL EN MARKDOWN:\n\n# 1. RESUMEN EJECUTIVO\nPárrafo denso: empresa, problema cuantificado, solución, stack, resultado esperado.\n"Este PRD es Lovable-ready."\nSegundo párrafo: Magnitud — número de entidades, variables, patrones, Edge Functions, pantallas.\n\n# 2. MARCO DEL PROBLEMA Y TESIS DE DISEÑO\n## 2.1 Problema (con datos cuantitativos)\n## 2.2 Hipótesis central ("Si construimos [X]... entonces [Z]...")\n## 2.3 Tesis de diseño (3-5 principios con implicación técnica y ejemplo)\n\n# 3. PRINCIPIOS DE ARQUITECTURA\nPara cada principio (mínimo 5):\n### P-XX: [Nombre]\n- Enunciado, Motivación, Implementación, Violación, Métricas de cumplimiento\n\n# 4. OBJETIVOS Y MÉTRICAS\n| ID | Objetivo | Prioridad | Métrica | Baseline | Target 6m | Fase | Fuente dato (query SQL) |\n\nIMPORTANTE: SOLO secciones 1-4. Termina con: ---END_PART_1---`;

      // ── CALL 2: Sections 5-9 (Ontología, Variables, Patrones, Alcance, Personas) ──
      const userPrompt2 = `${sharedContext}\n${servicesContextBlock}\n\nGENERA LAS SECCIONES 5 A 9 DEL PRD LOW-LEVEL EN MARKDOWN:\n\n# 5. ONTOLOGÍA DE ENTIDADES\nPara CADA entidad:\n## 5.X [Nombre]\n- Categoría (producto/industrial/geográfica/temporal/persona/evento/documento/métrica)\n- Campos obligatorios con tipo, descripción, ejemplo\n- Relaciones (1:N, N:M)\n- Ciclo de vida (estados y transiciones)\n- Fuente de verdad\n- Frecuencia actualización\n- Ejemplo concreto con todos los campos\n\nDiagrama Mermaid de relaciones.\n\n# 6. CATÁLOGO DE VARIABLES\nAgrupar TODAS (50-150) por familia:\n## 6.X Familia: [Nombre]\n| Clave | Descripción | Tipo | Unidad | Rango | Fuente | Frecuencia | Valor analítico |\nNO usar "etc." — listar TODAS. Incluir variables derivadas con fórmula.\nFamilias: Core negocio, Operativas, Financieras, Geográficas, Temporales, Usuario, Externas/mercado, Calidad/rendimiento.\n\n# 7. PATRONES DE ALTO VALOR\n(Mínimo 20-30 patrones)\n| Código | Patrón | Condición | Variables | Severidad | Respuesta | Categoría |\nCategorías: operativo, financiero, riesgo, oportunidad, anomalía, estacional, competitivo.\nPara cada: condición en pseudocódigo, variables del catálogo, umbral, falsos positivos, acción.\n\n# 8. ALCANCE V1 CERRADO\n## 8.1 Incluido: | Módulo | Funcionalidad | Prioridad | Fase | Pantalla(s) | Entidad(es) | Variables |\n## 8.2 Excluido: | Funcionalidad | Motivo | Fase futura |\n## 8.3 Supuestos\n\n# 9. PERSONAS Y ROLES\nPara cada usuario (mín 3):\n### Persona: [Nombre], [Rol]\n- Perfil, Dispositivos, Frecuencia, Nivel técnico, Dolor, Rol sistema, Pantallas, Variables que importan, Patrones que alertan\n## 9.1 Matriz de permisos\n\nIMPORTANTE: SOLO secciones 5-9. Termina con: ---END_PART_2---`;

      // ── CALL 3: Sections 10-14 (Flujos, Módulos, RF, NFR, IA) ──
      const userPrompt3 = `${sharedContext}\n\nGENERA LAS SECCIONES 10 A 14 DEL PRD LOW-LEVEL EN MARKDOWN:\n\n# 10. FLUJOS PRINCIPALES\nPara cada flujo (mín 5):\n### Flujo: [Nombre]\n| Paso | Actor | Acción UI | Query Supabase | Estado | Variables afectadas |\nEdge cases con respuesta.\n\n# 11. MÓDULOS DEL PRODUCTO\nPara CADA módulo:\n## 11.X [Nombre] — Fase [N] — [P0/P1/P2]\n- Pantallas (con rutas), Entidades, Variables del catálogo, Patrones evaluados, Edge Functions, Dependencias\n\n# 12. REQUISITOS FUNCIONALES\n### RF-001: [Título]\n- Como [rol] quiero [acción] para [beneficio]\n- DADO/CUANDO/ENTONCES\n- Variables involucradas, Prioridad, Fase\n\n# 13. REQUISITOS NO FUNCIONALES\n| ID | Categoría | Requisito | Métrica | Herramienta |\n\n# 14. DISEÑO DE IA\nPara CADA componente IA:\n## AI-XXX: [Nombre]\n- Edge Function, Trigger, Modelo, Input/Output JSON, Variables usadas, Patrones que alimenta, Prompt base, Fallback, Guardrails, Logging, Métricas, Coste, Secrets\n\nIMPORTANTE: SOLO secciones 10-14. Termina con: ---END_PART_3---`;

      // ── PARALLEL EXECUTION: Parts 1, 2, 3 ──
      console.log("[PRD] Starting Parts 1-3 in PARALLEL (6-part LLD)...");
      const startParallel = Date.now();
      const [result1, result2, result3] = await Promise.all([
        callPrdModel(prdSystemPrompt, userPrompt1),
        callPrdModel(prdSystemPrompt, userPrompt2),
        callPrdModel(prdSystemPrompt, userPrompt3),
      ]);
      totalTokensInput += result1.tokensInput + result2.tokensInput + result3.tokensInput;
      totalTokensOutput += result1.tokensOutput + result2.tokensOutput + result3.tokensOutput;
      const parallelMs = Date.now() - startParallel;
      console.log(`[PRD] Parts 1-3 done in ${(parallelMs / 1000).toFixed(1)}s (P1: ${result1.tokensOutput}, P2: ${result2.tokensOutput}, P3: ${result3.tokensOutput} tokens)`);

      // ── CALL 4: Sections 15-19 (Scoring, SQL, Edge Functions, Integraciones, Seguridad) — SEQUENTIAL ──
      let servicesBlockP4 = "";
      if (servicesDecision?.rag?.necesario) {
        servicesBlockP4 += `\nSERVICIO EXTERNO: RAG\n- Proxy: rag-proxy → { answer, citations, confidence }\n- Secrets: AGUSTITO_RAG_URL, AGUSTITO_RAG_KEY, AGUSTITO_RAG_ID\n- NO crear tablas pgvector/embeddings\n`;
      }
      if (servicesDecision?.pattern_detector?.necesario) {
        servicesBlockP4 += `\nSERVICIO EXTERNO: Detector de Patrones\n- Proxy: patterns-proxy → { layers, composite_scores, model_verdict }\n- Secrets: AGUSTITO_PATTERNS_URL, AGUSTITO_PATTERNS_KEY, AGUSTITO_PATTERNS_RUN_ID\n- Señales established (1.0x) vs trial (0.5x)\n`;
      }

      const userPrompt4 = `PARTES 1-3 YA GENERADAS:\nPARTE 1:\n${result1.text}\n\nPARTE 2:\n${result2.text}\n\nPARTE 3:\n${result3.text}\n${servicesBlockP4}\n\nGENERA SECCIONES 15-20 DEL PRD LOW-LEVEL:\n\n# 15. INVENTARIO FORMAL DE COMPONENTES IA\nEste inventario es copy-pasteable en Lovable o cualquier herramienta de generación full-stack.\n\n## 15.1 RAGs (Bases de Conocimiento)\nTabla EXACTA:\n| ID | Nombre | Función específica | Fuentes de datos | Volumen estimado (docs/tokens) | Modelo embedding | Chunk strategy | Actualización | Edge Function asociada |\nPara CADA RAG, detalla:\n- Esquema de metadatos del chunk\n- Query template (ejemplo real de pregunta → retrieval → respuesta)\n- Fallback si no hay resultados relevantes\n- Métricas: precision@5 target, latencia p95 target\n\n## 15.2 Agentes / Especialistas IA\nTabla EXACTA:\n| ID | Nombre | Rol específico | Modelo LLM | Prompt base (completo, copy-pasteable) | Input JSON schema | Output JSON schema | Métricas (precisión, latencia, coste/call) | Edge Function | Trigger |\nPara CADA agente:\n- System prompt COMPLETO (no resumido, listo para usar)\n- Ejemplos de input/output reales (mínimo 2)\n- Guardrails y validaciones post-respuesta\n- Estrategia de fallback (modelo alternativo, respuesta por defecto)\n- Coste estimado por llamada\n\n## 15.3 Motores Deterministas (Scoring, Reglas, Cálculos)\nTabla EXACTA:\n| ID | Nombre | Tipo (scoring/reglas/cálculo) | Inputs | Output | Fórmula/Lógica | Variables del catálogo usadas | Frecuencia ejecución |\nPara CADA motor:\n- Pseudocódigo o TypeScript de la lógica core\n- Casos de prueba (input → output esperado, mín 3)\n- Umbrales y thresholds configurables\n\n## 15.4 Mapa de Interconexiones\nDiagrama Mermaid que muestre:\n- Flujo de datos entre RAGs, Agentes y Motores\n- Qué componente alimenta a cuál\n- Puntos de entrada (usuario, cron, webhook)\n- Puntos de salida (UI, notificación, almacenamiento)\n\nTabla de dependencias:\n| Componente origen | Componente destino | Tipo de dato transferido | Frecuencia | Criticidad |\n\n## 15.5 Resumen de Infraestructura IA\n| Métrica | Valor |\n| Total RAGs | X |\n| Total Agentes | X |\n| Total Motores Deterministas | X |\n| Coste IA estimado mensual (100 usuarios) | $X |\n| Coste IA estimado mensual (1000 usuarios) | $X |\n| Secrets necesarios | X (lista) |\n| Edge Functions IA | X (lista) |\n\n# 16. MOTOR DE SCORING Y RIESGO\n## 16.1 Fórmula conceptual (score_final = f(vars) × confianza × frescura)\n## 16.2 Variables objetivo con peso y normalización\n## 16.3 Incertidumbre y abstención\n## 16.4 Reglas de convergencia (señales contradictorias, cascade logic)\n## 16.5 Signal Object estandarizado (TypeScript interface)\n## 16.6 Tiers de frescura (F0-F4 adaptados al dominio)\n\n# 17. MODELO DE DATOS SQL COMPLETO\n## 17.1 Schema SQL (CREATE TABLE con tipos, constraints, defaults, índices)\nIMPORTANTE: auth.users para auth. Tabla perfiles REFERENCIA auth.users(id).\n## 17.2 RLS Policies completas (USING + WITH CHECK)\n## 17.3 Storage Buckets\n## 17.4 Diagrama Mermaid completo\n## 17.5 Índices y vistas materializadas\n\n# 18. EDGE FUNCTIONS Y ORQUESTACIÓN\nPara CADA Edge Function:\n## EF-XXX: [Nombre]\n- Trigger, Cadencia, Input/Output JSON, Tablas que lee/escribe, Variables afectadas, Timeout, Fallback, Secrets\n### Tabla de cadencias\n| Edge Function | Cadencia | Trigger | Tablas | Timeout |\n\n# 19. INTEGRACIONES Y SIGNAL OBJECT\n| Sistema | Tipo | Endpoint | Auth | Rate limit | Fallback | Edge Function | Secrets | Variables alimentadas |\n## 19.1 Flujo de señales (Fuente → Ingestión → Raw → Proceso → Signal → Score)\n\n# 20. SEGURIDAD, RLS Y GOBIERNO\n## 20.1 Acceso por rol (tabla)\n## 20.2 Gobierno (retención, purga, auditoría, RGPD)\n## 20.3 Secrets management\n\nIMPORTANTE: SOLO secciones 15-20. Termina con: ---END_PART_4---`;

      console.log("[PRD] Starting Part 4/6 (Scoring, SQL, Integrations)...");
      const result4 = await callPrdModel(prdSystemPrompt, userPrompt4);
      totalTokensInput += result4.tokensInput;
      totalTokensOutput += result4.tokensOutput;
      console.log(`[PRD] Part 4 done: ${result4.tokensOutput} tokens`);

      // ── CALL 5: Sections 20-24 (UX, Telemetría, Riesgos, Fases, Matriz) — SEQUENTIAL ──
      const truncP = (s: string, max = 3000) => s.length > max ? s.substring(0, max) + "\n[...truncado]" : s;
      const userPrompt5 = `PARTES 1-4 YA GENERADAS (resúmenes):\nP1: ${truncP(result1.text)}\nP2: ${truncP(result2.text)}\nP3: ${truncP(result3.text)}\nP4: ${truncP(result4.text)}\n\nGENERA SECCIONES 21-25 DEL PRD LOW-LEVEL:\n\n# 21. UX Y WIREFRAMES TEXTUALES\nPara CADA pantalla:\n## 21.X Pantalla: [Nombre] — Ruta: [/ruta]\n- Acceso, Layout, Componentes (con variables del catálogo), Estados (loading/empty/error/success), Query Supabase exacta, Responsive, Interacciones\n\n# 22. TELEMETRÍA Y ANALÍTICA\n## 22.1 Eventos | Evento | Trigger | Datos | Tabla | Variables |\n## 22.2 KPIs admin | KPI | Query SQL | Frecuencia | Alerta |\n## 22.3 Alertas automáticas con patrones PAT-xxx\n## 22.4 Dashboard de salud (latencia, frescura, coste IA)\n\n# 23. RIESGOS Y MITIGACIONES\n| ID | Riesgo | Probabilidad | Impacto | Mitigación | Responsable | Indicador | Patrón |\n\n# 24. PLAN DE FASES\nPara CADA fase:\n## Fase X: [Nombre] (X semanas)\n- Pantallas, Tablas, Edge Functions, Variables activadas, Patrones activados, Componentes, Criterio éxito (query SQL), Coste, Dependencias\n\n# 25. MATRIZ DE DESPLIEGUE\n| Componente | Core MVP | Alpha Edge | Experimental | Descartado | Justificación |\n\nIMPORTANTE: SOLO secciones 21-25. Termina con: ---END_PART_5---`;

      console.log("[PRD] Starting Part 5/6 (UX, Telemetry, Phases, Matrix)...");
      const result5 = await callPrdModel(prdSystemPrompt, userPrompt5);
      totalTokensInput += result5.tokensInput;
      totalTokensOutput += result5.tokensOutput;
      console.log(`[PRD] Part 5 done: ${result5.tokensOutput} tokens`);

      // ── CALL 6: Blueprint + Checklist + Specs + Glosario — SEQUENTIAL ──
      let blueprintSecretsBlock = "";
      let blueprintProxiesBlock = "";
      if (servicesDecision?.rag?.necesario) {
        blueprintSecretsBlock += `\n| AGUSTITO_RAG_URL | Endpoint RAG | ManIAS Lab. |\n| AGUSTITO_RAG_KEY | API key RAG | ManIAS Lab. |\n| AGUSTITO_RAG_ID | ID proyecto RAG | ManIAS Lab. |`;
        blueprintProxiesBlock += `\n### Edge Function: rag-proxy\n- POST (auth) → server-to-server → { answer, citations, confidence }\n- Fallback: "No disponible"`;
      }
      if (servicesDecision?.pattern_detector?.necesario) {
        blueprintSecretsBlock += `\n| AGUSTITO_PATTERNS_URL | Endpoint detector | ManIAS Lab. |\n| AGUSTITO_PATTERNS_KEY | API key patrones | ManIAS Lab. |\n| AGUSTITO_PATTERNS_RUN_ID | ID run | ManIAS Lab. |`;
        blueprintProxiesBlock += `\n### Edge Function: patterns-proxy\n- POST (auth) → server-to-server → { layers, composite_scores, model_verdict }\n- Fallback: "No disponible"`;
      }
      const secretsSection = blueprintSecretsBlock ? `\n\n## Secrets\n| Secret | Descripción | Por |\n| SUPABASE_URL | URL | Auto |\n| SUPABASE_ANON_KEY | Key | Auto |${blueprintSecretsBlock}` : "";
      const proxiesSection = blueprintProxiesBlock ? `\n\n## Edge Functions Proxy${blueprintProxiesBlock}` : "";

      const userPrompt6 = `PARTES 1-5 (resúmenes):\nP1: ${truncP(result1.text, 2000)}\nP2: ${truncP(result2.text, 2000)}\nP3: ${truncP(result3.text, 2000)}\nP4: ${truncP(result4.text, 2000)}\nP5: ${truncP(result5.text, 2000)}\n\nFASE OBJETIVO: ${targetPhase}\n\nGenera TRES bloques separados:\n\n---\n\n# LOVABLE BUILD BLUEPRINT\n> Copy-paste en Lovable.dev. SOLO la fase indicada.\n\n## Contexto\n## Stack\nReact + Vite + TypeScript + Tailwind CSS + shadcn/ui + Supabase\n## Pantallas y Rutas\n| Ruta | Componente | Acceso | Descripción |\n## Wireframes Textuales\n## Componentes Reutilizables\n| Componente | Descripción | Usado en |\n## Base de Datos\n\`\`\`sql\n-- Solo tablas de esta fase con RLS\n\`\`\`\n## Edge Functions${proxiesSection}\n## Inventario IA (resumen de sección 15)\nCopia las tablas de RAGs, Agentes y Motores de la sección 15 relevantes para esta fase.\n## Design System${secretsSection}\n## Auth Flow\n## QA Checklist\n\n---\n\n# CHECKLIST MAESTRO DE CONSTRUCCIÓN\n## P0 — Bloquea lanzamiento\n- [ ] item (ref sección)\n## P1 — Importante\n- [ ] item\n## P2 — Deseable\n- [ ] item\n\n---\n\n# SPECS PARA FASES POSTERIORES\n## D1 — Spec RAG (Fase 8)\n## D2 — Spec Detector de Patrones (Fase 9)\n\n# 26. GLOSARIO Y ANEXOS\n## 26.1 Glosario | Término | Definición | Contexto |\n## 26.2 Referencias\n\nTermina con: ---END_PART_6---`;

      console.log("[PRD] Starting Part 6/6 (Blueprint + Checklist + Specs)...");
      const result6 = await callPrdModel(prdSystemPrompt, userPrompt6);
      totalTokensInput += result6.tokensInput;
      totalTokensOutput += result6.tokensOutput;
      console.log(`[PRD] Part 6 done: ${result6.tokensOutput} tokens`);

      // ── CALL 7: Validation (Claude Sonnet as auditor) ──
      const validationSystemPrompt = `Eres un auditor técnico de PRDs low-level (6 partes). Verificas consistencia interna. NO reescribes — solo señalas problemas.\nREGLAS:\n- Variables del catálogo referenciadas en patrones, scoring, Edge Functions\n- Patrones usan variables que existen en catálogo\n- Tablas SQL = entidades de ontología\n- Pantallas Blueprint tienen wireframe\n- Edge Functions Blueprint documentadas en sección 17\n- Fases consistentes\n- RLS cubre todos los flujos\n- Stack SOLO React+Vite+Supabase\n- Nombres propios correctos\n- Matriz despliegue cubre todas las features\n- Checklist referencia secciones reales\n- Responde SOLO JSON válido.`;

      const truncVal = (s: string, max = 6000) => s.length > max ? s.substring(0, max) + "\n[...truncado]" : s;
      const validationPrompt = `P1:\n${truncVal(result1.text)}\nP2:\n${truncVal(result2.text)}\nP3:\n${truncVal(result3.text)}\nP4:\n${truncVal(result4.text)}\nP5:\n${truncVal(result5.text)}\nP6:\n${truncVal(result6.text)}\n\nAnaliza 6 partes y devuelve:\n{\n  "consistencia_global": 0-100,\n  "issues": [{"id":"PRD-V-001","severidad":"...","tipo":"...","descripción":"...","ubicación":"...","corrección_sugerida":"..."}],\n  "resumen": "...",\n  "cobertura": {"variables_referenciadas":"X de Y","patrones_con_variables":"X de Y","tablas_con_rls":"X de Y","pantallas_con_wireframe":"X de Y"},\n  "nombres_verificados": {"empresa_cliente":"...","stakeholders":["..."],"producto":"..."}\n}`;

      console.log("[PRD] Starting validation call (Gemini Pro, fallback Claude)...");
      let validationResult: { text: string; tokensInput: number; tokensOutput: number } | null = null;
      let validationData: any = null;
      try {
        try {
          validationResult = await callGeminiPro(validationSystemPrompt, validationPrompt);
        } catch {
          console.warn("[PRD] Gemini Pro validation failed, trying Claude...");
          validationResult = await callClaudeSonnet(validationSystemPrompt, validationPrompt);
        }
        totalTokensInput += validationResult.tokensInput;
        totalTokensOutput += validationResult.tokensOutput;
        console.log(`[PRD] Validation done: ${validationResult.tokensOutput} tokens`);
        try {
          let cleaned = validationResult.text.trim();
          if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
          if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
          if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
          validationData = JSON.parse(cleaned.trim());
        } catch {
          console.warn("[PRD] Validation JSON parse failed");
          validationData = { consistencia_global: -1, issues: [], resumen: "Validation parse failed" };
        }
      } catch (validationError) {
        console.warn("[PRD] Validation call failed:", validationError instanceof Error ? validationError.message : validationError);
        validationData = { consistencia_global: -1, issues: [], resumen: "Validation call failed" };
      }

      // ── CONCATENATE parts ──
      let part1Text = result1.text;
      let part2Text = result2.text;
      let part3Text = result3.text;
      let part4Text = result4.text;
      let part5Text = result5.text;
      let part6Text = result6.text;

      // ── DETERMINISTIC LINTER (6-part) ──
      const linterWarnings: string[] = [];
      let linterRetried = false;

      const runLinter = (p1: string, p2: string, p3: string, p4: string, p5: string, p6: string) => {
        const combined = [p1, p2, p3, p4, p5, p6].join("\n\n");
        const warnings: string[] = [];

        // Check 25 sections exist (# 1. through # 25. — some may be sub-sections)
        const coreSections = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
        const missingSections: number[] = [];
        for (const i of coreSections) {
          const sectionRegex = new RegExp(`#\\s+${i}\\.\\s`);
          if (!sectionRegex.test(combined)) {
            missingSections.push(i);
          }
        }
        if (missingSections.length > 0) {
          warnings.push(`MISSING_SECTIONS: ${missingSections.join(", ")}`);
        }

        // Check LOVABLE BUILD BLUEPRINT exists
        if (!/# LOVABLE BUILD BLUEPRINT/i.test(combined)) {
          warnings.push("MISSING_BLUEPRINT_HEADER");
        }

        // Check blueprint content
        const bpMatch = combined.match(/# LOVABLE BUILD BLUEPRINT[\s\S]*?(?=# CHECKLIST MAESTRO|# SPECS PARA FASES|$)/i);
        const bpContent = bpMatch ? bpMatch[0].replace(/# LOVABLE BUILD BLUEPRINT[^\n]*\n/, "").trim() : "";
        if (bpContent.length < 100) {
          warnings.push(`BLUEPRINT_TOO_SHORT: ${bpContent.length} chars`);
        }

        // Check Checklist Maestro
        if (!/# CHECKLIST MAESTRO/i.test(combined)) {
          warnings.push("MISSING_CHECKLIST_MAESTRO");
        }

        // Check D1 and D2 specs
        if (!/##\s*D1/i.test(combined)) warnings.push("MISSING_SPEC_D1");
        if (!/##\s*D2/i.test(combined)) warnings.push("MISSING_SPEC_D2");

        // Check catálogo de variables exists with at least some entries
        const varTableMatches = combined.match(/\|\s*var_\d+/g) || [];
        if (varTableMatches.length < 10) {
          warnings.push(`LOW_VARIABLE_COUNT: ${varTableMatches.length} (expected 50+)`);
        }

        // Check patrones exist
        const patternMatches = combined.match(/\|\s*PAT-\d+/g) || [];
        if (patternMatches.length < 5) {
          warnings.push(`LOW_PATTERN_COUNT: ${patternMatches.length} (expected 20+)`);
        }

        return { warnings, missingSections };
      };

      const lintResult = runLinter(part1Text, part2Text, part3Text, part4Text, part5Text, part6Text);

      if (lintResult.warnings.length > 0) {
        console.warn("[PRD Linter] Issues found:", lintResult.warnings.join("; "));

        const needRetryPart6 = lintResult.warnings.some(w =>
          w.includes("BLUEPRINT") || w.includes("SPEC_D1") || w.includes("SPEC_D2") || w.includes("CHECKLIST")
        );
        const needRetryPart5 = lintResult.missingSections.some(s => s >= 20 && s <= 24);
        const needRetryPart4 = lintResult.missingSections.some(s => s >= 15 && s <= 19);

        if (needRetryPart6 && !linterRetried) {
          console.log("[PRD Linter] Retrying Part 6 (Blueprint + Checklist + Specs)...");
          linterRetried = true;
          try {
            const retryResult = await callPrdModel(prdSystemPrompt, userPrompt6);
            totalTokensInput += retryResult.tokensInput;
            totalTokensOutput += retryResult.tokensOutput;
            part6Text = retryResult.text;
          } catch (e) { console.error("[PRD Linter] Part 6 retry failed:", e instanceof Error ? e.message : e); }
        } else if (needRetryPart5 && !linterRetried) {
          console.log("[PRD Linter] Retrying Part 5...");
          linterRetried = true;
          try {
            const retryResult = await callPrdModel(prdSystemPrompt, userPrompt5);
            totalTokensInput += retryResult.tokensInput;
            totalTokensOutput += retryResult.tokensOutput;
            part5Text = retryResult.text;
          } catch (e) { console.error("[PRD Linter] Part 5 retry failed:", e instanceof Error ? e.message : e); }
        } else if (needRetryPart4 && !linterRetried) {
          console.log("[PRD Linter] Retrying Part 4...");
          linterRetried = true;
          try {
            const retryResult = await callPrdModel(prdSystemPrompt, userPrompt4);
            totalTokensInput += retryResult.tokensInput;
            totalTokensOutput += retryResult.tokensOutput;
            part4Text = retryResult.text;
          } catch (e) { console.error("[PRD Linter] Part 4 retry failed:", e instanceof Error ? e.message : e); }
        }

        const finalLint = runLinter(part1Text, part2Text, part3Text, part4Text, part5Text, part6Text);
        if (finalLint.warnings.length > 0) {
          console.warn("[PRD Linter] Remaining:", finalLint.warnings.join("; "));
          linterWarnings.push(...finalLint.warnings);
        } else {
          console.log("[PRD Linter] All issues resolved after retry.");
        }
      } else {
        console.log("[PRD Linter] All checks passed.");
      }

      // ── CONCATENATE & CLEAN ──
      const fullPrd = [part1Text, part2Text, part3Text, part4Text, part5Text, part6Text]
        .join("\n\n")
        .replace(/---END_PART_[1-6]---/g, "")
        .trim();

      const blueprintMatch = fullPrd.match(/# LOVABLE BUILD BLUEPRINT[\s\S]*?(?=# CHECKLIST MAESTRO|# SPECS PARA FASES|$)/i);
      const blueprint = blueprintMatch ? blueprintMatch[0].trim() : "";

      const checklistMatch = fullPrd.match(/# CHECKLIST MAESTRO[\s\S]*?(?=# SPECS PARA FASES|$)/i);
      const checklist = checklistMatch ? checklistMatch[0].trim() : "";

      const specsMatch = fullPrd.match(/# SPECS PARA FASES[\s\S]*?(?=# 25\.|$)/i);
      const specs = specsMatch ? specsMatch[0].trim() : "";

      // ── COST CALCULATION ──
      const generativeTokensInput = totalTokensInput - (validationResult?.tokensInput || 0);
      const generativeTokensOutput = totalTokensOutput - (validationResult?.tokensOutput || 0);
      const generativeRates = prdFallbackUsed ? { input: 3.00, output: 15.00 } : { input: 1.25, output: 5.00 };
      const generativeCost = (generativeTokensInput / 1_000_000) * generativeRates.input + (generativeTokensOutput / 1_000_000) * generativeRates.output;
      const validationCost = validationResult ? (validationResult.tokensInput / 1_000_000) * 3.00 + (validationResult.tokensOutput / 1_000_000) * 15.00 : 0;
      const costUsd = generativeCost + validationCost;

      await recordCost(supabase, {
        projectId, stepNumber: 5, service: mainModelUsed, operation: "generate_prd",
        tokensInput: totalTokensInput, tokensOutput: totalTokensOutput,
        costUsd, userId: user.id,
        metadata: {
          parts: 6, validation: true,
          tokens_part1: result1.tokensOutput, tokens_part2: result2.tokensOutput,
          tokens_part3: result3.tokensOutput, tokens_part4: result4.tokensOutput,
          tokens_part5: result5.tokensOutput, tokens_part6: result6.tokensOutput,
          tokens_validation: validationResult?.tokensOutput || 0,
          consistencia_global: validationData?.consistencia_global || -1,
          validation_issues_count: validationData?.issues?.length || 0,
          fallback_used: prdFallbackUsed, generative_model: mainModelUsed,
          target_phase: targetPhase,
          linter_retried: linterRetried,
          linter_warnings: linterWarnings.length > 0 ? linterWarnings : undefined,
          async_execution: true,
          prd_version: "v12-lld",
        },
      });

      // ── VALIDATE & SAVE RESULT ──
      const prdValidation = runAllValidators(5, null, fullPrd, {
        2: briefStr.substring(0, 5000),
        3: finalStr.substring(0, 5000),
        4: aiLevStr.substring(0, 5000),
      });

      const newVersion = initVersion;

      const prdOutputData: Record<string, any> = {
        document: fullPrd,
        blueprint,
        checklist,
        specs,
        validation: validationData,
      };
      if (Object.keys(prdValidation.flags).length > 0) {
        prdOutputData._contract_validation = prdValidation.flags;
      }

      // ── SAVE PRD FIRST (before normalization to prevent timeout data loss) ──
      await supabase.from("project_wizard_steps").update({
        status: "review",
        output_data: prdOutputData,
        model_used: mainModelUsed,
      }).eq("project_id", projectId).eq("step_number", 5).eq("version", newVersion);

      // Also update step 3 (mapped from chained) — copy output_data so wizard shows PRD
      await supabase.from("project_wizard_steps").update({
        status: "review",
        output_data: prdOutputData,
        model_used: mainModelUsed,
      }).eq("project_id", projectId).eq("step_number", 3);

      await supabase.from("project_documents").insert({
        project_id: projectId,
        step_number: 5,
        version: newVersion,
        content: fullPrd,
        format: "markdown",
        user_id: user.id,
      });

      if (blueprint) {
        await supabase.from("project_documents").insert({
          project_id: projectId,
          step_number: 5,
          version: newVersion,
          content: blueprint,
          format: "markdown",
          user_id: user.id,
        });
      }

      await supabase.from("business_projects").update({ current_step: 3 }).eq("id", projectId);

      console.log(`[PRD] Background generation saved successfully (6-part LLD). Version: ${newVersion}`);

      // ── CALL 7: PRD TRIPLE EXTRACTION — 3 Layers (non-blocking, PRD already saved) ──
      try {
        console.log("[PRD] Starting triple-layer extraction (Call 7)...");

        const normalizationSystemPrompt = `Eres un arquitecto de sistemas experto en extracción estructurada de documentos técnicos. Tu misión es EXTRAER las tres capas embebidas de un PRD Maestro con Triple Capa, sin inventar contenido nuevo.

REGLAS ESTRICTAS:
- NO inventes información. Solo extrae lo que existe en el documento.
- Busca los markers ═══CAPA_B═══, ═══CAPA_A═══, ═══CAPA_C═══ o secciones equivalentes.
- Si no hay markers explícitos, identifica las secciones por contenido.
- Extrae las tres capas y sepáralas con los delimitadores indicados.

FORMATO DE SALIDA:
Devuelve TRES documentos separados por delimitadores exactos:
===LAYER_B=== (Contrato de Interpretación)
===LOVABLE_ADAPTER=== (Lovable Build Adapter)
===FORGE_ADAPTER=== (Expert Forge Adapter)`;

        // Truncate to 80k to avoid timeout
        const normalizationUserPrompt = `Extrae las tres capas del siguiente PRD Maestro.

===PRD COMPLETO===
${fullPrd.substring(0, 80000)}
===FIN PRD===

EXTRACCIÓN A — CONTRATO DE INTERPRETACIÓN (Capa B)
Extrae: reglas anti-reinterpretación, nomenclatura canónica, clasificación de componentes, bindings RAG, build scope, roadmap scope.

EXTRACCIÓN B — LOVABLE BUILD ADAPTER (Capa C.1)
Extrae: módulos MVP, rutas, SQL, RBAC, QA checklist, exclusiones, matriz de trazabilidad.
ELIMINAR: Soul, RAGs, especialistas IA, router MoE, hidratación, fases futuras detalladas.

EXTRACCIÓN C — EXPERT FORGE ADAPTER (Capa C.2)
Extrae: knowledge domains, core entities, RAGs propuestos, especialistas, motores deterministas, router logic, soul inputs, hydration plan, frontera determinista vs probabilístico.
ELIMINAR: SQL schemas, wireframes UI, rutas pantalla, edge functions CRUD, QA checklist.

Separa con delimitadores EXACTOS: ===LAYER_B===, ===LOVABLE_ADAPTER===, ===FORGE_ADAPTER===`;

        // Add timeout to normalization call
        const normAbort = new AbortController();
        const normTimeout = setTimeout(() => normAbort.abort(), 120_000); // 2 min max

        let normResult: { text: string; tokensInput: number; tokensOutput: number };
        try {
          normResult = await callGeminiFlashMarkdown(normalizationSystemPrompt, normalizationUserPrompt);
        } catch (geminiErr) {
          if (normAbort.signal.aborted) throw new Error("Normalization timeout");
          console.warn("[PRD] Normalization Gemini failed, trying Claude:", geminiErr instanceof Error ? geminiErr.message : geminiErr);
          normResult = await callClaudeSonnet(normalizationSystemPrompt, normalizationUserPrompt);
        }
        clearTimeout(normTimeout);

        const layerBMarker = "===LAYER_B===";
        const lovableMarker = "===LOVABLE_ADAPTER===";
        const forgeMarker = "===FORGE_ADAPTER===";

        const layerBIdx = normResult.text.indexOf(layerBMarker);
        const lovableIdx = normResult.text.indexOf(lovableMarker);
        const forgeIdx = normResult.text.indexOf(forgeMarker);

        if (layerBIdx >= 0 && lovableIdx > layerBIdx && forgeIdx > lovableIdx) {
          prdOutputData.interpretation_contract = normResult.text.substring(layerBIdx + layerBMarker.length, lovableIdx).trim();
          prdOutputData.lovable_build_prd = normResult.text.substring(lovableIdx + lovableMarker.length, forgeIdx).trim();
          prdOutputData.expert_forge_spec = normResult.text.substring(forgeIdx + forgeMarker.length).trim();
          console.log(`[PRD] Triple extraction done. Contract: ${prdOutputData.interpretation_contract.length} chars, Lovable: ${prdOutputData.lovable_build_prd.length} chars, Forge: ${prdOutputData.expert_forge_spec.length} chars`);
        } else if (lovableIdx >= 0 && forgeIdx > lovableIdx) {
          // Fallback: no Layer B marker but has the other two (backward compat)
          prdOutputData.lovable_build_prd = normResult.text.substring(0, forgeIdx).replace(lovableMarker, "").trim();
          prdOutputData.expert_forge_spec = normResult.text.substring(forgeIdx + forgeMarker.length).trim();
          console.warn("[PRD] Triple extraction partial — no Layer B marker found, extracted Lovable + Forge only.");
        } else {
          // Legacy fallback: try old ===DOCUMENT_SPLIT=== marker
          const legacySplit = "===DOCUMENT_SPLIT===";
          const legacyIdx = normResult.text.indexOf(legacySplit);
          if (legacyIdx > 0) {
            prdOutputData.lovable_build_prd = normResult.text.substring(0, legacyIdx).trim();
            prdOutputData.expert_forge_spec = normResult.text.substring(legacyIdx + legacySplit.length).trim();
            console.warn("[PRD] Triple extraction fallback to legacy dual split.");
          } else {
            console.warn("[PRD] Normalization output missing all split markers.");
          }
        }

        // Update with triple-layer enrichment
        if (prdOutputData.lovable_build_prd || prdOutputData.interpretation_contract) {
          await supabase.from("project_wizard_steps").update({
            output_data: prdOutputData,
          }).eq("project_id", projectId).eq("step_number", 5).eq("version", newVersion);
        }
      } catch (normError) {
        console.error("[PRD] Triple extraction failed (non-blocking, PRD already saved):", normError instanceof Error ? normError.message : normError);
      }

      console.log(`[PRD] Background generation completed successfully (6-part LLD). Version: ${newVersion}`);

        } catch (bgError) {
          console.error("[PRD] Background generation failed:", bgError instanceof Error ? bgError.message : bgError);
          await supabase.from("project_wizard_steps").update({
            status: "error",
            output_data: { error: bgError instanceof Error ? bgError.message : String(bgError) },
          }).eq("project_id", projectId).eq("step_number", 5).eq("version", initVersion);
        }
      };

      (globalThis as any).EdgeRuntime?.waitUntil?.(backgroundWork());

      return new Response(JSON.stringify({
        status: "generating",
        message: "PRD Low-Level Design en generación (6 partes). El resultado aparecerá automáticamente.",
        version: initVersion,
      }), {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: generate_pattern_blueprint (Step 8) ─────────────────────
    if (action === "generate_pattern_blueprint") {
      const sd = stepData;
      
      // Read services_decision from step 4 (AI audit), fallback to legacy step 6
      let servicesDecision: Record<string, any> | null = null;
      try {
        let stepData4: any = null;
        const { data: s4 } = await supabase
          .from("project_wizard_steps")
          .select("output_data")
          .eq("project_id", projectId)
          .eq("step_number", 4)
          .order("version", { ascending: false })
          .limit(1)
          .single();
        stepData4 = s4;
        if (!stepData4) {
          const { data: s6 } = await supabase
            .from("project_wizard_steps")
            .select("output_data")
            .eq("project_id", projectId)
            .eq("step_number", 6)
            .order("version", { ascending: false })
            .limit(1)
            .single();
          stepData4 = s6;
        }
        if (stepData4?.output_data?.services_decision) {
          servicesDecision = stepData4.output_data.services_decision;
        }
      } catch (e) {
        console.warn("[Blueprint] Could not read services_decision:", e);
      }

      const needsPatterns = servicesDecision?.pattern_detector?.necesario === true;
      
      if (!needsPatterns) {
        // Fallback: if no patterns needed, this step generates a generic RAG instead
        // Redirect to the generate_rags action by setting action to generate_rags
        console.log("[Blueprint] Pattern detector not needed, falling back to generic RAG generation");
        // Save a step output indicating no blueprint
        const { data: existingStep } = await supabase
          .from("project_wizard_steps")
          .select("id, version")
          .eq("project_id", projectId)
          .eq("step_number", 8)
          .order("version", { ascending: false })
          .limit(1)
          .single();

        const newVersion = existingStep ? existingStep.version + 1 : 1;

        await supabase.from("project_wizard_steps").upsert({
          id: existingStep?.id || undefined,
          project_id: projectId,
          step_number: 8,
          step_name: "Blueprint de Patrones",
          status: "review",
          input_data: { action: "generate_pattern_blueprint", patterns_needed: false },
          output_data: { 
            pattern_blueprint: null,
            skipped: true,
            reason: "Pattern detector not needed per services_decision",
          },
          model_used: "none",
          version: newVersion,
          user_id: user.id,
        });

        await supabase.from("business_projects").update({ current_step: 8 }).eq("id", projectId);

        return new Response(JSON.stringify({ 
          output: { skipped: true, reason: "Pattern detector not needed" },
          cost: 0, version: newVersion,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Patterns needed: execute Phase 1 + 2 of the detector
      const sector = servicesDecision?.pattern_detector?.sector_sugerido || sd.companyName || "general";
      const geography = servicesDecision?.pattern_detector?.geografia_sugerida || "España";
      const objective = servicesDecision?.pattern_detector?.objetivo_sugerido || "";

      console.log(`[Blueprint] Creating pattern run: sector=${sector}, geography=${geography}`);

      // Create detector run
      const createResp = await fetch(`${SUPABASE_URL}/functions/v1/pattern-detector-pipeline`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "create",
          project_id: projectId,
          user_id: user.id,
          sector,
          geography,
          time_horizon: "12 meses",
          business_objective: objective,
        }),
      });
      const createData = await createResp.json();
      const runId = createData.run_id;
      if (!runId) throw new Error("Failed to create pattern detector run");

      // Execute Phase 1 (inline — light phase)
      console.log("[Blueprint] Executing Phase 1...");
      await fetch(`${SUPABASE_URL}/functions/v1/pattern-detector-pipeline`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "execute_phase", run_id: runId, phase: 1 }),
      });

      // Execute Phase 2 (heavy — wait for it)
      console.log("[Blueprint] Executing Phase 2...");
      const phase2Resp = await fetch(`${SUPABASE_URL}/functions/v1/pattern-detector-pipeline`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "execute_phase", run_id: runId, phase: 2 }),
      });
      const phase2Data = await phase2Resp.json();

      // Poll for completion (Phase 2 runs in background)
      let attempts = 0;
      let runData: any = null;
      while (attempts < 30) {
        await new Promise(r => setTimeout(r, 5000));
        const statusResp = await fetch(`${SUPABASE_URL}/functions/v1/pattern-detector-pipeline`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "status", run_id: runId }),
        });
        runData = await statusResp.json();
        if (runData?.status === "phase_2_complete" || runData?.status === "failed" || 
            (runData?.current_phase && runData.current_phase >= 2 && !runData.status?.includes("running"))) {
          break;
        }
        attempts++;
      }

      if (!runData || runData.status === "failed") {
        throw new Error("Pattern detector Phase 1+2 failed: " + (runData?.error_log || "timeout"));
      }

      const phase1 = (runData.phase_results as Record<string, any>)?.phase_1 || {};
      const phase2 = (runData.phase_results as Record<string, any>)?.phase_2 || {};

      // Fetch discovered sources
      const { data: discoveredSources } = await supabase
        .from("data_sources_registry")
        .select("*")
        .eq("run_id", runId);

      // Build pattern blueprint
      const patternBlueprint = {
        run_id: runId,
        sector,
        geography,
        objective,
        key_variables: phase1.key_variables || [],
        initial_signal_map: phase1.initial_signal_map || [],
        data_requirements: phase1.data_requirements || [],
        baseline_definition: phase1.baseline_definition || "",
        sources: (discoveredSources || []).map((s: any) => ({
          name: s.source_name,
          url: s.url,
          type: s.source_type,
          reliability: s.reliability_score,
          data_type: s.data_type,
        })),
        search_queries: phase2.search_queries || [],
        proxy_queries: phase2.proxy_queries || [],
      };

      // Save step
      const { data: existingStep } = await supabase
        .from("project_wizard_steps")
        .select("id, version")
        .eq("project_id", projectId)
        .eq("step_number", 8)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      const newVersion = existingStep ? existingStep.version + 1 : 1;

      await supabase.from("project_wizard_steps").upsert({
        id: existingStep?.id || undefined,
        project_id: projectId,
        step_number: 8,
        step_name: "Blueprint de Patrones",
        status: "review",
        input_data: { action: "generate_pattern_blueprint", sector, geography, objective },
        output_data: {
          pattern_blueprint: patternBlueprint,
          pattern_run_id: runId,
          status: runData.status,
        },
        model_used: "gemini-flash+gemini-pro",
        version: newVersion,
        user_id: user.id,
      });

      await supabase.from("business_projects").update({ current_step: 8 }).eq("id", projectId);

      return new Response(JSON.stringify({
        output: { pattern_blueprint: patternBlueprint, pattern_run_id: runId },
        cost: 0, // Cost tracked by pattern-detector-pipeline internally
        version: newVersion,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: execute_patterns (Step 10) ─────────────────────────────
    if (action === "execute_patterns") {
      // Read pattern_run_id from step 8 output
      const { data: step8 } = await supabase
        .from("project_wizard_steps")
        .select("output_data")
        .eq("project_id", projectId)
        .eq("step_number", 8)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      const runId = step8?.output_data?.pattern_run_id;
      if (!runId) throw new Error("No pattern run found from Step 8 Blueprint");

      console.log(`[Patterns] Executing remaining phases for run ${runId}`);

      // Execute Phases 3-7 via execute_remaining
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/pattern-detector-pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "execute_remaining", run_id: runId }),
      });
      const result = await resp.json();

      // Create API key for the proxy
      const apiKey = `pk_live_${crypto.randomUUID().replace(/-/g, "")}`;
      await supabase.from("pattern_api_keys").insert({
        run_id: runId,
        api_key: apiKey,
        name: `Project ${projectId}`,
        is_active: true,
        monthly_limit: 1000,
        monthly_usage: 0,
      });

      // Save step
      const { data: existingStep } = await supabase
        .from("project_wizard_steps")
        .select("id, version")
        .eq("project_id", projectId)
        .eq("step_number", 10)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      const newVersion = existingStep ? existingStep.version + 1 : 1;

      await supabase.from("project_wizard_steps").upsert({
        id: existingStep?.id || undefined,
        project_id: projectId,
        step_number: 10,
        step_name: "Ejecución de Patrones",
        status: "review",
        input_data: { action: "execute_patterns", run_id: runId },
        output_data: {
          pattern_run_id: runId,
          pattern_results: result,
          api_key_created: true,
          status: "processing",
        },
        model_used: "gemini-flash+gemini-pro",
        version: newVersion,
        user_id: user.id,
      });

      await supabase.from("business_projects").update({ current_step: 10 }).eq("id", projectId);

      return new Response(JSON.stringify({
        output: { pattern_run_id: runId, status: "processing", api_key_created: true },
        cost: 0,
        version: newVersion,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Generic step handler (Steps 4-6, 9) ───────────────────────────
    // Note: Steps 8 and 10 handled above as custom actions

    const STEP_ACTION_MAP: Record<string, { stepNumber: number; stepName: string; useJson: boolean; model: "flash" | "claude" }> = {
      "run_ai_leverage":   { stepNumber: 4, stepName: "Auditoría IA",          useJson: true,  model: "claude" },
      "generate_mvp":      { stepNumber: 11, stepName: "Descripción del MVP",  useJson: false, model: "claude" },
      // Legacy actions (old pipeline, still supported for retrocompat)
      "run_audit":         { stepNumber: 4, stepName: "Auditoría Cruzada",    useJson: true,  model: "claude" },
      "generate_final_doc":{ stepNumber: 5, stepName: "Documento Final",      useJson: false, model: "claude" },
      "generate_rags":     { stepNumber: 9, stepName: "RAG Dirigido",          useJson: true,  model: "flash" },
      "detect_patterns":   { stepNumber: 10, stepName: "Detección de Patrones",useJson: true,  model: "claude" },
    };

    const stepConfig = STEP_ACTION_MAP[action];
    if (stepConfig) {
      const { stepNumber, stepName, useJson, model } = stepConfig;
      
      // Build prompts based on step
      let systemPrompt = "";
      let userPrompt = "";
      const sd = stepData;
      const briefStr = truncate(typeof sd.briefingJson === "string" ? sd.briefingJson : JSON.stringify(sd.briefingJson || {}, null, 2));
      const scopeStr = truncate(typeof sd.scopeDocument === "string" ? sd.scopeDocument : JSON.stringify(sd.scopeDocument || {}, null, 2));
      const auditStr = truncate(typeof sd.auditJson === "string" ? sd.auditJson : JSON.stringify(sd.auditJson || {}, null, 2));
      const finalStr = truncate(typeof sd.finalDocument === "string" ? sd.finalDocument : JSON.stringify(sd.finalDocument || {}, null, 2));
      const aiLevStr = truncate(typeof sd.aiLeverageJson === "string" ? sd.aiLeverageJson : JSON.stringify(sd.aiLeverageJson || {}, null, 2));
      const prdStr = truncate(typeof sd.prdDocument === "string" ? sd.prdDocument : JSON.stringify(sd.prdDocument || {}, null, 2));

      if (action === "run_audit") {
        systemPrompt = `PROTOCOLO ANTI-FALSOS-POSITIVOS (A-01) — EJECUTAR ANTES DE CADA HALLAZGO:
Antes de registrar cualquier hallazgo OMISIÓN:
1. ¿Aparece en Exclusiones Explícitas (sección 5.4 o equivalente)? → SÍ: no es omisión. Decisión documentada. Convertir a [[NO_APLICA:en exclusiones explícitas]]. No incluir en score.
2. ¿Aparece en Datos Pendientes o Bloqueos? → SÍ: no es omisión. Bloqueo registrado. Convertir a [[NO_APLICA:en datos pendientes]]. No incluir en score.
3. ¿Pertenece a un proyecto diferente mencionado como paralelo o excluido? → SÍ: fuera de scope. Convertir a [[NO_APLICA:fuera de scope]]. No incluir en score.
Solo registra OMISIÓN si el dato no aparece en ninguna verificación Y debería estar según el briefing.
SCOPE: solo auditas el proyecto documentado. Otros proyectos del cliente, otras verticales, otros clientes = irrelevantes para este audit.
Los hallazgos marcados como [[NO_APLICA:razón]] NO restan puntos al score global. Solo los hallazgos con estado ABIERTO cuentan para la puntuación.
En el JSON de salida, incluye un campo "hallazgos_no_aplica" separado con los items descartados (para trazabilidad interna dentro de [[INTERNAL_ONLY]]).

PUNTUACIÓN GLOBAL (A-02):
Siempre como campo de texto explícito: "Puntuación Global: XX/100"
Nunca como elemento puramente visual.
Criterio incluido siempre:
90-100: Aprobado sin cambios
75-89:  Aprobado con correcciones menores
60-74:  Aprobado con correcciones importantes
<60:    Requiere revisión mayor

CHECK OBLIGATORIO — COHERENCIA URGENCIA/TIMELINE (A-03):
1. ¿El briefing menciona plazo máximo para el MVP?
2. ¿El plan de fases tiene entregable funcional demostrable dentro de ese plazo? (usar definición operativa: output operativo sobre datos reales, NO wireframes ni documentos)
3. Si NO → hallazgo obligatorio:
   {"tipo": "INCONSISTENCIA", "severidad": "CRÍTICO", "sección": "Plan de Implementación", "problema": "El cliente declara MVP en [X semanas] pero el primer entregable funcional demostrable llega en semana [Y].", "accion_requerida": "Definir qué constituye el MVP operativo para el plazo comprometido y separarlo de las fases de plataforma completa."}

Eres un auditor de calidad de proyectos tecnológicos con 15 años de experiencia en consultoras Big Four. Tu trabajo es comparar un documento de alcance generado contra el material fuente original y detectar TODAS las discrepancias, omisiones o inconsistencias.

REGLAS:
- Sé exhaustivo y metódico. Revisa sección por sección del documento contra el material original.
- Asigna códigos secuenciales a cada hallazgo: [H-01], [H-02], etc.
- Clasifica por severidad con indicador visual:
  - 🔴 CRÍTICO: Bloquea el proyecto o la presentación al cliente. Requiere acción inmediata.
  - 🟠 IMPORTANTE: Afecta calidad o completitud. Debe corregirse antes de entregar.
  - 🟢 MENOR: Mejora deseable. Puede incorporarse sin urgencia.
- Distingue entre tipos: OMISIÓN (dato del original que falta), INCONSISTENCIA (dato que contradice el original), RIESGO_NO_CUBIERTO (situación sin mitigación), MEJORA (sugerencia que no es error).
- Para CADA hallazgo incluye obligatoriamente:
  1. Sección afectada del documento de alcance
  2. Problema concreto (no vago)
  3. Dato original textual: cita EXACTA del material fuente (con minuto si es transcripción o referencia si es documento)
  4. Acción requerida: qué hacer exactamente para corregirlo
  5. Consecuencia de no corregir: qué pasa si se ignora este hallazgo
- No generes falsos positivos. Si algo se simplificó correctamente, no lo marques como omisión.
- La tabla de puntuación por sección debe incluir notas breves que justifiquen la puntuación (como "Falta control horario, multi-sede, stack").
- La recomendación final debe ser UNA de: APROBAR / APROBAR CON CORRECCIONES / RECHAZAR Y REGENERAR.
- COMPARA SIEMPRE el orden de implementación del documento con lo acordado en la reunión original. Si el cliente o proveedor propuso demostrar X primero, eso debe reflejarse en Fase 1 del cronograma. Si no coincide, generar hallazgo de tipo INCONSISTENCIA.
- VERIFICA que todos los temas discutidos en la reunión tienen módulo asignado. Si se habló de control horario, pausas, horas extra u otra funcionalidad, debe existir un módulo para ello. Si falta, generar hallazgo de tipo OMISIÓN.
- NO permitas que el documento de alcance baje presupuestos a rangos irrealistas solo para alinear con expectativas del cliente. Si el presupuesto propuesto es insuficiente para el alcance definido, señálalo como hallazgo CRÍTICO de tipo RIESGO_NO_CUBIERTO.
- REGLA ESPECÍFICA MVP: Si en el material fuente el proveedor propuso una funcionalidad como PRIMERA DEMOSTRACIÓN DE VALOR (ej: 'validar reconocimiento de fotos', 'demo de OCR', 'probar la IA con datos reales'), esa funcionalidad DEBE estar en la Fase 1 del documento de alcance. Si el documento dice 'sin OCR' o excluye esa funcionalidad de la Fase 1 pero el proveedor ofreció demostrarla primero, márcalo como hallazgo de tipo INCONSISTENCIA con severidad CRÍTICO. Este es un error grave porque contradice la estrategia comercial acordada.
- REGLA REDUCCIÓN PERSONAL: Si un objetivo implica reducción de personal, ahorro financiero o ROI, verifica si hay datos confirmados por el cliente o si es una proyección/aspiración. Si es proyección, clasifícalo como IMPORTANTE y sugiere reclasificar a "Aspiración estratégica" en lugar de "Objetivo P0 con métrica de éxito".
- Responde SOLO con JSON válido.`;
        // P0: Use final doc (step 5) as source of truth when re-running audit, fallback chain
        const documentUnderReview = sd.sourceOfTruthDocument ?? sd.finalDocument ?? scopeStr;
        const documentLabel = sd.sourceStepNumber === 5 ? "DOCUMENTO FINAL DE ALCANCE (Fase 5)" : "DOCUMENTO DE ALCANCE GENERADO (Fase 3)";
        const docReviewStr = truncate(typeof documentUnderReview === "string" ? documentUnderReview : JSON.stringify(documentUnderReview || {}, null, 2));

        userPrompt = `MATERIAL FUENTE ORIGINAL:\n${sd.originalInput || ""}\n\nBRIEFING EXTRAÍDO (Fase 2):\n${briefStr}\n\n${documentLabel}:\n${docReviewStr}\n\nRealiza una auditoría cruzada exhaustiva. Compara cada dato del material fuente contra lo que aparece en el documento de alcance. Genera el siguiente JSON:\n{\n  "puntuación_global": 0-100,\n  "resumen_auditoría": "2-3 frases con la evaluación general. Ejemplo: 'El documento captura correctamente la mayoría de funcionalidades con estructura profesional. Requiere X correcciones (Y CRÍTICAS, Z IMPORTANTES) antes de presentar al cliente.'",\n  "hallazgos": [\n    {\n      "codigo": "H-01",\n      "tipo": "OMISIÓN/INCONSISTENCIA/RIESGO_NO_CUBIERTO/MEJORA",\n      "severidad": "CRÍTICO/IMPORTANTE/MENOR",\n      "indicador_visual": "🔴/🟠/🟢",\n      "sección_afectada": "sección exacta del documento de alcance",\n      "descripción": "descripción concreta del problema encontrado",\n      "dato_original_textual": "cita EXACTA del material fuente. Si es transcripción incluir minuto aproximado.",\n      "acción_requerida": "acción específica y concreta",\n      "consecuencia_si_no_se_corrige": "impacto concreto"\n    }\n  ],\n  "puntuación_por_sección": [\n    {\n      "sección": "nombre de la sección",\n      "puntuación": 0-100,\n      "notas": "justificación breve de la puntuación"\n    }\n  ],\n  "datos_original_no_usados": ["dato o detalle del material fuente que no aparece en ninguna parte del documento"],\n  "recomendación": "APROBAR / APROBAR CON CORRECCIONES / RECHAZAR Y REGENERAR",\n  "resumen_hallazgos": {\n    "total": número,\n    "críticos": número,\n    "importantes": número,\n    "menores": número\n  }\n}`;
      } else if (action === "generate_final_doc") {
        systemPrompt = `Eres un director de proyectos senior de una consultora premium. Se te proporciona un documento de alcance y el resultado de una auditoría de calidad con hallazgos codificados [H-XX]. Tu trabajo es generar la VERSIÓN FINAL del documento incorporando TODAS las correcciones.

REGLAS:
- Para CADA hallazgo [H-XX] de la auditoría, genera la corrección EXACTA:
  - Muestra QUÉ texto se añade o modifica y EN QUÉ sección.
  - Las correcciones deben ser texto listo para insertar, no descripciones vagas.
  - Si un hallazgo requiere una nueva sección completa (ej: Fase 0, módulo nuevo, riesgo nuevo), escríbela completa con el mismo estilo del documento.
- Si un hallazgo queda cubierto por la corrección de otro, márcalo: "[H-XX] → Ya cubierto con [H-YY]".
- Si un hallazgo requiere información que no tienes, marca como [PENDIENTE: descripción].
- El documento final debe leerse como si siempre hubiera sido correcto — NO añadas una sección visible de "correcciones aplicadas".
- Mantén la estructura, estilo y nivel de detalle del documento original.
- Al final, incluye un CHANGELOG INTERNO envuelto en tags [[INTERNAL_ONLY]] y [[/INTERNAL_ONLY]] (separado por ---) con formato tabla.
- NUNCA bajes un presupuesto sin reducir alcance proporcionalmente. Si la auditoría indica que el presupuesto es excesivo para el cliente, la solución NO es poner un precio inferior por el mismo trabajo — es añadir una Fase 0/PoC de bajo coste como punto de entrada y mantener el presupuesto real para el proyecto completo.
- Verifica que TODAS las funcionalidades discutidas en el material original tienen módulo asignado en el documento final. Si alguna falta, añádela al módulo correspondiente o crea uno nuevo.
- REGLA OBLIGATORIA DE FASE 0/PoC: Si existe un gap >50% entre la expectativa del cliente (presupuesto mencionado o intuido) y el presupuesto real del proyecto, DEBES añadir obligatoriamente una "Fase 0 — Proof of Concept" como PRIMERA fase del plan de implementación, con estos 4 campos exactos:
  1. Duración: 2-3 semanas
  2. Coste: entre la expectativa del cliente y 5.000€ (ej: si el cliente espera 3.000€, la Fase 0 cuesta 3.000-5.000€)
  3. Entregables: demo funcional de la funcionalidad core (la que más valor demuestra) + maquetas/wireframes del resto
  4. Criterio de continuidad: si el cliente valida la demo y acepta el alcance completo, se procede con Fases 1-3 a presupuesto real
  NO es suficiente con un párrafo de justificación de precio. DEBE existir una Fase 0 como sección completa del cronograma con duración, coste, entregables y criterio.
- REGLA FIRMA: Incluye UN SOLO bloque de aceptación/firma al final del documento, no dos.
- REGLA STAKEHOLDERS: Si hay stakeholders sin identificar, NO los incluyas con nombre "Desconocido" ni variantes. Usa "[Por confirmar]" y en responsabilidad escribe "Pendiente de identificación por el cliente".
- REGLA PENDIENTES: Los datos faltantes deben presentarse SIEMPRE como tabla con columnas: Qué falta | Impacto si no se obtiene | Responsable de aportarlo | Prioridad (ALTA/MEDIA/BAJA) | Fecha límite sugerida.
- REGLA HECHOS vs PROPUESTA: En cada sección del documento, separa claramente: Hechos confirmados del material del cliente (marca con [CONFIRMADO]) y Propuesta ManIAS Lab: recomendaciones, arquitectura propuesta, estimaciones (marca con [PROPUESTA]). Especialmente importante en Arquitectura, Inversión, Cronograma y Objetivos.
- Idioma: español (España).`;
        userPrompt = `DOCUMENTO DE ALCANCE (versión anterior):\n${scopeStr}\n\nRESULTADO DE AUDITORÍA (con hallazgos codificados):\n${auditStr}\n\nBRIEFING ORIGINAL:\n${briefStr}\n\nINSTRUCCIONES:\n1. Lee cada hallazgo [H-XX] de la auditoría. Los hallazgos marcados como [[NO_APLICA]] ya están descartados — NO los corrijas.\n2. Para cada hallazgo ABIERTO, genera la corrección concreta como texto listo para insertar en la sección correspondiente.\n3. Si un hallazgo implica una sección nueva (ej: Fase 0, módulo nuevo), escríbela completa.\n4. Regenera el DOCUMENTO COMPLETO con todas las correcciones integradas de forma natural.\n5. Si varios hallazgos se resuelven con una misma corrección, indícalo en el changelog.\n6. IMPORTANTE: Si detectas un gap >50% entre expectativa del cliente y presupuesto real (revisa el briefing), incluye obligatoriamente una Fase 0/PoC al inicio del plan con: duración 2-3 semanas, coste entre expectativa cliente y 5.000€, entregables (demo core + maquetas), y criterio de continuidad.\n7. NOTA MVP OBLIGATORIA: Al inicio de la sección "Plan de Implementación", incluye SIEMPRE:\n   "NOTA MVP: El cliente requiere entregable funcional en [[PENDING:plazo_mvp]]. La Fase 0/PoC ([[PENDING:duracion_fase0]]) constituye el MVP para ese plazo: [lista de entregables Fase 0]. Las Fases 1-N representan la plataforma completa."\n\nAl final del documento, después de una línea separadora (---), incluye:\n\n[[INTERNAL_ONLY]]\n## CHANGELOG INTERNO (no incluir en entrega al cliente)\n| Hallazgo | Severidad | Acción tomada |\n| --- | --- | --- |\n| H-01: [descripción corta] | CRÍTICO/IMPORTANTE/MENOR | [qué se hizo exactamente] |\n[[/INTERNAL_ONLY]]`;
      } else if (action === "run_ai_leverage") {
        systemPrompt = `Eres un arquitecto de soluciones de IA con experiencia práctica implementando sistemas en producción (no teóricos). Tu trabajo es analizar un proyecto y proponer EXACTAMENTE dónde y cómo la IA aporta valor real, con estimaciones concretas basadas en volúmenes reales del proyecto.
${buildContractPromptBlock(4)}
REGLA ADICIONAL: NO incluir roadmap de fases, cronograma de desarrollo, presupuesto detallado ni modelos de monetización. Tu output es SOLO oportunidades de IA, ROI y riesgos de automatización.

REGLAS CRÍTICAS:
- Solo propón IA donde REALMENTE aporte valor sobre una solución no-IA. Si una regla de negocio simple resuelve el problema, marca el tipo como "REGLA_NEGOCIO_MEJOR" y explica por qué NO se necesita IA. La honestidad genera confianza.
- Para cada oportunidad, incluye TODOS estos campos en formato tabla:
  - Módulo afectado
  - Tipo: API_EXISTENTE / API_EXISTENTE + ajuste custom / MODELO_CUSTOM / REGLA_NEGOCIO_MEJOR
  - Modelo recomendado (nombre exacto: "Google Vision API + Claude Haiku 4.5", no genérico)
  - Cómo funciona: explicación técnica concreta del flujo
  - Coste API: cálculo explícito con volumen
  - Precisión esperada: % con justificación
  - Esfuerzo: horas concretas
  - ROI: cálculo explícito
  - Es MVP: ✅ Sí / ❌ No (con prioridad P0/P1/P2)
  - Dependencias: qué necesita estar listo antes
- Quick Wins: identifica las oportunidades de impacto alto y esfuerzo bajo que son demostrables en fases tempranas.
- Stack IA: justifica CADA componente.
- REGLA DE ESTIMACIÓN CONSERVADORA: Todos los cálculos de ROI y ahorro deben usar el ESCENARIO BAJO, no el alto. Si hay incertidumbre en volumen o ahorro, usa el 50% del valor optimista. Es mejor sorprender al cliente con resultados mejores que decepcionar con proyecciones infladas.
- REGLA DE FRAUDE/ANOMALÍAS: Para oportunidades de detección de fraude, anomalías o irregularidades, NO estimes valor monetario sin datos históricos reales. Usa "potencial de detección sin cuantificar — requiere datos históricos para estimar impacto".

VALIDACIÓN TEXTUAL (I-01) — EJECUTAR ANTES DE DEVOLVER EL JSON:
Para cada oportunidad:
1. "descripcion": máximo 2 frases. Verificar que ningún bigrama se repite (ej: "automático de fuentes" no puede aparecer dos veces). Si hay repetición → reescribir de cero en 2 frases limpias.
2. "como_funciona": pasos completos sin texto truncado. Si un paso está cortado → completarlo o eliminarlo.
3. "nombre": consistente con el nombre del agente en el documento de alcance.
Regla dura: cero texto duplicado o truncado en el JSON de salida.

LECTURA DE INFRAESTRUCTURA EXISTENTE (I-02):
Antes de evaluar dependencias, leer en el briefing:
- "Decisiones Confirmadas"
- "Integraciones Identificadas"
- Cualquier mención de sistemas o capacidades que el cliente YA tiene activos
Si una dependencia ya está cubierta por infraestructura existente:
→ NO marcar como dependencia bloqueante
→ Marcar como: "disponible — requiere integración"
→ Reevaluar ES_MVP: si era el único bloqueante, puede pasar a true
Ejemplo: cliente con sistema de grabación de reuniones activo → "sistema_grabacion" = infraestructura disponible, no dependencia.

FORMATO ROI NO CUANTIFICABLE (I-03):
Nunca dejar el campo vacío o solo "No cuantificable".
Formato obligatorio:
"No cuantificable en esta fase. Se podrá estimar tras [condición específica]: [datos necesarios — ej: '100+ contratos históricos', '2 años de pagos', 'baseline de tiempo actual documentado con casos reales']."

- Responde SOLO con JSON válido.`;
        userPrompt = `DOCUMENTO DE ALCANCE FINAL:\n${finalStr}\n\nBRIEFING DEL PROYECTO:\n${briefStr}\n\nGenera un análisis exhaustivo de oportunidades de IA. Para cada oportunidad, calcula el ROI con los datos reales del proyecto. Estructura JSON:\n{\n  "resumen": "valoración general del potencial de IA en 2-3 frases, incluyendo número de oportunidades, coste total estimado y ROI global",\n  "oportunidades": [\n    {\n      "id": "AI-001",\n      "nombre": "nombre descriptivo",\n      "módulo_afectado": "módulo exacto del proyecto",\n      "descripción": "qué hace y por qué aporta valor en 1-2 frases",\n      "tipo": "API_EXISTENTE / API_EXISTENTE + ajuste custom / MODELO_CUSTOM / REGLA_NEGOCIO_MEJOR",\n      "modelo_recomendado": "nombre exacto del modelo/API",\n      "como_funciona": "explicación técnica del flujo paso a paso",\n      "coste_api_estimado": "€/mes con cálculo de volumen explícito",\n      "calculo_volumen": "desglose: unidades/día × días/mes = total/mes",\n      "precisión_esperada": "% con justificación",\n      "datos_necesarios": "qué datos hacen falta",\n      "esfuerzo_implementación": "nivel + horas",\n      "impacto_negocio": "qué resuelve cuantitativamente",\n      "roi_estimado": "cálculo explícito: ahorro anual vs coste IA anual",\n      "es_mvp": true,\n      "prioridad": "P0/P1/P2",\n      "dependencias": "qué necesita estar listo antes",\n      "fase_implementación": "en qué fase del proyecto se implementa"\n    }\n  ],\n  "quick_wins": ["AI-001", "AI-002 — justificación breve"],\n  "requiere_datos_previos": ["AI-005 — qué datos y cuánto tiempo"],\n  "stack_ia_recomendado": {\n    "ocr": "solución + justificación",\n    "nlp": "solución + justificación, o No aplica",\n    "visión": "solución + justificación, o No aplica",\n    "mapas": "solución + justificación, o No aplica",\n    "analytics": "solución + justificación"\n  },\n  "coste_ia_total_mensual_estimado": "rango €/mes con nota",\n  "nota_implementación": "consideraciones prácticas en 2-3 frases",\n  "services_decision": {\n    "rag": {\n      "necesario": true,\n      "confianza": 0.85,\n      "justificación": "motivo concreto basado en el análisis",\n      "dominio_sugerido": "dominio de conocimiento del proyecto",\n      "fuentes_esperadas": ["fuente1", "fuente2"],\n      "tipo_consultas": ["consulta tipo 1", "consulta tipo 2"]\n    },\n    "pattern_detector": {\n      "necesario": true,\n      "confianza": 0.90,\n      "justificación": "motivo concreto basado en el análisis",\n      "sector_sugerido": "sector del proyecto",\n      "geografia_sugerida": "geografía del proyecto",\n      "objetivo_sugerido": "objetivo del análisis de patrones",\n      "variables_clave_sugeridas": ["variable1", "variable2"]\n    },\n    "deployment_mode": "SAAS",\n    "data_sensitivity": "low/medium/high"\n  }\n}`;
      } else if (action === "generate_mvp") {
        systemPrompt = `Eres un product manager senior especializado en definir MVPs (Minimum Viable Products) para proyectos tecnológicos. Tu objetivo es generar una descripción exhaustiva y detallada del MVP que sirva como blueprint para su construcción.

REGLAS CRÍTICAS:
- El MVP debe ser la versión MÁS REDUCIDA posible que demuestre valor al cliente.
- Cada funcionalidad debe estar justificada: si no es esencial para la demo de valor, NO está en el MVP.
- Incluye criterios de éxito medibles y concretos.
- Diferencia claramente entre lo que ENTRA en el MVP y lo que queda para fases posteriores.
- Sé específico en las pantallas, flujos y datos que debe manejar el MVP.
- Incluye un plan de lanzamiento con checklist concreto.
- Incluye OBLIGATORIAMENTE: demo_script (happy path end-to-end), funcionalidades excluidas con justificación, y criterios de aceptación por funcionalidad.
- Idioma: español (España).
- Responde en formato Markdown.
${buildContractPromptBlock(11)}`;

        userPrompt = `DOCUMENTO DE ALCANCE:\n${finalStr}\n\nBRIEFING DEL PROYECTO:\n${briefStr}\n\nPRD TÉCNICO:\n${prdStr}\n\nAUDITORÍA IA:\n${aiLevStr}\n\nGenera una descripción DETALLADA del MVP con esta estructura:

# Descripción del MVP — ${sd.projectName || "Proyecto"}

## 1. Visión del MVP
Descripción en 2-3 párrafos de qué es el MVP, qué problema resuelve y por qué esta versión mínima demuestra valor.

## 2. Funcionalidades Core del MVP
Lista detallada de SOLO las funcionalidades esenciales. Para cada una:
- Nombre y descripción
- User story principal
- Criterio de aceptación
- Prioridad (P0 = obligatorio para MVP)

## 3. Funcionalidades Excluidas del MVP
Qué queda fuera y por qué, con indicación de en qué fase se incorporará.

## 4. Pantallas y Flujos del MVP
Descripción de cada pantalla con:
- Nombre y propósito
- Elementos principales de UI
- Flujo de navegación
- Datos que muestra/captura

## 5. Arquitectura Técnica del MVP
Stack mínimo, tablas de BD necesarias, APIs esenciales.

## 6. Datos de Prueba y Escenarios
Qué datos necesita el MVP para funcionar en demo, escenarios de prueba clave.

## 7. Criterios de Éxito del MVP
Métricas concretas que determinan si el MVP cumple su objetivo.

## 8. Plan de Lanzamiento
- Checklist pre-lanzamiento
- Entorno de despliegue
- Plan de feedback del cliente
- Timeline estimado

## 9. Riesgos del MVP
Principales riesgos y mitigaciones específicas para esta versión reducida.`;
      } else if (action === "generate_rags") {
        const ragPrdStr = truncate(prdStr, 7000);
        const ragFinalStr = truncate(finalStr, 7000);
        const ragBriefStr = truncate(briefStr, 5000);
        const ragAiLevStr = truncate(aiLevStr, 5000);

        systemPrompt = `Eres un ingeniero de RAG (Retrieval Augmented Generation) especializado en bases de conocimiento para equipos de producto y desarrollo.

REGLAS CRÍTICAS:
- Devuelve SOLO JSON válido, sin markdown y sin texto adicional.
- Genera una estructura de RAG compacta y usable en producción.
- Objetivo de tamaño: 22-28 chunks (no más de 28).
- Cada chunk debe ser autocontenido, claro y accionable.
- Longitud de "contenido" por chunk: 120-220 tokens.
- Prioriza exactitud sobre volumen; evita duplicaciones.
- Incluye FAQs enfocadas al "por qué" de decisiones técnicas y de negocio.
- Si falta información, usa supuestos explícitos y conservadores.
- Responde SOLO con JSON válido.`;

        userPrompt = `PRD Técnico:\n${ragPrdStr}\n\nDocumento de Alcance:\n${ragFinalStr}\n\nBriefing:\n${ragBriefStr}\n\nAI Leverage:\n${ragAiLevStr}\n\nGenera el RAG dirigido con este JSON EXACTO:\n{\n  "proyecto": "${sd.projectName || ""}",\n  "total_chunks": número,\n  "distribución_por_categoría": {\n    "funcionalidad": "8-10",\n    "decisión": "4-6",\n    "arquitectura": "3-4",\n    "proceso": "2-3",\n    "dato_clave": "2-3",\n    "faq": "3-4"\n  },\n  "categorías": ["arquitectura", "funcionalidad", "decisión", "integración", "faq", "proceso", "dato_clave"],\n  "chunks": [\n    {\n      "id": "CHK-001",\n      "categoría": "funcionalidad",\n      "módulo": "nombre del módulo",\n      "fase": "Fase X",\n      "prioridad": "P0/P1/P2",\n      "título": "título descriptivo corto",\n      "contenido": "texto autocontenido de 120-220 tokens",\n      "tags": ["tag1", "tag2"],\n      "preguntas_relacionadas": ["¿cómo funciona X?"],\n      "dependencias": ["CHK-003"],\n      "fuente": "PRD sección X / Briefing / Reunión"\n    }\n  ],\n  "faqs_generadas": [\n    {\n      "id": "CHK-FAQ-001",\n      "pregunta": "pregunta anticipada del equipo",\n      "respuesta": "respuesta detallada que explique el por qué",\n      "chunks_relacionados": ["CHK-001"]\n    }\n  ],\n  "embeddings_config": {\n    "modelo_recomendado": "text-embedding-3-small (OpenAI)",\n    "dimensiones": 1536,\n    "chunk_overlap": 50,\n    "separador_recomendado": "Splitting semántico por módulo/decisión"\n  }\n}\n\nIMPORTANTE: No superes 28 chunks totales.`;
      } else if (action === "detect_patterns") {
        systemPrompt = `Eres un analista de negocio senior especializado en detectar patrones recurrentes en proyectos tecnológicos. Tu análisis tiene dos objetivos: (1) identificar componentes reutilizables que aceleren futuros proyectos similares, y (2) detectar oportunidades comerciales (upselling, cross-selling, servicios recurrentes) con pitches listos para usar.

REGLAS:
- Los patrones deben ser CONCRETOS y ACCIONABLES, no observaciones genéricas.
- Cada patrón técnico debe tener un "componente_extraíble" con NOMBRE DE PRODUCTO (ej: "DocCapture", "StepFlow", "FleetDash") — como si fuera un módulo que vendes.
- Las oportunidades comerciales deben incluir un pitch textual LISTO PARA USAR en una reunión (1-2 frases naturales, no corporativas).
- El timing de cada oportunidad debe ser concreto: "Cuando lleven 2-3 meses usando X" o "Al cerrar Fase 3", no "en el futuro".
- El score del cliente debe ser una tabla con dimensiones específicas + siguiente contacto con fecha concreta y motivo.
- Las señales de necesidades futuras deben tener timing concreto y acción preventiva.
- Los aprendizajes del proceso deben ser aplicables al pipeline interno de la agencia.
- REGLA DE ESTIMACIÓN CONSERVADORA: Los valores estimados en oportunidades comerciales deben usar el ESCENARIO BAJO. Si hay incertidumbre, usa el 50% del valor optimista. Los rangos de "Lifetime value estimado" deben ser conservadores.
- REGLA DE FRAUDE/ANOMALÍAS: Si algún patrón u oportunidad involucra detección de fraude o anomalías, NO estimes valor monetario sin datos reales. Usa "potencial de detección sin cuantificar" en su lugar.
- Responde SOLO con JSON válido.`;
        userPrompt = `Briefing:\n${briefStr}\n\nDocumento de Alcance:\n${finalStr}\n\nPRD Técnico:\n${prdStr}\n\nAI Leverage:\n${aiLevStr}\n\nCONTEXTO DE LA AGENCIA:\n- Nombre: Agustito\n- Servicios: Desarrollo tecnológico, marketing digital, consultoría IA\n\nGenera análisis de patrones con este formato JSON:\n{\n  "resumen": "valoración general en 2-3 frases",\n  "patrones_técnicos": [\n    {\n      "id": "PAT-001",\n      "patrón": "nombre descriptivo",\n      "descripción": "qué es el patrón en 1-2 frases",\n      "reutilizable": true,\n      "componente_extraíble": "nombre de producto + descripción",\n      "proyectos_aplicables": "tipos concretos de proyectos",\n      "ahorro_estimado": "horas concretas"\n    }\n  ],\n  "oportunidades_comerciales": [\n    {\n      "id": "OPP-001",\n      "oportunidad": "descripción concreta",\n      "tipo": "UPSELL / CROSS_SELL / SERVICIO_RECURRENTE / NUEVO_PROYECTO",\n      "timing": "cuándo proponerlo — concreto",\n      "valor_estimado": "€/mes o €/proyecto con rango",\n      "probabilidad": "alta/media/baja",\n      "pitch_sugerido": "frase NATURAL lista para usar en reunión"\n    }\n  ],\n  "señales_necesidades_futuras": [\n    {\n      "señal": "qué dijo o hizo el cliente",\n      "necesidad_inferida": "qué necesitará",\n      "cuándo": "estimación temporal concreta",\n      "acción": "qué hacer AHORA para posicionarse"\n    }\n  ],\n  "aprendizajes_proceso": [\n    {\n      "aprendizaje": "qué se aprendió",\n      "aplicable_a": "procesos internos / futuros proyectos / pipeline de ventas",\n      "acción_sugerida": "cambio concreto a implementar"\n    }\n  ],\n  "score_cliente": {\n    "dimensiones": [\n      {"dimensión": "Potencial recurrencia", "valoración": "alto/medio/bajo", "notas": "justificación"},\n      {"dimensión": "Potencial referidos", "valoración": "alto/medio/bajo", "notas": "justificación"},\n      {"dimensión": "Complejidad relación", "valoración": "alta/media/baja", "notas": "justificación"},\n      {"dimensión": "Lifetime value estimado", "valoración": "rango €", "notas": "desglose"}\n    ],\n    "siguiente_contacto_recomendado": {\n      "fecha": "fecha concreta o relativa",\n      "motivo": "qué presentar o discutir"\n    }\n  }\n}`;
      }

      let result: { text: string; tokensInput: number; tokensOutput: number };
      let modelUsed = model === "flash" ? "gemini-2.5-flash" : "gemini-3.1-pro-preview";
      let fallbackUsed = false;

      if (model === "flash" || useJson && model === "flash") {
        result = await callGeminiFlash(systemPrompt, userPrompt);
      } else {
        try {
          result = await callGeminiPro(systemPrompt, userPrompt);
        } catch (geminiError) {
          console.warn(`Gemini Pro failed for step ${stepNumber}, falling back to Claude Sonnet 4:`, geminiError instanceof Error ? geminiError.message : geminiError);
          try {
            result = await callClaudeSonnet(systemPrompt, userPrompt);
            modelUsed = "claude-sonnet-4";
            fallbackUsed = true;
          } catch (claudeError) {
            console.error("Claude also failed:", claudeError instanceof Error ? claudeError.message : claudeError);
            throw geminiError;
          }
        }
      }

      // Parse output with JSON repair + retry
      let outputData: any;
      if (useJson) {
        const stripMarkdownFences = (raw: string): string => {
          let cleaned = raw.trim();
          if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
          if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
          if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
          return cleaned.trim();
        };

        const parseJsonSafe = (raw: string): any => {
          const cleaned = stripMarkdownFences(raw);
          try {
            return JSON.parse(cleaned);
          } catch {
            const firstBrace = cleaned.indexOf("{");
            const lastBrace = cleaned.lastIndexOf("}");
            if (firstBrace !== -1 && lastBrace > firstBrace) {
              return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
            }
            throw new Error("JSON_PARSE_FAILED");
          }
        };

        const repairJson = (raw: string): any => {
          let cleaned = stripMarkdownFences(raw);
          const firstBrace = cleaned.indexOf("{");
          const lastBrace = cleaned.lastIndexOf("}");
          if (firstBrace !== -1 && lastBrace > firstBrace) {
            cleaned = cleaned.slice(firstBrace, lastBrace + 1);
          }
          // Close open strings
          const quoteCount = (cleaned.match(/(?<!\\)"/g) || []).length;
          if (quoteCount % 2 !== 0) cleaned += '"';
          // Close open brackets/braces
          const openBrackets = (cleaned.match(/\[/g) || []).length - (cleaned.match(/\]/g) || []).length;
          const openBraces = (cleaned.match(/\{/g) || []).length - (cleaned.match(/\}/g) || []).length;
          for (let i = 0; i < openBrackets; i++) cleaned += ']';
          for (let i = 0; i < openBraces; i++) cleaned += '}';
          return JSON.parse(cleaned);
        };

        // Attempt 1: direct parse
        try {
          outputData = parseJsonSafe(result.text);
        } catch {
          // Attempt 2: repair truncated JSON
          console.warn(`Step ${stepNumber}: JSON parse failed, attempting repair...`);
          try {
            outputData = repairJson(result.text);
            console.log(`Step ${stepNumber}: JSON repair successful`);
          } catch {
            // Attempt 3: retry with lower temperature
            console.warn(`Step ${stepNumber}: JSON repair failed, retrying with lower temperature...`);
            try {
              let retryResult: { text: string; tokensInput: number; tokensOutput: number };
              if (model === "flash") {
                // Retry with flash but lower temp - call inline
                const apiKey = GEMINI_API_KEY;
                const retryResponse = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
                      generationConfig: { temperature: 0.1, maxOutputTokens: 16384, responseMimeType: "application/json" },
                    }),
                  }
                );
                const retryData = await retryResponse.json();
                retryResult = {
                  text: retryData.candidates?.[0]?.content?.parts?.[0]?.text || "",
                  tokensInput: retryData.usageMetadata?.promptTokenCount || 0,
                  tokensOutput: retryData.usageMetadata?.candidatesTokenCount || 0,
                };
              } else {
                // Retry with Claude at lower temp
                const retryResponse = await fetch("https://api.anthropic.com/v1/messages", {
                  method: "POST",
                  headers: {
                    "x-api-key": ANTHROPIC_API_KEY!,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: "claude-sonnet-4-20250514",
                    max_tokens: 16384,
                    temperature: 0.1,
                    system: systemPrompt,
                    messages: [{ role: "user", content: userPrompt }],
                  }),
                });
                const retryData = await retryResponse.json();
                retryResult = {
                  text: retryData.content?.find((b: { type: string }) => b.type === "text")?.text || "",
                  tokensInput: retryData.usage?.input_tokens || 0,
                  tokensOutput: retryData.usage?.output_tokens || 0,
                };
              }
              // Add retry tokens to total
              result.tokensInput += retryResult.tokensInput;
              result.tokensOutput += retryResult.tokensOutput;
              outputData = parseJsonSafe(retryResult.text);
              console.log(`Step ${stepNumber}: Retry successful`);
            } catch (retryErr) {
              // All attempts failed
              console.error(`Step ${stepNumber}: All JSON parse attempts failed`, retryErr);
              outputData = { raw_text: result.text, parse_error: true };
            }
          }
        }
      } else {
        // ── P0: Inject parallel project exclusions into final doc (F5) ──
        if (action === "generate_final_doc") {
          const briefObj = typeof sd.briefingJson === 'object' && sd.briefingJson !== null ? sd.briefingJson : {};
          if (briefObj.parallel_projects && briefObj.parallel_projects.length > 0) {
            result.text = injectParallelProjectExclusions(result.text, briefObj.parallel_projects);
            console.log(`[wizard] Injected ${briefObj.parallel_projects.length} parallel project exclusions into final document`);
          }
        }
        outputData = { document: result.text };
      }

      // ── P0: Filter parallel project findings from audit (F4) ──
      if (action === "run_audit" && outputData && !outputData.parse_error) {
        const briefObj = typeof sd.briefingJson === 'object' && sd.briefingJson !== null ? sd.briefingJson : {};
        const docUnderReview = sd.sourceOfTruthDocument || sd.finalDocument || sd.scopeDocument || "";
        const docText = typeof docUnderReview === "string" ? docUnderReview : "";
        outputData = filterParallelProjectFindings(outputData, briefObj.parallel_projects, docText);
      }

      // ── Contract validation (generic steps: F4, F5-final, F6/MVP, etc.) ──
      {
        const outputTextForValidation = typeof outputData === "string"
          ? outputData
          : outputData?.document || JSON.stringify(outputData || "");

        // Collect previous outputs for contamination check
        const previousOutputs: Record<number, string> = {};
        if (briefStr) previousOutputs[2] = briefStr.substring(0, 5000);
        if (finalStr) previousOutputs[3] = finalStr.substring(0, 5000);
        if (action === "generate_mvp" && aiLevStr) previousOutputs[4] = aiLevStr.substring(0, 5000);

        const genericValidation = runAllValidators(stepNumber, outputData, outputTextForValidation, previousOutputs);
        if (Object.keys(genericValidation.flags).length > 0) {
          if (typeof outputData === "object" && outputData !== null) {
            outputData._contract_validation = genericValidation.flags;
          }
        }
      }

      // Calculate cost
      const costRates: Record<string, { input: number; output: number }> = {
        "gemini-2.5-flash": { input: 0.075, output: 0.30 },
        "claude-sonnet-4": { input: 3.00, output: 15.00 },
        "gemini-2.5-pro": { input: 1.25, output: 5.00 },
      };
      const rates = costRates[modelUsed] || costRates["gemini-2.5-flash"];
      const costUsd = (result.tokensInput / 1_000_000) * rates.input + (result.tokensOutput / 1_000_000) * rates.output;

      await recordCost(supabase, {
        projectId, stepNumber, service: modelUsed, operation: action,
        tokensInput: result.tokensInput, tokensOutput: result.tokensOutput,
        costUsd, userId: user.id,
        metadata: fallbackUsed ? { fallback: true } : {},
      });

      // Save step
      const { data: existingStep } = await supabase
        .from("project_wizard_steps")
        .select("id, version")
        .eq("project_id", projectId)
        .eq("step_number", stepNumber)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      const newVersion = existingStep ? existingStep.version + 1 : 1;

      await supabase.from("project_wizard_steps").upsert({
        id: existingStep?.id || undefined,
        project_id: projectId,
        step_number: stepNumber,
        step_name: stepName,
        status: "review",
        input_data: { action },
        output_data: outputData,
        model_used: modelUsed,
        version: newVersion,
        user_id: user.id,
      });

      // Save document for markdown steps
      if (!useJson) {
        await supabase.from("project_documents").insert({
          project_id: projectId,
          step_number: stepNumber,
          version: newVersion,
          content: result.text,
          format: "markdown",
          user_id: user.id,
        });
      }

      await supabase.from("business_projects").update({ current_step: stepNumber }).eq("id", projectId);

      return new Response(JSON.stringify({ output: outputData, cost: costUsd, version: newVersion, modelUsed, fallbackUsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: check_contradictions (D3) ─────────────────────────────────

    if (action === "check_contradictions") {
      const { document } = stepData;
      if (!document) {
        return new Response(JSON.stringify({ contradicciones: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const contradictionPrompt = `Analiza el siguiente documento y detecta CONTRADICCIONES INTERNAS.
Una contradicción es cuando el mismo concepto aparece con dos valores distintos (ej: coste que cambia entre secciones, frecuencia diferente, número de usuarios que varía, cronograma inconsistente, porcentajes que no cuadran).

NO marques como contradicción:
- Información complementaria (ej: un resumen vs un detalle)
- Rangos que se solapan
- Información que simplemente no se repite

SOLO marca contradicciones REALES donde el mismo dato tiene dos valores incompatibles.

Devuelve SOLO JSON válido:
{
  "contradicciones": [
    {
      "concepto": "nombre del concepto",
      "valor_1": "primer valor encontrado",
      "seccion_1": "sección donde aparece",
      "valor_2": "segundo valor encontrado",
      "seccion_2": "sección donde aparece"
    }
  ]
}

Si no hay contradicciones, devuelve: {"contradicciones": []}`;

      const docText = typeof document === "string" ? document : JSON.stringify(document);
      const result = await callGeminiFlash(contradictionPrompt, truncate(docText, 30000));

      // Record cost
      const costUsd = (result.tokensInput / 1_000_000) * 0.075 + (result.tokensOutput / 1_000_000) * 0.30;
      await recordCost(supabase, {
        projectId, stepNumber: 3, service: "gemini_flash", operation: "contradiction_check",
        tokensInput: result.tokensInput, tokensOutput: result.tokensOutput,
        costUsd, userId: user.id,
      });

      let parsed;
      try {
        let cleaned = result.text.trim();
        cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/gm, '').replace(/\n?```\s*$/gm, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        try {
          const firstBrace = result.text.indexOf('{');
          const lastBrace = result.text.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace > firstBrace) {
            parsed = JSON.parse(result.text.substring(firstBrace, lastBrace + 1));
          } else {
            parsed = { contradicciones: [] };
          }
        } catch {
          parsed = { contradicciones: [] };
        }
      }

      return new Response(JSON.stringify({
        contradicciones: parsed.contradicciones || [],
        cost: costUsd,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: approve_step ─────────────────────────────────────────────

    if (action === "approve_step") {
      const { stepNumber, outputData } = stepData;

      // Retrocompat: resolve actual DB step_number
      // UI 4 (MVP) lives on DB 11 in the current pipeline
      let dbStepNumber = stepNumber;

      if (stepNumber === 4 || stepNumber === 6) {
        dbStepNumber = 11;
      }

      const { data: existing } = await supabase
        .from("project_wizard_steps")
        .select("step_number")
        .eq("project_id", projectId)
        .eq("step_number", dbStepNumber)
        .limit(1);

      if (!existing || existing.length === 0) {
        const oldMap: Record<number, number[]> = {
          3: [5, 7, 3, 4],
          4: [11, 8, 6, 4],
          5: [5, 7],
          6: [11, 8, 6],
        };
        const candidates = oldMap[stepNumber] || [];
        for (const oldNum of candidates) {
          const { data: oldRow } = await supabase
            .from("project_wizard_steps")
            .select("step_number")
            .eq("project_id", projectId)
            .eq("step_number", oldNum)
            .limit(1);
          if (oldRow && oldRow.length > 0) {
            dbStepNumber = oldNum;
            console.log(`[approve_step] Retrocompat: mapped step ${stepNumber} → DB step_number ${dbStepNumber}`);
            break;
          }
        }
      }

      await supabase
        .from("project_wizard_steps")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          output_data: outputData || undefined,
        })
        .eq("project_id", projectId)
        .eq("step_number", dbStepNumber)
        .order("version", { ascending: false })
        .limit(1);

      await supabase.from("business_projects")
        .update({ current_step: Math.min(stepNumber + 1, 4) })
        .eq("id", projectId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: get_costs ────────────────────────────────────────────────

    if (action === "get_costs") {
      const { data: costs } = await supabase
        .from("project_costs")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      const totalCost = (costs || []).reduce((sum: number, c: { cost_usd: number }) => sum + Number(c.cost_usd), 0);

      return new Response(JSON.stringify({ costs: costs || [], totalCost }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: generate_budget_estimate (Step 6 — internal) ──────────────

    if (action === "generate_budget_estimate") {
      const { scopeDocument, aiLeverageJson, prdDocument, selectedMonetizationModels } = stepData;
      const monetizationLabels: Record<string, string> = {
        saas_subscription: "SaaS (suscripción mensual/anual)",
        fixed_price_maintenance: "Desarrollo a medida + Mantenimiento mensual",
        license_fee: "Licencia por unidad (coste por licencia mensual)",
        revenue_share: "Revenue share / Comisión sobre ingresos",
        per_user_seat: "Precio por usuario / Asiento",
        freemium: "Freemium + Premium",
        consulting_retainer: "Consultoría + Retainer mensual",
        white_label: "White Label / Marca blanca",
      };
      const selectedLabels = (selectedMonetizationModels || []).map((id: string) => monetizationLabels[id] || id);

      const systemPrompt = `Eres un consultor financiero experto en proyectos de software con IA. Tu trabajo es estimar presupuestos REALISTAS y proponer modelos de monetización para proyectos tecnológicos.

REGLAS CRÍTICAS:
- Estima horas de desarrollo REALES considerando el uso de herramientas de IA (Lovable, Cursor, Claude) que aceleran x3-5 el desarrollo.
- NO infles las estimaciones. Un MVP con IA se puede construir en 60-120 horas, no 500.
- Coste por hora de referencia: 60-100 EUR/hora para desarrollo con IA (España/LATAM).
- Los costes recurrentes deben ser EXACTOS: precio real de Supabase, APIs de IA (Claude, Gemini), hosting (Vercel/Netlify), dominios.
- Usa el escenario CONSERVADOR (50% del optimista) para estimaciones de ahorro/ROI.
- Los modelos de monetización deben ser ESPECÍFICOS para el tipo de proyecto, no genéricos.
- Incluye siempre el margen del consultor (30-50% sobre coste de desarrollo).
- Distingue entre coste TUYO (lo que te cuesta producirlo) y precio de VENTA al cliente.
- Propón 2-3 modelos de monetización adaptados al proyecto concreto.

COSTES DE REFERENCIA (2025):
- Supabase Pro: 25 EUR/mes
- Vercel Pro: 20 EUR/mes
- Dominio: 12-15 EUR/año
- Claude API (Sonnet): 3 EUR/M input tokens, 15 EUR/M output tokens
- Gemini Flash: 0.075 EUR/M input, 0.30 EUR/M output
- OpenAI GPT-4o: 2.50 EUR/M input, 10 EUR/M output
- Almacenamiento S3/Supabase Storage: 0.02 EUR/GB/mes

Responde SOLO con JSON válido. Sin markdown, sin backticks.`;

      const scopeStr = typeof scopeDocument === "string" ? scopeDocument : JSON.stringify(scopeDocument);
      const prdStr = typeof prdDocument === "string" ? prdDocument : JSON.stringify(prdDocument);

      const userPrompt = `Analiza el siguiente proyecto completo y genera una estimación de presupuesto realista.

EL CLIENTE HA SELECCIONADO ESTOS MODELOS DE MONETIZACIÓN (genera presupuesto ESPECÍFICO para cada uno):
${selectedLabels.map((l: string, i: number) => `${i + 1}. ${l}`).join('\n')}

IMPORTANTE: Genera un presupuesto detallado para CADA modelo seleccionado arriba. Para cada modelo, calcula:
- Precio de setup/implementación que cobrarías al cliente
- Precio mensual/recurrente que cobrarías
- Tu margen real
- Pros y contras específicos para ESTE proyecto
- Para quién es ideal este modelo

DOCUMENTO DE ALCANCE:
${truncate(scopeStr, 8000)}

AUDITORÍA IA (oportunidades detectadas):
${JSON.stringify(aiLeverageJson, null, 2).substring(0, 4000)}

PRD TÉCNICO:
${truncate(prdStr, 8000)}

Genera un JSON con esta estructura:
{
  "development": {
    "phases": [{ "name": "Fase X", "description": "...", "hours": N, "cost_eur": N }],
    "total_hours": N,
    "hourly_rate_eur": N,
    "total_development_eur": N,
    "your_cost_eur": N,
    "margin_pct": N
  },
  "recurring_monthly": {
    "items": [{ "name": "Servicio", "cost_eur": N, "notes": "..." }],
    "hosting": N,
    "ai_apis": N,
    "maintenance_hours": N,
    "maintenance_eur": N,
    "total_monthly_eur": N
  },
  "monetization_models": [
    {
      "name": "Nombre del modelo (uno por cada modelo seleccionado)",
      "description": "Descripción aplicada a este proyecto concreto",
      "setup_price_eur": "rango de precio setup",
      "monthly_price_eur": "rango de precio mensual",
      "your_margin_pct": N,
      "pros": ["ventaja específica para este proyecto"],
      "cons": ["desventaja específica"],
      "best_for": "perfil de cliente ideal"
    }
  ],
  "pricing_notes": "notas adicionales",
  "risk_factors": ["factor de riesgo"],
  "recommended_model": "nombre del modelo recomendado de los seleccionados"
}`;

      let result: { text: string; tokensInput: number; tokensOutput: number };
      try {
        result = await callGeminiPro(systemPrompt, userPrompt);
      } catch (geminiError) {
        console.warn("Gemini Pro failed for budget, falling back to Claude:", geminiError instanceof Error ? geminiError.message : geminiError);
        result = await callClaudeSonnet(systemPrompt, userPrompt);
      }

      // Parse JSON
      let budget;
      try {
        let cleaned = result.text.trim();
        cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/gm, '').replace(/\n?```\s*$/gm, '').trim();
        budget = JSON.parse(cleaned);
      } catch {
        try {
          const firstBrace = result.text.indexOf('{');
          const lastBrace = result.text.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace > firstBrace) {
            budget = JSON.parse(result.text.substring(firstBrace, lastBrace + 1));
          } else {
            budget = { error: "No se pudo parsear la respuesta", raw: result.text.substring(0, 500) };
          }
        } catch {
          budget = { error: "No se pudo parsear la respuesta", raw: result.text.substring(0, 500) };
        }
      }

      // Record cost
      const costUsd = (result.tokensInput / 1_000_000) * 3 + (result.tokensOutput / 1_000_000) * 15;
      await recordCost(supabase, {
        projectId, stepNumber: 6, service: "claude-sonnet", operation: "budget_estimation",
        tokensInput: result.tokensInput, tokensOutput: result.tokensOutput,
        costUsd, userId: user.id,
      });

      // Save as step 6
      const { data: existingStep } = await supabase
        .from("project_wizard_steps")
        .select("id, version")
        .eq("project_id", projectId)
        .eq("step_number", 6)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      const newVersion = existingStep ? (existingStep.version || 0) + 1 : 1;

      await supabase.from("project_wizard_steps").upsert({
        id: existingStep?.id || undefined,
        project_id: projectId,
        step_number: 6,
        step_name: "Estimación Presupuesto (interno)",
        status: "review",
        output_data: budget,
        model_used: "claude-sonnet-4",
        version: newVersion,
        user_id: user.id,
      });

      return new Response(JSON.stringify({ budget, cost: costUsd }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("project-wizard-step error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
