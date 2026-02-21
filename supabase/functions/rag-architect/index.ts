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

const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";

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
// REAL RAG HELPERS
// ═══════════════════════════════════════

/** Search real sources via Perplexity sonar-pro */
async function searchWithPerplexity(query: string, level: string): Promise<{ content: string; citations: string[] }> {
  if (!PERPLEXITY_API_KEY) {
    console.warn("PERPLEXITY_API_KEY not set, skipping real search");
    return { content: "", citations: [] };
  }

  const levelHints: Record<string, string> = {
    surface: "overview introductory guide",
    academic: "peer-reviewed research papers studies",
    datasets: "datasets statistics data reports",
    multimedia: "video tutorials educational resources",
    community: "forums discussions community experiences",
    frontier: "latest research preprints cutting-edge",
    lateral: "interdisciplinary cross-domain perspectives",
  };

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        {
          role: "system",
          content: `Eres un investigador académico. Busca las fuentes más relevantes y fiables. Nivel de búsqueda: ${level} (${levelHints[level] || level}). Proporciona información detallada y cita todas las fuentes.`,
        },
        { role: "user", content: query },
      ],
      return_citations: true,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Perplexity error:", response.status, errText);
    return { content: "", citations: [] };
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  const citations: string[] = data.citations || [];
  return { content, citations };
}

/** Scrape a URL via Firecrawl, returns markdown */
async function scrapeUrl(url: string): Promise<string> {
  if (!FIRECRAWL_API_KEY) {
    // Fallback: direct fetch
    return await directFetch(url);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`Firecrawl failed for ${url}: ${response.status}`);
      return await directFetch(url);
    }

    const data = await response.json();
    return data.data?.markdown || data.markdown || "";
  } catch (err) {
    console.warn(`Firecrawl error for ${url}:`, err);
    return await directFetch(url);
  }
}

/** Direct fetch fallback with basic HTML stripping */
async function directFetch(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: { "User-Agent": "JarvisRAGBot/1.0 (research)" },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return "";
    const html = await response.text();
    return stripHtmlBasic(html);
  } catch {
    return "";
  }
}

/** Basic HTML stripping — improved */
function stripHtmlBasic(html: string): string {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "")
    .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, "")
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/\s(class|id|style|data-[\w-]+)="[^"]*"/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/\s+/g, " ")
    .trim();
  const words = text.split(/\s+/);
  if (words.length > 5000) text = words.slice(0, 5000).join(" ");
  return text;
}

