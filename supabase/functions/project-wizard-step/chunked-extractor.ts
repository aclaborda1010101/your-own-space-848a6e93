/**
 * chunked-extractor.ts — Map-Reduce extraction for long inputs.
 *
 * Goal: avoid the lossy `prepareLongInputForExtract` sampler when the user
 * wants the FULL input analyzed without losing the middle of the document.
 *
 * Strategy:
 *   1. Split raw input into N chunks (~35k chars each, with 1.8k overlap),
 *      preferring natural boundaries (PDF markers, speakers, paragraphs).
 *   2. Extract a *partial* mini-brief per chunk in parallel (concurrency=3).
 *   3. Merge all mini-briefs into a single `business_extraction_v2` block,
 *      deduplicating semantically and tracking `_source_chunks` per item.
 *   4. Optionally call ONE light LLM pass to synthesize the global narrative
 *      fields (project_summary, business_model_summary) from the merged data.
 *
 * NOTE: This module produces ONLY signal extraction. It NEVER creates
 * ComponentRegistryItem or COMP-XXX IDs (that's F2/F3 territory).
 */

import { callGeminiFlash } from "./llm-helpers.ts";

// ── Types ────────────────────────────────────────────────────────────

export interface SplitOpts {
  targetSize?: number;
  overlap?: number;
  maxChunks?: number;
}

export interface Chunk {
  chunk_id: string;
  char_start: number;
  char_end: number;
  text: string;
  overlap_before: number;
  overlap_after: number;
}

export interface ChunkBriefPartial {
  chunk_id: string;
  observed_facts?: any[];
  business_catalysts?: any[];
  underutilized_data_assets?: any[];
  quantified_economic_pains?: any[];
  decision_points?: any[];
  stakeholder_signals?: any[];
  client_requested_items?: any[];
  inferred_needs?: any[];
  ai_native_opportunity_signals?: any[];
  external_data_sources_mentioned?: any[];
  founder_commitment_signals?: any[];
  initial_compliance_flags?: any[];
  constraints_and_risks?: any[];
  open_questions?: any[];
  source_quotes?: any[];
  architecture_signals?: any[];
  tokensInput?: number;
  tokensOutput?: number;
}

export interface ChunkFailure {
  failed: true;
  chunk_id: string;
  error: string;
}

export interface ChunkExtractionContext {
  projectName: string;
  companyName: string;
  projectType?: string;
  clientNeed?: string;
}

export interface MergeResult {
  briefing: any;
  mergeTokensInput: number;
  mergeTokensOutput: number;
  mergeLlmCalled: boolean;
}

// ── 1. Split ─────────────────────────────────────────────────────────

const DEFAULT_TARGET_SIZE = 35_000;
const DEFAULT_OVERLAP = 1_800;
const DEFAULT_MAX_CHUNKS = 8;
const NATURAL_BOUNDARY_SEARCH_RADIUS = 2_000;

/** Patterns to prefer as cut points, in order of priority. */
const CUT_PATTERNS: RegExp[] = [
  /\n\s*---\s*[^\n]+?\.(pdf|docx?|txt|md|rtf|xlsx?|csv)\s*---\s*\n/gi, // doc markers
  /\n\s*\[\s*Speaker\s*\d+\s*\]/gi,
  /\n\s*\[?\d{1,2}:\d{2}(:\d{2})?\]?\s*\n/g, // timestamps
  /\n\n+/g, // paragraph breaks
];

/** Find the best natural boundary near `targetPos`, within ±radius chars. */
function findNaturalCutPoint(text: string, targetPos: number, radius = NATURAL_BOUNDARY_SEARCH_RADIUS): number {
  const start = Math.max(0, targetPos - radius);
  const end = Math.min(text.length, targetPos + radius);
  const window = text.slice(start, end);

  for (const pattern of CUT_PATTERNS) {
    pattern.lastIndex = 0;
    let bestMatch: RegExpExecArray | null = null;
    let bestDistance = Infinity;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(window)) !== null) {
      const absPos = start + m.index;
      const dist = Math.abs(absPos - targetPos);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestMatch = m;
      }
      if (m.index === pattern.lastIndex) pattern.lastIndex++; // avoid infinite loop on zero-width
    }
    if (bestMatch) {
      return start + bestMatch.index;
    }
  }

  // Fallback: cut at character boundary.
  return targetPos;
}

