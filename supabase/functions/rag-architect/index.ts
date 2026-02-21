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

async function updateRag(ragId: string, updates: Record<string, unknown>) {
  const { error } = await supabase
    .from("rag_projects")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", ragId);
  if (error) console.error("updateRag error:", error);
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
  c = c.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
  c = c.replace(/[\x00-\x1F\x7F]/g, " ");
  return c.trim();
}

function safeParseJson(text: string): unknown {
  const cleaned = cleanJson(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    let repaired = cleaned;
    const ob = (repaired.match(/{/g) || []).length;
    const cb = (repaired.match(/}/g) || []).length;
    const oq = (repaired.match(/\[/g) || []).length;
    const cq = (repaired.match(/]/g) || []).length;
    repaired = repaired.replace(/,\s*"[^"]*$/, "").replace(/,\s*$/, "");
    for (let i = 0; i < oq - cq; i++) repaired += "]";
    for (let i = 0; i < ob - cb; i++) repaired += "}";
    return JSON.parse(repaired);
  }
}

/**
 * Wrapper around chat() with a per-call timeout to prevent edge function death.
 * If the LLM doesn't respond within timeoutMs, rejects so the catch block runs.
 */
async function chatWithTimeout(
  messages: ChatMessage[],
  options: Record<string, unknown>,
  timeoutMs = 50000
): Promise<string> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`LLM timeout after ${timeoutMs}ms`)), timeoutMs)
  );
  return Promise.race([chat(messages, options), timeoutPromise]);
}

// ═══════════════════════════════════════
// MORAL MODE PROMPTS
// ═══════════════════════════════════════

function getMoralPrompt(mode: string): string {
  switch (mode) {
    case "estandar":
      return "Usa SOLO fuentes legales, públicas, con licencia. Respeta copyright estrictamente. No scraping agresivo. Solo bases de datos académicas oficiales, repositorios abiertos y fuentes gubernamentales públicas.";
    case "profundo":
      return "Busca con profundidad máxima: preprints, patentes, tesis doctorales, datos gubernamentales, scraping ético, papers open access, repositorios institucionales. Cubre al menos 3 idiomas (español, inglés, portugués). Accede a todas las fuentes académicas y técnicas disponibles sin restricción.";
    case "total":
    default:
      return "EXHAUSTIVIDAD ABSOLUTA. Busca en TODAS las fuentes legales que existan en el planeta. Sin techo de tiempo ni de fuentes. Cubre 5+ idiomas. Incluye: bases académicas completas, repositorios institucionales de todos los países, tesis doctorales, patentes internacionales, datos gubernamentales de todas las jurisdicciones, preprints, conferencias, workshops, datasets públicos, informes técnicos, white papers, estándares ISO/IEEE, guías clínicas, meta-análisis, revisiones sistemáticas, literatura gris. Tu ÚNICO objetivo es cobertura TOTAL y ABSOLUTA del dominio. Extrae TODO lo que exista.";
  }
}

function getBudgetConfig(mode: string): { maxSources: number; maxHours: string; marginalGainThreshold: number } {
  switch (mode) {
    case "estandar":
      return { maxSources: 500, maxHours: "2-3", marginalGainThreshold: 0.05 };
    case "profundo":
      return { maxSources: 2000, maxHours: "3-5", marginalGainThreshold: 0.02 };
    case "total":
    default:
      return { maxSources: 5000, maxHours: "4-8", marginalGainThreshold: 0 };
  }
}

// ═══════════════════════════════════════
// RESEARCH LEVELS
// ═══════════════════════════════════════

const RESEARCH_LEVELS = [
  "surface",
  "academic",
  "datasets",
  "multimedia",
  "community",
  "frontier",
  "lateral",
];

// ═══════════════════════════════════════
// ACTION: CREATE
// ═══════════════════════════════════════