/** Clean scraped/markdown content before chunking */
function cleanScrapedContent(text: string): string {
  let lines = text.split("\n");

  // Remove navigation/UI boilerplate lines
  const boilerplatePatterns = /^(subscribe|sign up|sign in|log in|cookie|privacy policy|terms of service|terms & conditions|accept cookies|newsletter|unsubscribe|skip to content|menu|navigation|search\.\.\.|©|\|.*\|.*\|)/i;
  lines = lines.filter((line) => !boilerplatePatterns.test(line.trim()));

  // Remove lines that are only bare URLs
  lines = lines.filter((line) => !/^\s*https?:\/\/\S+\s*$/.test(line));

  // Remove very short lines that are likely buttons/labels (< 20 chars, no period)
  lines = lines.filter((line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return true; // keep blank lines
    if (trimmed.length < 20 && !trimmed.includes(".") && !trimmed.includes(":")) return false;
    return true;
  });

  // Remove consecutive empty markdown headers (##### without content)
  lines = lines.filter((line, i) => {
    if (/^#{4,}\s*$/.test(line.trim())) return false;
    return true;
  });

  // Remove lines that are only emojis/decorative symbols
  lines = lines.filter((line) => !/^[\s\u{1F300}-\u{1FAD6}\u{2600}-\u{27BF}•·→←↑↓★☆✓✗✔✕▪▫●○◆◇|_\-=~*]+$/u.test(line.trim()));

  let result = lines.join("\n");

  // Collapse 3+ newlines into 2
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}

/** Generate embedding via OpenAI text-embedding-3-small */
async function generateEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

  // Truncate to ~8000 tokens (~32000 chars)
  const truncated = text.slice(0, 32000);

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: truncated,
      dimensions: 1024,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI embedding error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/** Chunk real content using Gemini (organize, NOT invent) */
async function chunkRealContent(
  content: string,
  subdomain: string,
  level: string
): Promise<Array<{ content: string; summary: string; concepts: string[] }>> {
  if (!content || content.trim().length < 100) return [];

  // Clean content before chunking
  const cleaned = cleanScrapedContent(content);
  if (cleaned.length < 100) return [];

  // Truncate to fit in context
  const truncated = cleaned.slice(0, 30000);

  let chunks: Array<{ content: string; summary: string; concepts: string[] }> = [];

  try {
    const result = await chatWithTimeout(
      [
        {
          role: "system",
          content: `Eres un organizador de conocimiento.

REGLAS ABSOLUTAS:
1. SOLO usa la información del contenido proporcionado. NO inventes NADA.
2. Divide el contenido en chunks de 200-500 palabras por tema.
3. DEBES generar entre 5 y 15 chunks. Si el contenido es extenso, divídelo en MÁS chunks. NUNCA devuelvas solo 1 chunk.
4. Para cada chunk extrae: resumen de 1 línea, conceptos clave.
5. Si el contenido no tiene información útil, devuelve un array vacío [].
6. NUNCA generes conocimiento que no esté en el texto proporcionado.
7. Mantén datos, cifras, nombres y referencias exactos del texto original.
8. Cada chunk debe ser autocontenido y tratar un subtema específico.

Devuelve SOLO un JSON array (sin wrapper):
[{"content": "texto del chunk", "summary": "resumen de 1 línea", "concepts": ["concepto1", "concepto2"]}]`,
        },
        {
          role: "user",
          content: `Subdominio: ${subdomain}\nNivel: ${level}\n\nContenido descargado:\n\n${truncated}`,
        },
      ],
      { model: "gemini-pro", maxTokens: 8192, temperature: 0.1, responseFormat: "json" },
      50000
    );

    // Parse response
    let cleanedResult = result.trim();
    if (cleanedResult.startsWith("```json")) cleanedResult = cleanedResult.slice(7);
    if (cleanedResult.startsWith("```")) cleanedResult = cleanedResult.slice(3);
    if (cleanedResult.endsWith("```")) cleanedResult = cleanedResult.slice(0, -3);
    cleanedResult = cleanedResult.trim();

    let parsed: unknown;
    if (cleanedResult.startsWith("[")) {
      parsed = JSON.parse(cleanedResult);
    } else {
      const obj = safeParseJson(cleanedResult) as Record<string, unknown>;
      parsed = obj.chunks || obj.data || Object.values(obj)[0];
    }

    if (Array.isArray(parsed)) {
      chunks = parsed.map((c: Record<string, unknown>) => ({
        content: (c.content as string) || "",
        summary: (c.summary as string) || "",
        concepts: (c.concepts as string[]) || [],
      }));
    }
  } catch (err) {
    console.error("chunkRealContent parse error:", err);
  }

  console.log(`[chunkRealContent] Gemini returned ${chunks.length} chunks for ${subdomain}/${level} (content length: ${truncated.length})`);

  // Mechanical fallback if Gemini returned < 3 chunks and content is substantial
  if (chunks.length < 3 && truncated.length > 1000) {
    console.log(`[chunkRealContent] Applying mechanical fallback for ${subdomain}/${level}`);
    chunks = mechanicalChunk(truncated, subdomain);
  }

  return chunks;
}

/** Mechanical chunking fallback: split by paragraphs, group to ~400 words */
function mechanicalChunk(text: string, subdomain: string): Array<{ content: string; summary: string; concepts: string[] }> {
  // Split by strong separators
  const paragraphs = text.split(/\n{2,}|---+/).filter((p) => p.trim().length > 30);

  const chunks: Array<{ content: string; summary: string; concepts: string[] }> = [];
  let currentGroup: string[] = [];
  let currentWordCount = 0;

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).length;
    currentGroup.push(para.trim());
    currentWordCount += words;

    if (currentWordCount >= 350) {
      const content = currentGroup.join("\n\n");
      const firstSentence = content.match(/^[^.!?]+[.!?]/)?.[0] || content.slice(0, 100);
      chunks.push({
        content,
        summary: firstSentence.trim(),
        concepts: [subdomain],
      });
      currentGroup = [];
      currentWordCount = 0;
    }
  }

  // Remaining content
  if (currentGroup.length > 0) {
    const content = currentGroup.join("\n\n");
    if (content.trim().length > 50) {
      const firstSentence = content.match(/^[^.!?]+[.!?]/)?.[0] || content.slice(0, 100);
      chunks.push({
        content,
        summary: firstSentence.trim(),
        concepts: [subdomain],
      });
    }
  }

  console.log(`[mechanicalChunk] Produced ${chunks.length} chunks from ${text.length} chars`);
  return chunks.length > 0 ? chunks : [{ content: text.slice(0, 2000), summary: `${subdomain} content`, concepts: [subdomain] }];
}