export function splitInputIntoChunks(raw: string, opts: SplitOpts = {}): Chunk[] {
  const targetSize = opts.targetSize ?? DEFAULT_TARGET_SIZE;
  const overlap = opts.overlap ?? DEFAULT_OVERLAP;
  const maxChunks = opts.maxChunks ?? DEFAULT_MAX_CHUNKS;

  const safe = raw ?? "";
  const total = safe.length;

  // Single chunk case.
  if (total <= targetSize) {
    return [{
      chunk_id: "CHUNK-001",
      char_start: 0,
      char_end: total,
      text: safe,
      overlap_before: 0,
      overlap_after: 0,
    }];
  }

  // Determine cap based on maxChunks.
  const maxBytes = maxChunks * targetSize;
  const effectiveTotal = Math.min(total, maxBytes);

  const chunks: Chunk[] = [];
  let cursor = 0;
  let idx = 1;

  while (cursor < effectiveTotal && chunks.length < maxChunks) {
    const tentativeEnd = Math.min(effectiveTotal, cursor + targetSize);
    let actualEnd = tentativeEnd;

    // If not the last chunk, snap to a natural boundary.
    if (tentativeEnd < effectiveTotal) {
      actualEnd = findNaturalCutPoint(safe, tentativeEnd);
      // Safety: don't allow zero-progress.
      if (actualEnd <= cursor + Math.floor(targetSize / 2)) {
        actualEnd = tentativeEnd;
      }
    }

    const chunkStart = cursor;
    const chunkEnd = actualEnd;
    const overlapBefore = chunkStart > 0 ? Math.min(overlap, chunkStart) : 0;
    const realStart = Math.max(0, chunkStart - overlapBefore);
    const text = safe.slice(realStart, chunkEnd);

    chunks.push({
      chunk_id: `CHUNK-${String(idx).padStart(3, "0")}`,
      char_start: realStart,
      char_end: chunkEnd,
      text,
      overlap_before: chunkStart - realStart,
      overlap_after: 0, // overlap is encoded into the NEXT chunk's start
    });

    cursor = chunkEnd;
    idx++;
  }

  return chunks;
}

// ── 2. Extract per chunk ─────────────────────────────────────────────

const CHUNK_EXTRACTION_SCHEMA_HINT = `{
  "chunk_id": "...",
  "observed_facts": [{ "title": "...", "description": "...", "evidence_snippets": ["cita literal"] }],
  "business_catalysts": [{ "title": "...", "description": "..." }],
  "underutilized_data_assets": [{ "title": "...", "description": "...", "data_volume_hint": "..." }],
  "quantified_economic_pains": [{ "title": "...", "description": "...", "amount_hint": "..." }],
  "decision_points": [{ "title": "...", "description": "..." }],
  "stakeholder_signals": [{ "name_or_role": "...", "signal": "..." }],
  "client_requested_items": [{ "title": "...", "description": "..." }],
  "inferred_needs": [{ "title": "...", "description": "..." }],
  "ai_native_opportunity_signals": [{ "title": "...", "description": "...", "candidate_component_type": "rag | agent | classifier | ..." }],
  "external_data_sources_mentioned": [{ "name": "...", "purpose": "..." }],
  "founder_commitment_signals": [{ "signal": "...", "strength": "low|medium|high" }],
  "initial_compliance_flags": [{ "flag": "personal_data_processing | profiling | ...", "evidence": "..." }],
  "constraints_and_risks": [{ "title": "...", "description": "..." }],
  "open_questions": [{ "question": "..." }],
  "architecture_signals": [{ "title": "...", "description": "..." }],
  "source_quotes": ["cita literal 1", "cita literal 2"]
}`;