async function handleCreate(userId: string, body: Record<string, unknown>) {
  const { domainDescription, moralMode = "total", projectId } = body;
  if (!domainDescription) throw new Error("domainDescription is required");

  // Auto-detect build profile
  const profileGuess = "general";

  const { data: rag, error } = await supabase
    .from("rag_projects")
    .insert({
      user_id: userId,
      project_id: projectId || null,
      domain_description: domainDescription,
      moral_mode: moralMode,
      build_profile: profileGuess,
      status: "domain_analysis",
    })
    .select()
    .single();

  if (error) throw error;

  // Launch domain analysis in background
  EdgeRuntime.waitUntil(analyzeDomain(rag.id, domainDescription as string, moralMode as string));

  return { ragId: rag.id, status: "domain_analysis", message: `Analizando dominio en modo ${(moralMode as string).toUpperCase()}` };
}

// ═══════════════════════════════════════
// ACTION: ANALYZE_DOMAIN (background)
// ═══════════════════════════════════════

async function analyzeDomain(ragId: string, domain: string, moralMode: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 380_000);

  try {
    await updateRag(ragId, { status: "domain_analysis" });

    const budget = getBudgetConfig(moralMode);
    const moralPrompt = getMoralPrompt(moralMode);

    const systemPrompt = `Eres un equipo de 50 investigadores doctorales obsesivos. Tu misión: analizar un dominio de conocimiento con profundidad EXTREMA.

${moralPrompt}

PRESUPUESTO: ${budget.maxSources} fuentes máx, ${budget.maxHours} horas estimadas.

Debes generar un análisis doctoral completo en formato JSON con EXACTAMENTE esta estructura:
{
  "interpreted_intent": {
    "real_need": "string - qué necesita realmente el usuario",
    "consumer_profile": "string - perfil del consumidor del RAG",
    "primary_questions": ["array de 5-10 preguntas clave que el RAG debe responder"]
  },
  "subdomains": [
    {
      "name_technical": "string",
      "name_colloquial": "string",
      "relevance": "critical|high|medium|low",
      "relevance_note": "string - por qué es relevante",
      "key_authors": ["autor1", "autor2"],
      "fundamental_works": [{"title": "string", "year": 2020, "why": "string"}],
      "estimated_sources": 50
    }
  ],
  "critical_variables": [
    {
      "name": "string",
      "type": "quantitative|qualitative|binary|temporal|categorical",
      "description": "string",
      "importance": "critical|high|medium"
    }
  ],
  "source_categories": [
    {
      "category": "string",
      "tier": "tier1_gold|tier2_silver|tier3_bronze",
      "examples": ["fuente1", "fuente2"],
      "accessibility": "open|restricted|paywalled|underground"
    }
  ],
  "validation_queries": {
    "factual": ["pregunta factual 1", "pregunta factual 2"],
    "analytical": ["pregunta analítica 1"],
    "comparative": ["pregunta comparativa 1"]
  },
  "known_debates": [
    {
      "topic": "string",
      "positions": ["posición A", "posición B"],
      "current_consensus": "string"
    }
  ],
  "recommended_config": {
    "build_profile": "medical|legal|business|creative|general",
    "estimated_chunks": 5000,
    "estimated_time_hours": 4,
    "priority_subdomains": ["subdominio1", "subdominio2"]
  }
}

GENERA entre 10-20 subdominios y 30-50 variables críticas. Sé EXHAUSTIVO y OBSESIVO.`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Dominio a analizar: "${domain}"\n\nGenera el análisis doctoral completo en JSON.` },
    ];

    const result = await chatWithTimeout(messages, {
      model: "gemini-pro",
      maxTokens: 8192,
      temperature: 0.3,
      responseFormat: "json",
    }, 50000);

    const domainMap = safeParseJson(result);

    // Update build profile if recommended
    const recommended = (domainMap as Record<string, unknown>)?.recommended_config as Record<string, unknown>;
    const buildProfile = recommended?.build_profile as string || "general";

    await updateRag(ragId, {
      domain_map: domainMap,
      build_profile: buildProfile,
      status: "waiting_confirmation",
    });

    // Log trace
    await supabase.from("rag_traces").insert({
      rag_id: ragId,
      trace_type: "domain_analysis_complete",
      phase: "domain_analysis",
      message: `Análisis completado: ${((domainMap as Record<string, unknown>)?.subdomains as unknown[])?.length || 0} subdominios, ${((domainMap as Record<string, unknown>)?.critical_variables as unknown[])?.length || 0} variables`,
      metadata: { moral_mode: moralMode },
    });
  } catch (err) {
    console.error("analyzeDomain error:", err);
    await updateRag(ragId, {
      status: "failed",
      error_log: err instanceof Error ? err.message : "Unknown error in domain analysis",
    });
  } finally {
    clearTimeout(timeout);
  }
}

// ═══════════════════════════════════════
// ACTION: CONFIRM
// ═══════════════════════════════════════

async function handleConfirm(userId: string, body: Record<string, unknown>) {
  const { ragId, adjustments } = body;
  if (!ragId) throw new Error("ragId is required");

  // Verify ownership
  const { data: rag } = await supabase
    .from("rag_projects")
    .select("*")
    .eq("id", ragId)
    .eq("user_id", userId)
    .single();

  if (!rag) throw new Error("RAG project not found");
  if (rag.status !== "waiting_confirmation") throw new Error("RAG is not waiting for confirmation");

  await updateRag(ragId as string, {
    domain_confirmed: true,
    domain_adjustments: adjustments || null,
    status: "researching",
  });

  // Launch build in background
  EdgeRuntime.waitUntil(buildRag(ragId as string, rag, adjustments as Record<string, unknown>));

  return { ragId, status: "researching", message: "Construcción iniciada" };
}

// ═══════════════════════════════════════
// ACTION: BUILD (background)
// ═══════════════════════════════════════

async function buildRag(ragId: string, rag: Record<string, unknown>, adjustments: Record<string, unknown> | null) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 380_000);

  try {
    const domainMap = rag.domain_map as Record<string, unknown>;
    if (!domainMap) throw new Error("No domain map found");

    const subdomains = (domainMap.subdomains as Array<Record<string, unknown>>) || [];
    const moralMode = rag.moral_mode as string;
    const moralPrompt = getMoralPrompt(moralMode);

    // Filter excluded subdomains
    const activeSubdomains = subdomains.filter((sub) => {
      const adj = adjustments?.[sub.name_technical as string] as Record<string, unknown>;
      return adj?.include !== false;
    });

    let totalSources = 0;
    let totalChunks = 0;
    let totalVariables = 0;
    let phaseIdx = 0;

    for (const subdomain of activeSubdomains) {
      phaseIdx++;
      await updateRag(ragId, { current_phase: phaseIdx, status: "building" });

      // For each subdomain, run through research levels
      for (const level of RESEARCH_LEVELS) {
        // Create research run
        const { data: run } = await supabase
          .from("rag_research_runs")
          .insert({
            rag_id: ragId,
            subdomain: subdomain.name_technical as string,
            research_level: level,
            status: "running",
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        try {
          // Generate knowledge chunks for this subdomain + level
          const chunkPrompt = `Eres un investigador doctoral experto. ${moralPrompt}

SUBDOMINIO: ${subdomain.name_technical} (${subdomain.name_colloquial})
NIVEL DE INVESTIGACIÓN: ${level}
DOMINIO GENERAL: ${rag.domain_description}

Genera conocimiento exhaustivo para este nivel de investigación. Responde en JSON:
{
  "sources": [
    {"name": "string", "url": "string|null", "type": "${level}", "quality": 0.9, "tier": "tier1_gold|tier2_silver|tier3_bronze"}
  ],
  "chunks": [
    {"content": "string - párrafo denso de conocimiento (200-500 palabras)", "metadata": {"topic": "string", "confidence": 0.9}}
  ],
  "variables": [
    {"name": "string", "type": "quantitative|qualitative|binary|temporal|categorical", "description": "string", "values": []}
  ],
  "contradictions": [
    {"claim_a": "string", "claim_b": "string", "severity": "high|medium|low"}
  ]
}

Genera al menos 3 fuentes, 5 chunks de conocimiento denso, y extrae todas las variables que encuentres.`;

          const chunkResult = await chatWithTimeout(
            [
              { role: "system", content: "Genera conocimiento en JSON válido." },
              { role: "user", content: chunkPrompt },
            ],
            { model: "gemini-pro", maxTokens: 8192, temperature: 0.4, responseFormat: "json" },
            50000
          );

          const parsed = safeParseJson(chunkResult) as Record<string, unknown>;

          // Insert sources
          const sources = (parsed.sources as Array<Record<string, unknown>>) || [];
          for (const src of sources) {
            await supabase.from("rag_sources").insert({
              rag_id: ragId,
              run_id: run?.id,
              subdomain: subdomain.name_technical as string,
              source_name: src.name as string,
              source_url: src.url as string || null,
              source_type: src.type as string,
              tier: src.tier as string,
              quality_score: src.quality as number,
              relevance_score: 0.8,
            });
          }

          // Insert chunks
          const chunks = (parsed.chunks as Array<Record<string, unknown>>) || [];
          for (let i = 0; i < chunks.length; i++) {
            await supabase.from("rag_chunks").insert({
              rag_id: ragId,
              source_id: null,
              subdomain: subdomain.name_technical as string,
              content: chunks[i].content as string,
              chunk_index: i,
              metadata: chunks[i].metadata || {},
            });
          }

          // Insert variables
          const variables = (parsed.variables as Array<Record<string, unknown>>) || [];
          for (const v of variables) {
            await supabase.from("rag_variables").insert({
              rag_id: ragId,
              name: v.name as string,
              variable_type: v.type as string,
              description: v.description as string,
              detected_values: v.values || [],
            });
          }

          // Insert contradictions
          const contradictions = (parsed.contradictions as Array<Record<string, unknown>>) || [];
          for (const c of contradictions) {
            await supabase.from("rag_contradictions").insert({
              rag_id: ragId,
              claim_a: c.claim_a as string,
              claim_b: c.claim_b as string,
              severity: c.severity as string,
            });
          }

          totalSources += sources.length;
          totalChunks += chunks.length;
          totalVariables += variables.length;

          // Update run
          await supabase
            .from("rag_research_runs")
            .update({
              status: "completed",
              sources_found: sources.length,
              chunks_generated: chunks.length,
              completed_at: new Date().toISOString(),
            })
            .eq("id", run?.id);
        } catch (levelErr) {
          console.error(`Error in ${subdomain.name_technical}/${level}:`, levelErr);
          if (run?.id) {
            await supabase
              .from("rag_research_runs")
              .update({ status: "failed", error_log: String(levelErr) })
              .eq("id", run.id);
          }
        }

        // Update progress metrics
        const coverage = Math.min(100, Math.round((totalChunks / Math.max(1, activeSubdomains.length * RESEARCH_LEVELS.length * 5)) * 100));
        await updateRag(ragId, {
          total_sources: totalSources,
          total_chunks: totalChunks,
          total_variables: totalVariables,
          coverage_pct: coverage,
        });
      }
    }

    // Quality Gate
    const qualityVerdict = totalChunks >= 50 ? "PRODUCTION_READY" : totalChunks >= 20 ? "GOOD_ENOUGH" : "INCOMPLETE";

    await supabase.from("rag_quality_checks").insert({
      rag_id: ragId,
      check_type: "final",
      verdict: qualityVerdict,
      score: Math.min(1, totalChunks / 100),
      details: {
        total_sources: totalSources,
        total_chunks: totalChunks,
        total_variables: totalVariables,
        subdomains_processed: activeSubdomains.length,
      },
    });

    await updateRag(ragId, {
      status: "completed",
      quality_verdict: qualityVerdict,
      current_phase: activeSubdomains.length,
    });
  } catch (err) {
    console.error("buildRag error:", err);
    await updateRag(ragId, {
      status: "failed",
      error_log: err instanceof Error ? err.message : "Unknown error in build",
    });
  } finally {
    clearTimeout(timeout);
  }
}

// ═══════════════════════════════════════
// ACTION: STATUS
// ═══════════════════════════════════════

async function handleStatus(userId: string, body: Record<string, unknown>) {
  const { ragId } = body;
  if (!ragId) throw new Error("ragId is required");

  const { data: rag } = await supabase
    .from("rag_projects")
    .select("*")
    .eq("id", ragId)
    .eq("user_id", userId)
    .single();

  if (!rag) throw new Error("RAG project not found");

  // Get research runs
  const { data: runs } = await supabase
    .from("rag_research_runs")
    .select("*")
    .eq("rag_id", ragId)
    .order("created_at", { ascending: true });

  // Auto-heal: detect orphaned runs stuck in 'running' for >10 minutes
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  const now = Date.now();
  if (runs) {
    for (const run of runs) {
      if (run.status === "running" && run.started_at) {
        const startedAt = new Date(run.started_at).getTime();
        if (now - startedAt > TEN_MINUTES_MS) {
          console.warn(`Auto-heal: marking orphaned run ${run.id} as failed (stuck ${Math.round((now - startedAt) / 60000)}min)`);
          await supabase
            .from("rag_research_runs")
            .update({ status: "failed", error_log: "Timeout detectado: run llevaba >10 min en running. Auto-recovered." })
            .eq("id", run.id);
          run.status = "failed";
          run.error_log = "Timeout detectado (auto-heal)";
        }
      }
    }

    // If ALL runs are done (completed/failed) but project is still building, mark it appropriately
    const allDone = runs.every((r: Record<string, unknown>) => r.status === "completed" || r.status === "failed");
    const anyCompleted = runs.some((r: Record<string, unknown>) => r.status === "completed");
    if (allDone && runs.length > 0 && (rag.status === "building" || rag.status === "researching")) {
      const newStatus = anyCompleted ? "completed" : "failed";
      const errorLog = anyCompleted ? null : "Todos los niveles de investigación fallaron.";
      await updateRag(ragId as string, { status: newStatus, error_log: errorLog });
      rag.status = newStatus;
    }
  }

  // Get quality checks
  const { data: quality } = await supabase
    .from("rag_quality_checks")
    .select("*")
    .eq("rag_id", ragId)
    .order("created_at", { ascending: false })
    .limit(1);

  // Get contradictions count
  const { count: contradictionsCount } = await supabase
    .from("rag_contradictions")
    .select("*", { count: "exact", head: true })
    .eq("rag_id", ragId);

  // Get gaps count
  const { count: gapsCount } = await supabase
    .from("rag_gaps")
    .select("*", { count: "exact", head: true })
    .eq("rag_id", ragId);

  return {
    ...rag,
    research_runs: runs || [],
    quality_check: quality?.[0] || null,
    contradictions_count: contradictionsCount || 0,
    gaps_count: gapsCount || 0,
  };
}

// ═══════════════════════════════════════
// ACTION: LIST
// ═══════════════════════════════════════

async function handleList(userId: string) {
  const { data, error } = await supabase
    .from("rag_projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return { rags: data || [] };
}

// ═══════════════════════════════════════
// ACTION: QUERY
// ═══════════════════════════════════════

async function handleQuery(userId: string, body: Record<string, unknown>) {
  const { ragId, question } = body;
  if (!ragId || !question) throw new Error("ragId and question are required");

  // Verify ownership
  const { data: rag } = await supabase
    .from("rag_projects")
    .select("*")
    .eq("id", ragId)
    .eq("user_id", userId)
    .single();

  if (!rag) throw new Error("RAG project not found");
  if (rag.status !== "completed") throw new Error("RAG is not completed yet");

  // Extract keywords from question for search
  const keywords = (question as string).toLowerCase()
    .replace(/[^\w\sáéíóúñü]/g, "")
    .split(/\s+/)
    .filter((w: string) => w.length > 3);

  // Search chunks with ILIKE
  const orConditions = keywords.map((k: string) => `content.ilike.%${k}%`).join(",");
  const { data: chunks } = await supabase
    .from("rag_chunks")
    .select("id, content, subdomain, metadata")
    .eq("rag_id", ragId)
    .or(orConditions)
    .limit(20);

  const candidateChunks = chunks || [];

  if (candidateChunks.length === 0) {
    // Log the query
    await supabase.from("rag_query_log").insert({
      rag_id: ragId,
      question: question as string,
      answer: "No tengo datos suficientes sobre esto.",
      sources_used: [],
      results_quality: 0,
    });

    return {
      answer: "No tengo datos suficientes sobre esto en la base de conocimiento actual. Prueba reformulando la pregunta o con términos más específicos del dominio.",
      sources: [],
      confidence: 0,
      tokens_used: 0,
    };
  }

  // Reranking + Answer generation with LLM
  const chunksContext = candidateChunks
    .map((c: Record<string, unknown>, i: number) => `[Chunk ${i + 1} | Subdominio: ${c.subdomain}]\n${c.content}`)
    .join("\n\n---\n\n");

  const domain = rag.domain_description as string;
  const systemPrompt = `Eres un asistente experto en ${domain}.
Tu conocimiento proviene EXCLUSIVAMENTE de los documentos proporcionados.

REGLAS:
1. Responde SOLO con información de los documentos.
2. Si no tienes datos suficientes, di "No tengo datos suficientes" y sugiere qué buscar.
3. Cita fuentes con formato: [Fuente: nombre del subdominio].
4. Si hay debates entre fuentes, presenta todos los puntos de vista.
5. Nunca inventes datos ni cites fuentes que no estén en los documentos.
6. Responde en el idioma de la pregunta.
7. Al final, indica tu nivel de confianza de 0 a 1 en formato JSON: {"confidence": 0.X}

DOCUMENTOS:
${chunksContext}`;

  const answer = await chat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: question as string },
    ],
    { model: "gemini-pro", maxTokens: 4096, temperature: 0.2 }
  );

  // Extract confidence
  let confidence = 0.7;
  const confMatch = answer.match(/\{"confidence":\s*([\d.]+)\}/);
  if (confMatch) confidence = parseFloat(confMatch[1]);
  const cleanAnswer = answer.replace(/\{"confidence":\s*[\d.]+\}/, "").trim();

  // Build sources list
  const usedSubdomains = [...new Set(candidateChunks.map((c: Record<string, unknown>) => c.subdomain as string))];

  // Log the query
  await supabase.from("rag_query_log").insert({
    rag_id: ragId,
    question: question as string,
    answer: cleanAnswer,
    sources_used: usedSubdomains,
    results_quality: confidence,
  });

  return {
    answer: cleanAnswer,
    sources: candidateChunks.map((c: Record<string, unknown>) => ({
      subdomain: c.subdomain,
      excerpt: (c.content as string).slice(0, 200) + "...",
      metadata: c.metadata,
    })),
    confidence,
    tokens_used: cleanAnswer.length,
  };
}

// ═══════════════════════════════════════
// ACTION: EXPORT
// ═══════════════════════════════════════

async function handleExport(userId: string, body: Record<string, unknown>) {
  const { ragId, format = "document_md" } = body;
  if (!ragId) throw new Error("ragId is required");

  const { data: rag } = await supabase
    .from("rag_projects")
    .select("*")
    .eq("id", ragId)
    .eq("user_id", userId)
    .single();

  if (!rag) throw new Error("RAG project not found");
  if (rag.status !== "completed") throw new Error("RAG is not completed yet");

  // Get all chunks grouped by subdomain
  const { data: chunks } = await supabase
    .from("rag_chunks")
    .select("content, subdomain, metadata")
    .eq("rag_id", ragId)
    .order("subdomain")
    .order("chunk_index");

  const { data: variables } = await supabase
    .from("rag_variables")
    .select("name, variable_type, description")
    .eq("rag_id", ragId);

  const { data: contradictions } = await supabase
    .from("rag_contradictions")
    .select("claim_a, claim_b, severity")
    .eq("rag_id", ragId);

  const { data: sources } = await supabase
    .from("rag_sources")
    .select("source_name, source_url, source_type, tier, quality_score, subdomain")
    .eq("rag_id", ragId);

  // Build markdown document
  const domainMap = rag.domain_map as Record<string, unknown>;
  const subdomains = (domainMap?.subdomains as Array<Record<string, unknown>>) || [];

  let md = `# Base de Conocimiento: ${rag.domain_description}\n\n`;
  md += `**Fecha de construcción:** ${new Date(rag.updated_at as string).toLocaleDateString()}\n`;
  md += `**Cobertura:** ${rag.coverage_pct}% | **Fuentes:** ${rag.total_sources} | **Chunks:** ${rag.total_chunks} | **Variables:** ${rag.total_variables}\n`;
  md += `**Veredicto de calidad:** ${rag.quality_verdict}\n\n`;
  md += `---\n\n## Resumen Ejecutivo\n\n`;

  const intent = domainMap?.interpreted_intent as Record<string, unknown>;
  if (intent) {
    md += `**Necesidad real:** ${intent.real_need}\n\n`;
    md += `**Perfil de consumo:** ${intent.consumer_profile}\n\n`;
  }

  // Group chunks by subdomain
  const chunksBySubdomain: Record<string, Array<Record<string, unknown>>> = {};
  for (const chunk of (chunks || [])) {
    const sd = chunk.subdomain as string;
    if (!chunksBySubdomain[sd]) chunksBySubdomain[sd] = [];
    chunksBySubdomain[sd].push(chunk);
  }

  // Content by subdomain
  for (const sub of subdomains) {
    const name = sub.name_technical as string;
    md += `\n---\n\n## ${name} (${sub.name_colloquial})\n\n`;
    md += `**Relevancia:** ${sub.relevance}\n\n`;

    const subChunks = chunksBySubdomain[name] || [];
    for (const chunk of subChunks) {
      md += `${chunk.content}\n\n`;
    }

    // Sources for this subdomain
    const subSources = (sources || []).filter((s: Record<string, unknown>) => s.subdomain === name);
    if (subSources.length > 0) {
      md += `### Fuentes\n\n`;
      for (const src of subSources) {
        md += `- **${src.source_name}** (${src.tier}, calidad: ${src.quality_score})${src.source_url ? ` — ${src.source_url}` : ""}\n`;
      }
      md += `\n`;
    }
  }

  // Variables
  if ((variables || []).length > 0) {
    md += `\n---\n\n## Variables Detectadas\n\n`;
    md += `| Variable | Tipo | Descripción |\n|----------|------|-------------|\n`;
    for (const v of variables!) {
      md += `| ${v.name} | ${v.variable_type} | ${v.description} |\n`;
    }
  }

  // Contradictions
  if ((contradictions || []).length > 0) {
    md += `\n---\n\n## Contradicciones Detectadas\n\n`;
    for (const c of contradictions!) {
      md += `- **${c.severity?.toUpperCase()}:** "${c.claim_a}" vs "${c.claim_b}"\n`;
    }
  }

  // Log export
  await supabase.from("rag_exports").insert({
    rag_id: ragId as string,
    format: format as string,
  });

  return { markdown: md, format };
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

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    let result: unknown;

    switch (action) {
      case "create":
        result = await handleCreate(userId, body);
        break;
      case "confirm":
        result = await handleConfirm(userId, body);
        break;
      case "status":
        result = await handleStatus(userId, body);
        break;
      case "list":
        result = await handleList(userId);
        break;
      case "query":
        result = await handleQuery(userId, body);
        break;
      case "export":
        result = await handleExport(userId, body);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("rag-architect error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