// ═══════════════════════════════════════
// MORAL MODE PROMPTS
// ═══════════════════════════════════════

function getMoralPrompt(mode: string): string {
  switch (mode) {
    case "estandar":
      return "Usa SOLO fuentes legales, públicas, con licencia.";
    case "profundo":
      return "Busca con profundidad máxima: preprints, patentes, tesis doctorales, datos gubernamentales.";
    case "total":
    default:
      return "EXHAUSTIVIDAD ABSOLUTA. Busca en TODAS las fuentes legales disponibles.";
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

    const recommended = (domainMap as Record<string, unknown>)?.recommended_config as Record<string, unknown>;
    const buildProfile = recommended?.build_profile as string || "general";

    await updateRag(ragId, {
      domain_map: domainMap,
      build_profile: buildProfile,
      status: "waiting_confirmation",
    });

    await supabase.from("rag_traces").insert({
      rag_id: ragId,
      trace_type: "domain_analysis_complete",
      phase: "domain_analysis",
      message: `Análisis completado: ${((domainMap as Record<string, unknown>)?.subdomains as unknown[])?.length || 0} subdominios`,
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

  EdgeRuntime.waitUntil(triggerBatch(ragId as string, 0));

  return { ragId, status: "researching", message: "Construcción iniciada (por lotes)" };
}

// ═══════════════════════════════════════
// BATCH BUILD ARCHITECTURE
// ═══════════════════════════════════════

async function triggerBatch(ragId: string, batchIndex: number) {
  try {
    const url = `${SUPABASE_URL}/functions/v1/rag-architect`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ action: "build-batch", ragId, batchIndex }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`triggerBatch failed (batch ${batchIndex}):`, errText);
    } else {
      // Must consume response body
      await res.text();
    }
  } catch (err) {
    console.error(`triggerBatch error (batch ${batchIndex}):`, err);
  }
}

function getActiveSubdomains(rag: Record<string, unknown>): Array<Record<string, unknown>> {
  const domainMap = rag.domain_map as Record<string, unknown>;
  if (!domainMap) return [];
  const subdomains = (domainMap.subdomains as Array<Record<string, unknown>>) || [];
  const adjustments = rag.domain_adjustments as Record<string, unknown> | null;
  return subdomains.filter((sub) => {
    const adj = adjustments?.[sub.name_technical as string] as Record<string, unknown>;
    return adj?.include !== false;
  });
}

// ═══════════════════════════════════════
// HANDLE BUILD BATCH — REAL RAG PIPELINE
// ═══════════════════════════════════════