export async function extractSignalsFromChunk(
  chunk: Chunk,
  ctx: ChunkExtractionContext,
): Promise<ChunkBriefPartial> {
  const systemPrompt = `Eres un analista senior de extracción de información para consultoría tecnológica.
Estás procesando UN BLOQUE PARCIAL de un material más largo (transcripción + documentos) sobre un proyecto.

REGLAS ESTRICTAS:
- Extrae SOLO señales presentes en este bloque. NO inventes. NO especules sobre lo que pueda haber en otros bloques.
- NO generes ComponentRegistryItem ni IDs tipo COMP-XXX. Solo señales de negocio.
- NO generes PRD ni propuestas comerciales.
- Conserva citas literales relevantes en evidence_snippets y source_quotes.
- Devuelve JSON ESTRICTO con la estructura indicada. Todos los arrays son opcionales (vacíos si no hay señal).
- Si este bloque es ruido (saludos, logística, off-topic), devuelve arrays vacíos.

PROYECTO OBJETIVO: ${ctx.projectName}
EMPRESA OBJETIVO: ${ctx.companyName}
${ctx.projectType ? `TIPO DE PROYECTO: ${ctx.projectType}` : ""}
${ctx.clientNeed ? `NECESIDAD INICIAL DEL CLIENTE: ${ctx.clientNeed}` : ""}

ESTRUCTURA OBLIGATORIA DE SALIDA (JSON):
${CHUNK_EXTRACTION_SCHEMA_HINT}`;

  const userPrompt = `BLOQUE ${chunk.chunk_id} (chars ${chunk.char_start}–${chunk.char_end}):

${chunk.text}

Devuelve SOLO el JSON con las señales encontradas en ESTE bloque. chunk_id debe ser "${chunk.chunk_id}".`;

  const result = await callGeminiFlash(systemPrompt, userPrompt, {
    maxRetries: 1,
    maxTokens: 8192,
  });

  // Parse JSON robustly.
  let parsed: any;
  try {
    let cleaned = result.text.trim();
    cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/gm, "").replace(/\n?```\s*$/gm, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    const text = result.text;
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(text.substring(firstBrace, lastBrace + 1));
      } catch {
        throw new Error(`Failed to parse chunk ${chunk.chunk_id} output`);
      }
    } else {
      throw new Error(`Chunk ${chunk.chunk_id}: no JSON in response`);
    }
  }

  // Tag every item with _source_chunks for downstream traceability.
  const tagItems = (arr: any) => {
    if (!Array.isArray(arr)) return [];
    return arr.map((item) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        return { ...item, _source_chunks: [chunk.chunk_id] };
      }
      return item;
    });
  };

  return {
    chunk_id: chunk.chunk_id,
    observed_facts: tagItems(parsed.observed_facts),
    business_catalysts: tagItems(parsed.business_catalysts),
    underutilized_data_assets: tagItems(parsed.underutilized_data_assets),
    quantified_economic_pains: tagItems(parsed.quantified_economic_pains),
    decision_points: tagItems(parsed.decision_points),
    stakeholder_signals: tagItems(parsed.stakeholder_signals),
    client_requested_items: tagItems(parsed.client_requested_items),
    inferred_needs: tagItems(parsed.inferred_needs),
    ai_native_opportunity_signals: tagItems(parsed.ai_native_opportunity_signals),
    external_data_sources_mentioned: tagItems(parsed.external_data_sources_mentioned),
    founder_commitment_signals: tagItems(parsed.founder_commitment_signals),
    initial_compliance_flags: tagItems(parsed.initial_compliance_flags),
    constraints_and_risks: tagItems(parsed.constraints_and_risks),
    open_questions: tagItems(parsed.open_questions),
    architecture_signals: tagItems(parsed.architecture_signals),
    source_quotes: Array.isArray(parsed.source_quotes) ? parsed.source_quotes : [],
    tokensInput: result.tokensInput,
    tokensOutput: result.tokensOutput,
  };
}

// ── 3. Concurrency runner ────────────────────────────────────────────

export async function runChunkedExtraction(
  chunks: Chunk[],
  ctx: ChunkExtractionContext,
  opts: { concurrency?: number } = {},
): Promise<(ChunkBriefPartial | ChunkFailure)[]> {
  const concurrency = opts.concurrency ?? 3;
  const results: (ChunkBriefPartial | ChunkFailure)[] = [];

  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (c): Promise<ChunkBriefPartial | ChunkFailure> => {
        try {
          return await extractSignalsFromChunk(c, ctx);
        } catch (e1) {
          // Single retry.
          try {
            return await extractSignalsFromChunk(c, ctx);
          } catch (e2) {
            const msg = e2 instanceof Error ? e2.message : String(e2);
            console.warn(`[chunked-extractor] chunk ${c.chunk_id} failed twice: ${msg}`);
            return { failed: true, chunk_id: c.chunk_id, error: msg };
          }
        }
      }),
    );
    results.push(...batchResults);
  }

  return results;
}

// ── 3.b Retry only failed chunks ─────────────────────────────────────

/**
 * Reconstructs the chunk list from the original input and re-runs ONLY the
 * chunks whose IDs appear in `failedChunkIds`. This avoids re-spending tokens
 * on chunks that already succeeded.
 *
 * Uses higher maxTokens (12_288) and an extra sequential retry compared to the
 * initial run, since failed chunks are typically the long/dense ones.
 */
export async function retryFailedChunks(
  failedChunkIds: string[],
  rawInput: string,
  ctx: ChunkExtractionContext,
  splitOpts: SplitOpts = {},
): Promise<{ recovered: ChunkBriefPartial[]; stillFailed: ChunkFailure[] }> {
  if (!failedChunkIds || failedChunkIds.length === 0) {
    return { recovered: [], stillFailed: [] };
  }

  // Re-split with the SAME options used originally so chunk_ids align.
  const allChunks = splitInputIntoChunks(rawInput, splitOpts);
  const wanted = new Set(failedChunkIds);
  const targets = allChunks.filter((c) => wanted.has(c.chunk_id));

  if (targets.length === 0) {
    console.warn(`[chunked-extractor][retry] no chunks matched IDs ${failedChunkIds.join(",")} (chunk count changed?)`);
    return {
      recovered: [],
      stillFailed: failedChunkIds.map((id) => ({ failed: true, chunk_id: id, error: "Chunk ID not found in current split" })),
    };
  }

  const recovered: ChunkBriefPartial[] = [];
  const stillFailed: ChunkFailure[] = [];

  // Run sequentially with up to 2 retries each (failed chunks are usually long).
  for (const chunk of targets) {
    let lastErr: unknown = null;
    let success = false;
    for (let attempt = 0; attempt < 3 && !success; attempt++) {
      try {
        const result = await extractSignalsFromChunkWithMaxTokens(chunk, ctx, 12_288);
        recovered.push(result);
        success = true;
      } catch (e) {
        lastErr = e;
        console.warn(`[chunked-extractor][retry] ${chunk.chunk_id} attempt ${attempt + 1}/3 failed: ${e instanceof Error ? e.message : e}`);
      }
    }
    if (!success) {
      stillFailed.push({
        failed: true,
        chunk_id: chunk.chunk_id,
        error: lastErr instanceof Error ? lastErr.message : String(lastErr),
      });
    }
  }

  console.log(`[chunked-extractor][retry] recovered ${recovered.length}/${targets.length}, still failed ${stillFailed.length}`);
  return { recovered, stillFailed };
}

/** Internal variant of extractSignalsFromChunk that accepts custom maxTokens. */
async function extractSignalsFromChunkWithMaxTokens(
  chunk: Chunk,
  ctx: ChunkExtractionContext,
  maxTokens: number,
): Promise<ChunkBriefPartial> {
  const systemPrompt = `Eres un analista senior de extracción de información para consultoría tecnológica.
Estás procesando UN BLOQUE PARCIAL de un material más largo (transcripción + documentos) sobre un proyecto.

REGLAS ESTRICTAS:
- Extrae SOLO señales presentes en este bloque. NO inventes.
- NO generes ComponentRegistryItem ni IDs tipo COMP-XXX. Solo señales de negocio.
- NO generes PRD ni propuestas comerciales.
- Conserva citas literales relevantes en evidence_snippets y source_quotes.
- Devuelve JSON ESTRICTO con la estructura indicada. Todos los arrays son opcionales.
- Sé CONCISO en descriptions (máx 2 frases) para no agotar el output budget.

PROYECTO OBJETIVO: ${ctx.projectName}
EMPRESA OBJETIVO: ${ctx.companyName}
${ctx.projectType ? `TIPO DE PROYECTO: ${ctx.projectType}` : ""}
${ctx.clientNeed ? `NECESIDAD INICIAL DEL CLIENTE: ${ctx.clientNeed}` : ""}

ESTRUCTURA OBLIGATORIA DE SALIDA (JSON):
${CHUNK_EXTRACTION_SCHEMA_HINT}`;

  const userPrompt = `BLOQUE ${chunk.chunk_id} (chars ${chunk.char_start}–${chunk.char_end}):

${chunk.text}

Devuelve SOLO el JSON con las señales encontradas en ESTE bloque. chunk_id debe ser "${chunk.chunk_id}".`;

  const result = await callGeminiFlash(systemPrompt, userPrompt, {
    maxRetries: 1,
    maxTokens,
  });

  let parsed: any;
  try {
    let cleaned = result.text.trim();
    cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/gm, "").replace(/\n?```\s*$/gm, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    const text = result.text;
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(text.substring(firstBrace, lastBrace + 1));
      } catch {
        throw new Error(`Failed to parse chunk ${chunk.chunk_id} output`);
      }
    } else {
      throw new Error(`Chunk ${chunk.chunk_id}: no JSON in response`);
    }
  }

  const tagItems = (arr: any) => {
    if (!Array.isArray(arr)) return [];
    return arr.map((item) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        return { ...item, _source_chunks: [chunk.chunk_id] };
      }
      return item;
    });
  };

  return {
    chunk_id: chunk.chunk_id,
    observed_facts: tagItems(parsed.observed_facts),
    business_catalysts: tagItems(parsed.business_catalysts),
    underutilized_data_assets: tagItems(parsed.underutilized_data_assets),
    quantified_economic_pains: tagItems(parsed.quantified_economic_pains),
    decision_points: tagItems(parsed.decision_points),
    stakeholder_signals: tagItems(parsed.stakeholder_signals),
    client_requested_items: tagItems(parsed.client_requested_items),
    inferred_needs: tagItems(parsed.inferred_needs),
    ai_native_opportunity_signals: tagItems(parsed.ai_native_opportunity_signals),
    external_data_sources_mentioned: tagItems(parsed.external_data_sources_mentioned),
    founder_commitment_signals: tagItems(parsed.founder_commitment_signals),
    initial_compliance_flags: tagItems(parsed.initial_compliance_flags),
    constraints_and_risks: tagItems(parsed.constraints_and_risks),
    open_questions: tagItems(parsed.open_questions),
    architecture_signals: tagItems(parsed.architecture_signals),
    source_quotes: Array.isArray(parsed.source_quotes) ? parsed.source_quotes : [],
    tokensInput: result.tokensInput,
    tokensOutput: result.tokensOutput,
  };
}