async function handleBuildBatch(body: Record<string, unknown>) {
  const { ragId, batchIndex } = body;
  if (!ragId || batchIndex === undefined) throw new Error("ragId and batchIndex required");

  const idx = batchIndex as number;

  const { data: rag } = await supabase
    .from("rag_projects")
    .select("*")
    .eq("id", ragId)
    .single();

  if (!rag) throw new Error("RAG project not found");
  if (rag.status === "failed" || rag.status === "cancelled") {
    console.log(`Batch ${idx} skipped: RAG is ${rag.status}`);
    return { skipped: true };
  }

  const activeSubdomains = getActiveSubdomains(rag);
  const totalBatches = activeSubdomains.length * RESEARCH_LEVELS.length;

  if (idx >= totalBatches) {
    console.log(`Batch ${idx} out of range (${totalBatches} total batches)`);
    return { skipped: true };
  }

  // Decode: batchIndex = subdomainIndex * 7 + levelIndex
  const subdomainIndex = Math.floor(idx / RESEARCH_LEVELS.length);
  const levelIndex = idx % RESEARCH_LEVELS.length;

  const subdomain = activeSubdomains[subdomainIndex];
  const subdomainName = subdomain.name_technical as string;
  const subdomainColloquial = subdomain.name_colloquial as string || subdomainName;
  const domain = rag.domain_description as string;
  const level = RESEARCH_LEVELS[levelIndex];

  await updateRag(ragId as string, { current_phase: subdomainIndex + 1, status: "building" });

  console.log(`[Batch ${idx}/${totalBatches}] Processing ${subdomainName}/${level}`);

  let batchSources = 0;
  let batchChunks = 0;

  const levelStartTime = Date.now();

  // Create research run
  const { data: run } = await supabase
    .from("rag_research_runs")
    .insert({
      rag_id: ragId,
      subdomain: subdomainName,
      research_level: level,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  try {
    // ═══ STEP 1: Search real sources with Perplexity ═══
    const searchQuery = `${subdomainColloquial} ${domain} ${level === "academic" ? "peer-reviewed studies research" : level === "datasets" ? "statistics data reports" : ""}`;
    console.log(`[${subdomainName}/${level}] Searching: ${searchQuery.slice(0, 80)}...`);

    const { content: perplexityContent, citations } = await searchWithPerplexity(searchQuery, level);

    // Save sources
    const sourceIds: string[] = [];
    for (const citationUrl of citations.slice(0, 5)) {
      try {
        const { data: src } = await supabase
          .from("rag_sources")
          .insert({
            rag_id: ragId,
            run_id: run?.id,
            subdomain: subdomainName,
            source_name: new URL(citationUrl).hostname,
            source_url: citationUrl,
            source_type: level,
            tier: level === "academic" ? "tier1_gold" : "tier2_silver",
            quality_score: 0.8,
            relevance_score: 0.8,
          })
          .select("id")
          .single();
        if (src) sourceIds.push(src.id);
      } catch (urlErr) {
        console.warn(`Invalid URL skipped: ${citationUrl}`);
      }
    }

    batchSources = sourceIds.length;

    // ═══ STEP 2: Download real content via Firecrawl ═══
    let allScrapedContent = "";
    const urlsToScrape = citations.slice(0, 3);

    for (const url of urlsToScrape) {
      if (Date.now() - levelStartTime > 40000) {
        console.warn(`[${subdomainName}/${level}] Time budget exceeded, stopping scrape`);
        break;
      }

      const scraped = await scrapeUrl(url);
      if (scraped) {
        allScrapedContent += `\n\n--- SOURCE: ${url} ---\n\n${scraped}`;
      }
    }

    // Fallback: use Perplexity's response content if scraping yielded little
    if (allScrapedContent.length < 500 && perplexityContent) {
      console.log(`[${subdomainName}/${level}] Using Perplexity response as fallback content`);
      allScrapedContent = perplexityContent;
    }

    if (!allScrapedContent || allScrapedContent.trim().length < 100) {
      console.warn(`[${subdomainName}/${level}] No real content obtained, skipping chunk generation`);
      await supabase
        .from("rag_research_runs")
        .update({ status: "completed", sources_found: sourceIds.length, chunks_generated: 0, completed_at: new Date().toISOString() })
        .eq("id", run?.id);
    } else {
      // ═══ STEP 3: Chunk REAL content with Gemini (NO invention) ═══
      const chunks = await chunkRealContent(allScrapedContent, subdomainName, level);

      // ═══ STEP 4 & 5: Generate embeddings + Save chunks ═══
      let chunksInserted = 0;
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk.content || chunk.content.length < 50) continue;

        try {
          const embedding = await generateEmbedding(chunk.content);
          if (i > 0) await new Promise((r) => setTimeout(r, 200));

          await supabase.from("rag_chunks").insert({
            rag_id: ragId,
            source_id: sourceIds[0] || null,
            subdomain: subdomainName,
            content: chunk.content,
            chunk_index: i,
            metadata: { summary: chunk.summary, concepts: chunk.concepts, level },
            embedding: `[${embedding.join(",")}]`,
          });

          chunksInserted++;
        } catch (embErr) {
          console.error(`[${subdomainName}/${level}] Embedding error for chunk ${i}:`, embErr);
          await supabase.from("rag_chunks").insert({
            rag_id: ragId,
            source_id: sourceIds[0] || null,
            subdomain: subdomainName,
            content: chunk.content,
            chunk_index: i,
            metadata: { summary: chunk.summary, concepts: chunk.concepts, level, embedding_failed: true },
          });
          chunksInserted++;
        }
      }

      batchChunks = chunksInserted;

      await supabase
        .from("rag_research_runs")
        .update({
          status: "completed",
          sources_found: sourceIds.length,
          chunks_generated: chunksInserted,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run?.id);

      console.log(`[${subdomainName}/${level}] Done: ${sourceIds.length} sources, ${chunksInserted} chunks, ${Date.now() - levelStartTime}ms`);
    }
  } catch (levelErr) {
    console.error(`Error in ${subdomainName}/${level}:`, levelErr);
    if (run?.id) {
      await supabase
        .from("rag_research_runs")
        .update({ status: "failed", error_log: String(levelErr) })
        .eq("id", run.id);
    }
  }

  // Update cumulative metrics
  const newTotalSources = (rag.total_sources as number || 0) + batchSources;
  const newTotalChunks = (rag.total_chunks as number || 0) + batchChunks;
  const expectedTotal = activeSubdomains.length * RESEARCH_LEVELS.length * 5;
  const coverage = Math.min(100, Math.round((newTotalChunks / Math.max(1, expectedTotal)) * 100));

  await updateRag(ragId as string, {
    total_sources: newTotalSources,
    total_chunks: newTotalChunks,
    coverage_pct: coverage,
  });

  // Trigger next batch
  const nextBatch = idx + 1;
  if (nextBatch < totalBatches) {
    EdgeRuntime.waitUntil(triggerBatch(ragId as string, nextBatch));
    return { ragId, batchIndex: idx, status: "next_batch_triggered", nextBatch, totalBatches };
  }

  // Last batch — Quality Gate
  const qualityVerdict = newTotalChunks >= 50 ? "PRODUCTION_READY" : newTotalChunks >= 20 ? "GOOD_ENOUGH" : "INCOMPLETE";

  await supabase.from("rag_quality_checks").insert({
    rag_id: ragId,
    check_type: "final",
    verdict: qualityVerdict,
    score: Math.min(1, newTotalChunks / 100),
    details: {
      total_sources: newTotalSources,
      total_chunks: newTotalChunks,
      subdomains_processed: activeSubdomains.length,
      levels_per_subdomain: RESEARCH_LEVELS.length,
    },
  });

  await updateRag(ragId as string, {
    status: "completed",
    quality_verdict: qualityVerdict,
    current_phase: activeSubdomains.length,
  });

  console.log(`[RAG ${ragId}] BUILD COMPLETED: ${newTotalChunks} chunks, verdict: ${qualityVerdict}`);
  return { ragId, batchIndex: idx, status: "completed", qualityVerdict };
}

// ═══════════════════════════════════════
// ACTION: REBUILD
// ═══════════════════════════════════════

async function handleRebuild(userId: string, body: Record<string, unknown>) {
  const { ragId } = body;
  if (!ragId) throw new Error("ragId is required");

  const { data: rag } = await supabase
    .from("rag_projects")
    .select("*")
    .eq("id", ragId)
    .eq("user_id", userId)
    .single();

  if (!rag) throw new Error("RAG project not found");
  if (!["failed", "completed", "cancelled"].includes(rag.status)) {
    throw new Error("Solo se puede regenerar un RAG en estado terminal (failed/completed/cancelled)");
  }
  if (!rag.domain_map) throw new Error("No hay domain_map para regenerar. Crea un nuevo RAG.");

  // Delete old data
  await supabase.from("rag_research_runs").delete().eq("rag_id", ragId);
  await supabase.from("rag_chunks").delete().eq("rag_id", ragId);
  await supabase.from("rag_sources").delete().eq("rag_id", ragId);
  await supabase.from("rag_variables").delete().eq("rag_id", ragId);
  await supabase.from("rag_taxonomy").delete().eq("rag_id", ragId);

  await updateRag(ragId as string, {
    status: "researching",
    total_sources: 0,
    total_chunks: 0,
    total_variables: 0,
    coverage_pct: 0,
    quality_verdict: null,
    error_log: null,
    current_phase: 0,
  });

  EdgeRuntime.waitUntil(triggerBatch(ragId as string, 0));

  return { ragId, status: "researching", message: "Regeneración iniciada con pipeline REAL" };
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

  const { data: runs } = await supabase
    .from("rag_research_runs")
    .select("*")
    .eq("rag_id", ragId)
    .order("created_at", { ascending: true });

  // Auto-heal stuck runs + stuck batches
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  const now = Date.now();
  if (runs) {
    for (const run of runs) {
      if (run.status === "running" && run.started_at) {
        const startedAt = new Date(run.started_at).getTime();
        if (now - startedAt > TEN_MINUTES_MS) {
          console.warn(`Auto-heal: marking orphaned run ${run.id} as failed`);
          await supabase
            .from("rag_research_runs")
            .update({ status: "failed", error_log: "Timeout detectado (auto-heal)" })
            .eq("id", run.id);
          run.status = "failed";
        }
      }
    }

    const allDone = runs.every((r: Record<string, unknown>) => r.status === "completed" || r.status === "failed");
    const anyRunning = runs.some((r: Record<string, unknown>) => r.status === "running");
    const anyCompleted = runs.some((r: Record<string, unknown>) => r.status === "completed");
    const activeSubdomains = getActiveSubdomains(rag);
    const expectedRuns = activeSubdomains.length * RESEARCH_LEVELS.length;
    const hasAllRuns = runs.length >= expectedRuns;

    if (allDone && runs.length > 0 && (rag.status === "building" || rag.status === "researching")) {
      if (hasAllRuns) {
        const newStatus = anyCompleted ? "completed" : "failed";
        const errorLog = anyCompleted ? null : "Todos los niveles fallaron.";
        await updateRag(ragId as string, { status: newStatus, error_log: errorLog });
        rag.status = newStatus;
      } else if (!anyRunning) {
        // Auto-retry: RAG is building, all existing runs done, but not all runs exist yet
        // Find the next batch index that should run
        const lastRun = runs[runs.length - 1];
        const lastSubdomain = lastRun?.subdomain as string;
        const lastLevel = lastRun?.research_level as string;
        const lastSubIdx = activeSubdomains.findIndex((s) => (s.name_technical as string) === lastSubdomain);
        const lastLevelIdx = RESEARCH_LEVELS.indexOf(lastLevel);
        const nextBatchIdx = (lastSubIdx >= 0 && lastLevelIdx >= 0)
          ? lastSubIdx * RESEARCH_LEVELS.length + lastLevelIdx + 1
          : runs.length;

        if (nextBatchIdx < expectedRuns) {
          // Check that last completed run was >5 min ago (avoid double-triggering)
          const lastCompletedAt = lastRun?.completed_at ? new Date(lastRun.completed_at as string).getTime() : 0;
          if (now - lastCompletedAt > FIVE_MINUTES_MS) {
            console.warn(`Auto-heal: re-triggering stuck batch ${nextBatchIdx} for RAG ${ragId}`);
            EdgeRuntime.waitUntil(triggerBatch(ragId as string, nextBatchIdx));
          }
        }
      }
    }
  }

  const { data: quality } = await supabase
    .from("rag_quality_checks")
    .select("*")
    .eq("rag_id", ragId)
    .order("created_at", { ascending: false })
    .limit(1);

  const { count: contradictionsCount } = await supabase
    .from("rag_contradictions")
    .select("*", { count: "exact", head: true })
    .eq("rag_id", ragId);

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
// ACTION: QUERY — REAL VECTOR SEARCH
// ═══════════════════════════════════════

async function handleQuery(userId: string, body: Record<string, unknown>) {
  const { ragId, question } = body;
  if (!ragId || !question) throw new Error("ragId and question are required");

  const { data: rag } = await supabase
    .from("rag_projects")
    .select("*")
    .eq("id", ragId)
    .eq("user_id", userId)
    .single();

  if (!rag) throw new Error("RAG project not found");
  if (rag.status !== "completed") throw new Error("RAG is not completed yet");

  // Step 1: Generate embedding for the question
  const questionEmbedding = await generateEmbedding(question as string);

  // Step 2: Vector search via pgvector
  const { data: chunks, error: rpcError } = await supabase.rpc("search_rag_chunks", {
    query_embedding: `[${questionEmbedding.join(",")}]`,
    match_rag_id: ragId,
    match_threshold: 0.5,
    match_count: 10,
  });

  if (rpcError) {
    console.error("search_rag_chunks RPC error:", rpcError);
    throw new Error("Error en búsqueda vectorial: " + rpcError.message);
  }

  const candidateChunks = chunks || [];

  if (candidateChunks.length === 0) {
    await supabase.from("rag_query_log").insert({
      rag_id: ragId,
      question: question as string,
      answer: "No tengo datos suficientes sobre esto.",
      sources_used: [],
      results_quality: 0,
    });

    return {
      answer: "No tengo datos suficientes sobre esto en la base de conocimiento actual. Prueba reformulando la pregunta.",
      sources: [],
      confidence: 0,
      tokens_used: 0,
    };
  }

  // Step 3: Generate answer with real chunks as context
  const chunksContext = candidateChunks
    .map((c: Record<string, unknown>, i: number) => {
      const sourceLine = c.source_url ? `[Fuente: ${c.source_name} — ${c.source_url}]` : `[Subdominio: ${c.subdomain}]`;
      return `[Chunk ${i + 1} | Similitud: ${(c.similarity as number).toFixed(2)} | ${sourceLine}]\n${c.content}`;
    })
    .join("\n\n---\n\n");

  const domain = rag.domain_description as string;
  const systemPrompt = `Eres un asistente experto en ${domain}.
Tu conocimiento proviene EXCLUSIVAMENTE de los documentos proporcionados, que son fuentes REALES descargadas de internet.

REGLAS:
1. Responde SOLO con información de los documentos.
2. Cita fuentes con formato: (Fuente: nombre, URL) cuando estén disponibles.
3. Si hay debates entre fuentes, presenta todos los puntos de vista.
4. Nunca inventes datos ni cites fuentes que no estén en los documentos.
5. Responde en el idioma de la pregunta.
6. Si no tienes datos suficientes, dilo claramente.
7. Al final, indica tu nivel de confianza en formato JSON: {"confidence": 0.X}

DOCUMENTOS REALES:
${chunksContext}`;

  const answer = await chat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: question as string },
    ],
    { model: "gemini-pro", maxTokens: 4096, temperature: 0.2 }
  );

  let confidence = 0.7;
  const confMatch = answer.match(/\{"confidence":\s*([\d.]+)\}/);
  if (confMatch) confidence = parseFloat(confMatch[1]);
  const cleanAnswer = answer.replace(/\{"confidence":\s*[\d.]+\}/, "").trim();

  const usedSources = candidateChunks
    .filter((c: Record<string, unknown>) => c.source_url)
    .map((c: Record<string, unknown>) => ({ name: c.source_name, url: c.source_url, similarity: c.similarity }));

  await supabase.from("rag_query_log").insert({
    rag_id: ragId,
    question: question as string,
    answer: cleanAnswer,
    sources_used: [...new Set(candidateChunks.map((c: Record<string, unknown>) => c.subdomain as string))],
    results_quality: confidence,
  });

  return {
    answer: cleanAnswer,
    sources: candidateChunks.map((c: Record<string, unknown>) => ({
      subdomain: c.subdomain,
      source_name: c.source_name,
      source_url: c.source_url,
      similarity: c.similarity,
      excerpt: (c.content as string).slice(0, 200) + "...",
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

  const domainMap = rag.domain_map as Record<string, unknown>;
  const subdomains = (domainMap?.subdomains as Array<Record<string, unknown>>) || [];

  let md = `# Base de Conocimiento: ${rag.domain_description}\n\n`;
  md += `**Fecha:** ${new Date(rag.updated_at as string).toLocaleDateString()}\n`;
  md += `**Cobertura:** ${rag.coverage_pct}% | **Fuentes:** ${rag.total_sources} | **Chunks:** ${rag.total_chunks}\n`;
  md += `**Veredicto:** ${rag.quality_verdict}\n\n---\n\n`;

  const intent = domainMap?.interpreted_intent as Record<string, unknown>;
  if (intent) {
    md += `## Resumen Ejecutivo\n\n**Necesidad:** ${intent.real_need}\n\n**Perfil:** ${intent.consumer_profile}\n\n`;
  }

  const chunksBySubdomain: Record<string, Array<Record<string, unknown>>> = {};
  for (const chunk of (chunks || [])) {
    const sd = chunk.subdomain as string;
    if (!chunksBySubdomain[sd]) chunksBySubdomain[sd] = [];
    chunksBySubdomain[sd].push(chunk);
  }

  for (const sub of subdomains) {
    const name = sub.name_technical as string;
    md += `\n---\n\n## ${name} (${sub.name_colloquial})\n\n`;

    const subChunks = chunksBySubdomain[name] || [];
    for (const chunk of subChunks) {
      md += `${chunk.content}\n\n`;
    }

    const subSources = (sources || []).filter((s: Record<string, unknown>) => s.subdomain === name);
    if (subSources.length > 0) {
      md += `### Fuentes\n\n`;
      for (const src of subSources) {
        md += `- **${src.source_name}** (${src.tier})${src.source_url ? ` — ${src.source_url}` : ""}\n`;
      }
      md += `\n`;
    }
  }

  if ((variables || []).length > 0) {
    md += `\n---\n\n## Variables Detectadas\n\n| Variable | Tipo | Descripción |\n|----------|------|-------------|\n`;
    for (const v of variables!) {
      md += `| ${v.name} | ${v.variable_type} | ${v.description} |\n`;
    }
  }

  if ((contradictions || []).length > 0) {
    md += `\n---\n\n## Contradicciones\n\n`;
    for (const c of contradictions!) {
      md += `- **${c.severity?.toUpperCase()}:** "${c.claim_a}" vs "${c.claim_b}"\n`;
    }
  }

  await supabase.from("rag_exports").insert({ rag_id: ragId as string, format: format as string });

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

    // build-batch: self-invocation with service role key
    if (action === "build-batch") {
      const authHeader = req.headers.get("Authorization");
      const token = authHeader?.replace("Bearer ", "");
      if (token !== SUPABASE_SERVICE_ROLE_KEY) {
        return new Response(JSON.stringify({ error: "Unauthorized: build-batch requires service role" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await handleBuildBatch(body);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      case "rebuild":
        result = await handleRebuild(userId, body);
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