// ── 4. Merge ─────────────────────────────────────────────────────────

/** Normalize a string for fuzzy dedup (lowercase, trim, collapse whitespace, take first 80 chars). */
function dedupKey(item: any): string {
  if (!item || typeof item !== "object") return JSON.stringify(item);
  const candidate =
    item.title ||
    item.description ||
    item.signal ||
    item.question ||
    item.flag ||
    item.name ||
    item.name_or_role ||
    JSON.stringify(item).slice(0, 200);
  return String(candidate)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function mergeArrays(briefs: ChunkBriefPartial[], field: keyof ChunkBriefPartial): any[] {
  const map = new Map<string, any>();
  for (const brief of briefs) {
    const arr = (brief[field] as any[]) || [];
    for (const item of arr) {
      const key = dedupKey(item);
      const existing = map.get(key);
      if (existing) {
        // Merge _source_chunks and bump evidence count.
        const mergedSources = Array.from(
          new Set([...(existing._source_chunks || []), ...(item._source_chunks || [])]),
        );
        existing._source_chunks = mergedSources;
        existing._evidence_count = mergedSources.length;
        // If item appears in ≥2 chunks, mark high certainty.
        if (mergedSources.length >= 2 && existing.certainty !== "high") {
          existing.certainty = "high";
        }
        // Merge evidence_snippets if present.
        if (Array.isArray(item.evidence_snippets) && Array.isArray(existing.evidence_snippets)) {
          const combined = Array.from(new Set([...existing.evidence_snippets, ...item.evidence_snippets]));
          existing.evidence_snippets = combined.slice(0, 5);
        }
      } else {
        map.set(key, {
          ...item,
          _source_chunks: item._source_chunks || [],
          _evidence_count: 1,
        });
      }
    }
  }
  return Array.from(map.values());
}

function mergeQuotes(briefs: ChunkBriefPartial[]): string[] {
  const set = new Set<string>();
  for (const b of briefs) {
    for (const q of b.source_quotes || []) {
      if (typeof q === "string" && q.trim().length > 0) {
        set.add(q.trim());
      }
    }
  }
  return Array.from(set).slice(0, 50);
}

/**
 * Merge N chunk briefs into a single business_extraction_v2-shaped object.
 * If `synthesizeNarrative` is true, makes ONE additional LLM call to generate
 * project_summary + business_model_summary from the merged structured data.
 */
export async function mergeChunkBriefs(
  briefs: ChunkBriefPartial[],
  ctx: { projectName: string; companyName: string },
  opts: { synthesizeNarrative?: boolean } = {},
): Promise<MergeResult> {
  if (briefs.length === 0) {
    throw new Error("mergeChunkBriefs: no chunk briefs provided");
  }

  const synthesize = opts.synthesizeNarrative !== false;

  // 1. Deterministic merge of all signal arrays.
  const v2: Record<string, any> = {
    observed_facts: mergeArrays(briefs, "observed_facts"),
    business_catalysts: mergeArrays(briefs, "business_catalysts"),
    underutilized_data_assets: mergeArrays(briefs, "underutilized_data_assets"),
    quantified_economic_pains: mergeArrays(briefs, "quantified_economic_pains"),
    decision_points: mergeArrays(briefs, "decision_points"),
    stakeholder_signals: mergeArrays(briefs, "stakeholder_signals"),
    client_requested_items: mergeArrays(briefs, "client_requested_items"),
    inferred_needs: mergeArrays(briefs, "inferred_needs"),
    ai_native_opportunity_signals: mergeArrays(briefs, "ai_native_opportunity_signals"),
    external_data_sources_mentioned: mergeArrays(briefs, "external_data_sources_mentioned"),
    founder_commitment_signals: mergeArrays(briefs, "founder_commitment_signals"),
    initial_compliance_flags: mergeArrays(briefs, "initial_compliance_flags"),
    constraints_and_risks: mergeArrays(briefs, "constraints_and_risks"),
    open_questions: mergeArrays(briefs, "open_questions"),
    architecture_signals: mergeArrays(briefs, "architecture_signals"),
    source_quotes: mergeQuotes(briefs),
  };

  let mergeTokensInput = 0;
  let mergeTokensOutput = 0;
  let mergeLlmCalled = false;

  // 2. Optional narrative synthesis (project_summary + business_model_summary).
  if (synthesize) {
    try {
      const summaryInput = {
        observed_facts: v2.observed_facts.slice(0, 12).map((f: any) => f.title || f.description),
        business_catalysts: v2.business_catalysts.slice(0, 8).map((f: any) => f.title || f.description),
        client_requested_items: v2.client_requested_items.slice(0, 10).map((f: any) => f.title || f.description),
        inferred_needs: v2.inferred_needs.slice(0, 10).map((f: any) => f.title || f.description),
        ai_native_opportunity_signals: v2.ai_native_opportunity_signals.slice(0, 8).map((f: any) => f.title || f.description),
        constraints_and_risks: v2.constraints_and_risks.slice(0, 6).map((f: any) => f.title || f.description),
        compliance_flags: v2.initial_compliance_flags.map((f: any) => f.flag),
      };

      const synthSystem = `Eres analista senior. Sintetiza un resumen ejecutivo del proyecto a partir de señales estructuradas extraídas en bloques. Devuelve JSON ESTRICTO sin markdown.`;

      const synthUser = `PROYECTO: ${ctx.projectName} (empresa: ${ctx.companyName})

Señales agregadas (deduplicadas) extraídas de varios bloques del material:
${JSON.stringify(summaryInput, null, 2)}

Devuelve JSON con esta estructura:
{
  "project_title": "string corto descriptivo (máx 60 chars)",
  "business_model_summary": {
    "title": "string (máx 80 chars)",
    "context": "párrafo de 2-4 frases sobre el contexto del negocio y por qué emerge este proyecto",
    "primary_goal": "una frase con el objetivo principal",
    "complexity_level": "low | medium | high",
    "urgency_level": "low | medium | high"
  },
  "executive_summary": "párrafo de 4-6 frases que sintetice el proyecto, su origen, oportunidad principal de IA y riesgos clave"
}`;

      const synthResult = await callGeminiFlash(synthSystem, synthUser, { maxRetries: 1, maxTokens: 2048 });
      mergeTokensInput = synthResult.tokensInput;
      mergeTokensOutput = synthResult.tokensOutput;
      mergeLlmCalled = true;

      let synthParsed: any = null;
      try {
        let cleaned = synthResult.text.trim().replace(/^```(?:json)?\s*\n?/gm, "").replace(/\n?```\s*$/gm, "").trim();
        synthParsed = JSON.parse(cleaned);
      } catch {
        const fb = synthResult.text.indexOf("{");
        const lb = synthResult.text.lastIndexOf("}");
        if (fb !== -1 && lb > fb) {
          try { synthParsed = JSON.parse(synthResult.text.substring(fb, lb + 1)); } catch { /* swallow */ }
        }
      }

      if (synthParsed && typeof synthParsed === "object") {
        if (typeof synthParsed.project_title === "string") v2.project_title = synthParsed.project_title;
        if (synthParsed.business_model_summary && typeof synthParsed.business_model_summary === "object") {
          v2.business_model_summary = synthParsed.business_model_summary;
        }
        if (typeof synthParsed.executive_summary === "string") v2.executive_summary = synthParsed.executive_summary;
      }
    } catch (e) {
      console.warn("[chunked-extractor] narrative synthesis failed (non-blocking):", e instanceof Error ? e.message : e);
    }
  }

  // 3. client_naming_check (placeholder; extract action populates if naming is explicit elsewhere).
  v2.client_naming_check = {
    client_company_name: ctx.companyName,
    proposed_product_name: null,
    collision_detected: false,
  };

  const briefing = {
    brief_version: "2.0.0",
    business_extraction_v2: v2,
    legacy_compatibility: { mapped_to_old_brief_fields: true },
    extraction_warnings: [] as any[],
  };

  return {
    briefing,
    mergeTokensInput,
    mergeTokensOutput,
    mergeLlmCalled,
  };
}
