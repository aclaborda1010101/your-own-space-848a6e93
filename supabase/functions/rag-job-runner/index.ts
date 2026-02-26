import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Job {
  id: string;
  rag_id: string;
  job_type: string;
  source_id: string | null;
  payload: Record<string, unknown>;
  attempt: number;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function workerId(): string {
  return `edge:${crypto.randomUUID().slice(0, 8)}`;
}

// ──────── Utilities ────────

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeForHash(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000),
      dimensions: 1024,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embedding error: ${err}`);
  }
  const json = await res.json();
  return json.data[0].embedding;
}

// ──────── Stage: FETCH ────────

// Domains known to block scrapers — route to EXTERNAL_SCRAPE
const PROTECTED_DOMAINS = [
  // Academic
  "sciencedirect.com", "springer.com", "wiley.com", "tandfonline.com",
  "jstor.org", "nature.com", "sagepub.com", "cambridge.org", "oxfordacademic.com",
  "elsevier.com", "apa.org", "bmj.com", "thelancet.com", "cell.com",
  // Legal/Government (Spain)
  "boe.es", "interior.gob.es", "industria.gob.es", "aepd.es", "vlex.es",
  "noticias.juridicas.com", "studocu.com", "congreso.es", "senado.es",
  "mjusticia.gob.es", "lamoncloa.gob.es", "poderjudicial.es",
  "mscbs.gob.es", "miteco.gob.es", "hacienda.gob.es",
];

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";

function isProtectedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return PROTECTED_DOMAINS.some(d => hostname.includes(d));
  } catch {
    return false;
  }
}

/** Try Firecrawl scrape — returns markdown or empty string */
async function tryFirecrawlScrape(url: string): Promise<string> {
  if (!FIRECRAWL_API_KEY) return "";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) {
      console.warn(`[Firecrawl] Failed for ${url}: ${response.status}`);
      return "";
    }
    const data = await response.json();
    return data.data?.markdown || data.markdown || "";
  } catch (err) {
    console.warn(`[Firecrawl] Error for ${url}:`, err);
    return "";
  }
}

/** Basic PDF text extraction from binary — regex on text streams */
function extractTextFromPdfBinary(buffer: Uint8Array): string {
  // PDF text objects are between BT...ET, with text in (...) or <...> after Tj/TJ
  const raw = new TextDecoder("latin1").decode(buffer);
  const textParts: string[] = [];

  // Method 1: Extract parenthesized strings from text objects
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(raw)) !== null) {
    const block = match[1];
    const tjRegex = /\(([^)]*)\)/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      const decoded = tjMatch[1]
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\\\/g, "\\")
        .replace(/\\([()])/g, "$1");
      if (decoded.trim()) textParts.push(decoded);
    }
  }

  // Method 2: Look for stream content with readable text
  if (textParts.length === 0) {
    const readable = raw.match(/[\x20-\x7E\xC0-\xFF]{20,}/g) || [];
    textParts.push(...readable);
  }

  return textParts.join(" ").replace(/\s+/g, " ").trim();
}

async function handleFetch(job: Job) {
  if (!job.source_id) throw new Error("FETCH job missing source_id — orphan job, cannot process");
  const sourceId = job.source_id;
  const { data: src, error } = await sb
    .from("rag_sources")
    .select("*")
    .eq("id", sourceId)
    .single();
  if (error) throw error;

  const url = src.source_url || src.url;
  if (!url) throw new Error("Source has no URL");

  const isPdf = /\.pdf(\?|$)/i.test(url);

  // === Strategy 1: Try Firecrawl first (handles JS rendering, cookies, PDFs) ===
  if (FIRECRAWL_API_KEY) {
    console.log(`[FETCH] Trying Firecrawl for: ${url}`);
    const markdown = await tryFirecrawlScrape(url);
    const wordCount = markdown.trim().split(/\s+/).filter(Boolean).length;

    if (wordCount >= 250) {
      console.log(`[FETCH] Firecrawl success: ${wordCount} words from ${url}`);
      await sb.from("rag_sources").update({
        status: "FETCHED",
        content_type: isPdf ? "application/pdf" : "text/html",
        extraction_quality: "high",
      }).eq("id", sourceId);

      await sb.from("rag_jobs").insert({
        rag_id: job.rag_id,
        job_type: "CLEAN",
        source_id: sourceId,
        payload: { mainText: markdown.slice(0, 200000) },
      });
      return;
    }
    console.log(`[FETCH] Firecrawl insufficient (${wordCount}w) for ${url}, falling back...`);
  }

  // === Strategy 2: Protected domains → EXTERNAL_SCRAPE ===
  if (isProtectedDomain(url)) {
    console.log(`[FETCH] Protected domain: ${url} → EXTERNAL_SCRAPE`);
    await sb.from("rag_sources").update({ status: "PENDING_EXTERNAL" }).eq("id", sourceId);
    await sb.from("rag_jobs").insert({
      rag_id: job.rag_id,
      job_type: "EXTERNAL_SCRAPE",
      source_id: sourceId,
      payload: { url, reason: "protected_domain" },
    });
    return;
  }

  // === Strategy 3: Direct fetch ===
  const res = await fetch(url, {
    headers: { "User-Agent": "JarvisRAG/1.0" },
    signal: AbortSignal.timeout(15000),
  });

  const contentType = res.headers.get("content-type") ?? "";
  const httpStatus = res.status;

  // Blocked → EXTERNAL_SCRAPE
  if (httpStatus === 403 || httpStatus === 503) {
    console.log(`[FETCH] HTTP ${httpStatus} for ${url} → EXTERNAL_SCRAPE`);
    await sb.from("rag_sources").update({
      http_status: httpStatus, content_type: contentType, status: "PENDING_EXTERNAL",
    }).eq("id", sourceId);
    await sb.from("rag_jobs").insert({
      rag_id: job.rag_id,
      job_type: "EXTERNAL_SCRAPE",
      source_id: sourceId,
      payload: { url, reason: `http_${httpStatus}` },
    });
    return;
  }

  if (httpStatus < 200 || httpStatus >= 300) {
    await sb.from("rag_sources").update({
      http_status: httpStatus, content_type: contentType, status: "FAILED",
      error: { message: `HTTP ${httpStatus}` },
    }).eq("id", sourceId);
    return;
  }

  // === PDF binary handling ===
  if (isPdf || contentType.includes("pdf")) {
    console.log(`[FETCH] PDF detected: ${url}, attempting native extraction`);
    const buffer = new Uint8Array(await res.arrayBuffer());
    const pdfText = extractTextFromPdfBinary(buffer);
    const pdfWords = pdfText.trim().split(/\s+/).filter(Boolean).length;

    if (pdfWords >= 250) {
      console.log(`[FETCH] PDF native extraction: ${pdfWords} words`);
      await sb.from("rag_sources").update({
        http_status: httpStatus, content_type: "application/pdf",
        status: "FETCHED", extraction_quality: "medium", word_count: pdfWords,
      }).eq("id", sourceId);
      await sb.from("rag_jobs").insert({
        rag_id: job.rag_id, job_type: "CLEAN", source_id: sourceId,
        payload: { mainText: pdfText.slice(0, 200000) },
      });
    } else {
      // PDF too short — route to EXTERNAL_SCRAPE for OCR
      console.log(`[FETCH] PDF native extraction insufficient (${pdfWords}w) → EXTERNAL_SCRAPE`);
      await sb.from("rag_sources").update({
        http_status: httpStatus, content_type: "application/pdf", status: "PENDING_EXTERNAL",
      }).eq("id", sourceId);
      await sb.from("rag_jobs").insert({
        rag_id: job.rag_id, job_type: "EXTERNAL_SCRAPE", source_id: sourceId,
        payload: { url, reason: "pdf_extraction_failed" },
      });
    }
    return;
  }

  // === Text/HTML handling ===
  let rawText = "";
  if (contentType.includes("text") || contentType.includes("html") || contentType.includes("json")) {
    rawText = await res.text();
  } else {
    // Unknown binary → EXTERNAL_SCRAPE
    await sb.from("rag_sources").update({
      http_status: httpStatus, content_type: contentType, status: "PENDING_EXTERNAL",
    }).eq("id", sourceId);
    await sb.from("rag_jobs").insert({
      rag_id: job.rag_id, job_type: "EXTERNAL_SCRAPE", source_id: sourceId,
      payload: { url, reason: "unsupported_content_type" },
    });
    return;
  }

  await sb.from("rag_sources").update({
    http_status: httpStatus, content_type: contentType, status: "FETCHED",
  }).eq("id", sourceId);

  await sb.from("rag_jobs").insert({
    rag_id: job.rag_id, job_type: "EXTRACT", source_id: sourceId,
    payload: { rawText: rawText.slice(0, 500000) },
  });
}

// ──────── Stage: EXTRACT ────────

function extractMainText(html: string): string {
  const noScript = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ");
  const text = noScript.replace(/<[^>]+>/g, " ");
  return text.replace(/\s+/g, " ").trim();
}

async function handleExtract(job: Job) {
  const sourceId = job.source_id!;
  const rawText = (job.payload?.rawText as string) ?? "";

  const mainText = extractMainText(rawText);
  const wordCount = mainText
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const extractionQuality =
    wordCount > 800 ? "high" : wordCount > 300 ? "medium" : "low";
  const status = wordCount < 250 ? "SKIPPED" : "EXTRACTED";

  await sb
    .from("rag_sources")
    .update({ status, extraction_quality: extractionQuality, word_count: wordCount })
    .eq("id", sourceId);

  if (status === "EXTRACTED") {
    await sb.from("rag_jobs").insert({
      rag_id: job.rag_id,
      job_type: "CLEAN",
      source_id: sourceId,
      payload: { mainText: mainText.slice(0, 200000) },
    });
  }
}

// ──────── Stage: CLEAN ────────

function cleanScrapedContent(rawText: string): string {
  let cleaned = rawText;

  const junkPatterns = [
    /(?:menu|nav|footer|sidebar|header|cookie|newsletter|subscribe|advertisement|share this|related posts|te puede interesar|artículos relacionados|categorías|etiquetas|tags|comments|deja un comentario|leave a reply)[\s\S]{0,500}/gi,
    /(?:follow us|síguenos|redes sociales|facebook|twitter|instagram|linkedin|youtube|pinterest|whatsapp)[\s\S]{0,200}/gi,
    /(?:privacy policy|política de privacidad|terms of service|aviso legal|cookies?)[\s\S]{0,300}/gi,
    /(?:you will receive|suscríbete|subscribe|sign up|regístrate)[\s\S]{0,200}/gi,
  ];

  for (const p of junkPatterns) cleaned = cleaned.replace(p, "");

  cleaned = cleaned.replace(/https?:\/\/\S+(?<![\.])/g, "");
  cleaned = cleaned
    .split("\n")
    .filter((l) => l.trim().length > 40)
    .join("\n");
  cleaned = cleaned
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ {2,}/g, " ")
    .trim();

  if (cleaned.length < 200) return "";
  return cleaned;
}

async function handleClean(job: Job) {
  const sourceId = job.source_id!;
  const mainText = (job.payload?.mainText as string) ?? "";
  const cleaned = cleanScrapedContent(mainText);
  const wordCount = cleaned
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const status = wordCount < 250 ? "SKIPPED" : "CLEANED";
  await sb
    .from("rag_sources")
    .update({ status, word_count: wordCount })
    .eq("id", sourceId);

  if (status === "CLEANED") {
    const contentHash = await sha256(normalizeForHash(cleaned));
    await sb
      .from("rag_sources")
      .update({ content_hash: contentHash })
      .eq("id", sourceId);

    await sb.from("rag_jobs").insert({
      rag_id: job.rag_id,
      job_type: "CHUNK",
      source_id: sourceId,
      payload: { cleaned: cleaned.slice(0, 200000) },
    });
  }
}

// ──────── Stage: CHUNK ────────

interface ChunkData {
  title?: string;
  content: string;
  subdomain?: string;
  metadata?: Record<string, unknown>;
}

function cheapChunk(text: string): ChunkData[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: ChunkData[] = [];
  let buf: string[] = [];
  let words = 0;

  const flush = () => {
    if (!buf.length) return;
    const content = buf.join("\n\n").trim();
    chunks.push({ content, metadata: {} });
    buf = [];
    words = 0;
  };

  for (const p of paragraphs) {
    const w = p.split(/\s+/).length;
    if (words + w > 320) flush();
    buf.push(p);
    words += w;
    if (words >= 180) flush();
  }
  flush();
  return chunks;
}

async function handleChunk(job: Job) {
  const sourceId = job.source_id!;
  const cleaned = (job.payload?.cleaned as string) ?? "";
  const offset = (job.payload?.offset as number) ?? 0;
  const MAX_CHUNKS_PER_BATCH = 50;

  const allChunks = cheapChunk(cleaned);
  const batch = allChunks.slice(offset, offset + MAX_CHUNKS_PER_BATCH);

  if (batch.length > 0) {
    await sb.from("rag_jobs").insert({
      rag_id: job.rag_id,
      job_type: "SCORE",
      source_id: sourceId,
      payload: { chunks: batch },
    });
  }

  // Fan-out: if more chunks remain, self-enqueue next batch
  const nextOffset = offset + MAX_CHUNKS_PER_BATCH;
  if (nextOffset < allChunks.length) {
    console.log(`[CHUNK] Fan-out: ${allChunks.length} total, next offset ${nextOffset}`);
    await sb.from("rag_jobs").insert({
      rag_id: job.rag_id,
      job_type: "CHUNK",
      source_id: sourceId,
      payload: { cleaned: cleaned.slice(0, 200000), offset: nextOffset },
    });
  }

  await sb
    .from("rag_sources")
    .update({ status: "CHUNKED" })
    .eq("id", sourceId);
}

// ──────── Stage: SCORE ────────

function scoreChunkCheap(content: string) {
  const words = content.split(/\s+/).filter(Boolean).length;
  const noiseHits = (
    content.match(
      /cookie|subscribe|privacy|facebook|twitter|instagram|related|newsletter/gi
    ) ?? []
  ).length;
  const noiseRatio = noiseHits / Math.max(1, words);

  let score = 100;
  if (words < 80) score -= 60;
  if (words > 650) score -= 20;
  if (noiseRatio > 0.02) score -= 25;
  if (noiseRatio > 0.06) score -= 50;

  const verdict = score >= 75 ? "KEEP" : score >= 55 ? "REPAIR" : "DROP";
  return {
    score,
    verdict,
    length_words: words,
    noise_ratio: Number(noiseRatio.toFixed(4)),
  };
}

async function handleScore(job: Job) {
  const sourceId = job.source_id!;
  const chunks = (job.payload?.chunks as ChunkData[]) ?? [];

  const scored = chunks.map((c) => ({
    ...c,
    quality: scoreChunkCheap(c.content),
  }));

  const keep = scored.filter((c) => c.quality.verdict !== "DROP");

  await sb.from("rag_jobs").insert({
    rag_id: job.rag_id,
    job_type: "EMBED",
    source_id: sourceId,
    payload: { chunks: keep },
  });

  await sb
    .from("rag_sources")
    .update({ status: "SCORED" })
    .eq("id", sourceId);
}

// ──────── Stage: EMBED ────────

async function handleEmbed(job: Job) {
  const sourceId = job.source_id!;
  const chunks = (job.payload?.chunks as Array<ChunkData & { quality?: Record<string, unknown> }>) ?? [];

  // Get source info for subdomain
  const { data: src } = await sb
    .from("rag_sources")
    .select("subdomain, source_name")
    .eq("id", sourceId)
    .single();

  let embedded = 0;

  for (const ch of chunks) {
    const content = ch.content.trim();
    if (!content) continue;

    const contentHash = await sha256(normalizeForHash(content));

    // Try insert — unique index will reject hash dupes silently
    const embedding = await generateEmbedding(content);

    // Semantic dedup check
    const { data: dups } = await sb.rpc("check_chunk_duplicate", {
      query_embedding: embedding,
      match_rag_id: job.rag_id,
      similarity_threshold: 0.92,
    });

    if (dups && dups.length > 0) {
      continue; // semantic duplicate
    }

    const { error: insertErr } = await sb.from("rag_chunks").insert({
      rag_id: job.rag_id,
      source_id: sourceId,
      subdomain: ch.subdomain || src?.subdomain || null,
      title: ch.title || null,
      content,
      lang: "es",
      content_hash: contentHash,
      embedding,
      metadata: ch.metadata ?? {},
      quality: ch.quality ?? {},
    });

    if (insertErr) {
      // If unique violation on hash, skip silently
      if (insertErr.code === "23505") continue;
      console.error("Chunk insert error:", insertErr);
    } else {
      embedded++;
    }

    // Small delay to avoid rate limits
    if (embedded % 5 === 0) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  await sb
    .from("rag_sources")
    .update({ status: "EMBEDDED" })
    .eq("id", sourceId);

  console.log(`Embedded ${embedded} chunks for source ${sourceId}`);
}

// ──────── Stage: DOMAIN_ANALYSIS ────────

async function handleDomainAnalysis(job: Job) {
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  
  const res = await fetch(`${SUPABASE_URL}/functions/v1/rag-architect`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      action: "execute-domain-analysis",
      ragId: job.rag_id,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`execute-domain-analysis failed: ${res.status} ${errText}`);
  }

  const result = await res.json();
  if (result.error) throw new Error(result.error);
  console.log(`[DOMAIN_ANALYSIS] Completed for rag ${job.rag_id}`);
}

// ──────── Stage: RESUME_BUILD ────────

async function handleResumeBuildJob(job: Job) {
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/rag-architect`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      action: "resume-build",
      ragId: job.rag_id,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`resume-build failed: ${res.status} ${errText}`);
  }

  const result = await res.json();
  if (result.error) throw new Error(result.error);
  console.log(`[RESUME_BUILD] Completed for rag ${job.rag_id}:`, result.status);
}
// ──────── Stage: DETECT_PATTERNS ────────

async function handleDetectPatterns(job: Job) {
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const runId = (job.payload?.run_id as string) || "";
  const projectId = (job.payload?.project_id as string) || "";

  const res = await fetch(`${SUPABASE_URL}/functions/v1/rag-architect`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      action: "execute-pattern-detection",
      ragId: job.rag_id,
      runId,
      projectId,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`execute-pattern-detection failed: ${res.status} ${errText}`);
  }

  const result = await res.json();
  if (result.error) throw new Error(result.error);
  console.log(`[DETECT_PATTERNS] Completed for rag ${job.rag_id}:`, result);
}

// ──────── Post-Build Handlers ────────

async function callArchitect(body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/rag-architect`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`rag-architect call failed (${res.status}): ${errText}`);
  }
  const result = await res.json();
  if (result.error) throw new Error(result.error);
}

async function handlePostBuildKG(job: Job) {
  const subdomain = (job.payload?.subdomain as string) || "";
  if (!subdomain) throw new Error("POST_BUILD_KG job missing subdomain in payload");
  console.log(`[POST_BUILD_KG] Processing subdomain: ${subdomain} for rag ${job.rag_id}`);
  await callArchitect({ action: "execute-kg-subdomain", ragId: job.rag_id, subdomain });
}

async function handlePostBuildTaxonomy(job: Job) {
  console.log(`[POST_BUILD_TAXONOMY] Processing for rag ${job.rag_id}`);
  await callArchitect({ action: "post-build", ragId: job.rag_id, step: "taxonomy" });
}

async function handlePostBuildContra(job: Job) {
  console.log(`[POST_BUILD_CONTRA] Processing for rag ${job.rag_id}`);
  await callArchitect({ action: "post-build", ragId: job.rag_id, step: "contradictions" });
}

async function handlePostBuildQG(job: Job) {
  console.log(`[POST_BUILD_QG] Processing for rag ${job.rag_id}`);
  await callArchitect({ action: "post-build", ragId: job.rag_id, step: "quality_gate" });
}

/** After a post-build step completes, enqueue next step with race-condition protection via unique partial index. */
async function maybeEnqueueNextPostBuildStep(job: Job, completedJobType: string) {
  let nextJobType: string | null = null;

  if (completedJobType === "POST_BUILD_KG") {
    // Check if any sibling KG jobs are still in-flight
    const { count } = await sb
      .from("rag_jobs")
      .select("*", { count: "exact", head: true })
      .eq("rag_id", job.rag_id)
      .eq("job_type", "POST_BUILD_KG")
      .in("status", ["PENDING", "RETRY", "RUNNING"]);
    if ((count || 0) > 0) {
      console.log(`[POST_BUILD_KG] ${count} KG jobs still pending for rag ${job.rag_id}`);
      return;
    }
    nextJobType = "POST_BUILD_TAXONOMY";
  } else if (completedJobType === "POST_BUILD_TAXONOMY") {
    nextJobType = "POST_BUILD_CONTRA";
  } else if (completedJobType === "POST_BUILD_CONTRA") {
    nextJobType = "POST_BUILD_QG";
  }

  if (!nextJobType) return;

  // Atomic insert — unique partial index (idx_single_post_build_job) prevents duplicates
  const { error } = await sb.from("rag_jobs").insert({
    rag_id: job.rag_id,
    job_type: nextJobType,
    payload: {},
  });

  if (error && error.code === "23505") {
    console.log(`[${completedJobType}] ${nextJobType} already enqueued for rag ${job.rag_id} (dedup by unique index)`);
  } else if (error) {
    console.error(`[${completedJobType}] Failed to enqueue ${nextJobType}:`, error);
    throw error;
  } else {
    console.log(`[${completedJobType}] Done → enqueued ${nextJobType} for rag ${job.rag_id}`);
  }
}

// ──────── Router ────────

async function runOneJob(): Promise<Record<string, unknown>> {
  const wid = workerId();

  const { data, error } = await sb.rpc("pick_next_job", { worker_id: wid });
  if (error) throw error;

  const jobs = data as Job[] | null;
  if (!jobs || jobs.length === 0) {
    return { ok: true, message: "no_jobs" };
  }

  const job = jobs[0];
  console.log(`[${wid}] Processing ${job.job_type} job ${job.id} (attempt ${job.attempt})`);

  try {
    switch (job.job_type) {
      case "FETCH":
        await handleFetch(job);
        break;
      case "EXTRACT":
        await handleExtract(job);
        break;
      case "CLEAN":
        await handleClean(job);
        break;
      case "CHUNK":
        await handleChunk(job);
        break;
      case "SCORE":
        await handleScore(job);
        break;
      case "EMBED":
        await handleEmbed(job);
        break;
      case "DOMAIN_ANALYSIS":
        await handleDomainAnalysis(job);
        break;
      case "RESUME_BUILD":
        await handleResumeBuildJob(job);
        break;
      case "DETECT_PATTERNS":
        await handleDetectPatterns(job);
        break;
      case "POST_BUILD_KG":
        await handlePostBuildKG(job);
        break;
      case "POST_BUILD_TAXONOMY":
        await handlePostBuildTaxonomy(job);
        break;
      case "POST_BUILD_CONTRA":
        await handlePostBuildContra(job);
        break;
      case "POST_BUILD_QG":
        await handlePostBuildQG(job);
        break;
      default:
        throw new Error(`Unknown job_type: ${job.job_type}`);
    }

    // Mark job done FIRST
    await sb.rpc("mark_job_done", { job_id: job.id });

    // Then handle cascade for post-build jobs
    if (job.job_type.startsWith("POST_BUILD_")) {
      await maybeEnqueueNextPostBuildStep(job, job.job_type);
    }

    return { ok: true, job_id: job.id, job_type: job.job_type, rag_id: job.rag_id, status: "DONE" };
  } catch (e) {
    const errMsg = e instanceof Error
      ? e.message
      : (typeof e === 'object' && e !== null
          ? JSON.stringify(e).slice(0, 500)
          : String(e));
    const errStack = e instanceof Error ? e.stack : "";
    console.error(`[${wid}] Job ${job.id} failed:`, errMsg);

    await sb.rpc("mark_job_retry", {
      job_id: job.id,
      err: { message: errMsg, stack: errStack?.slice(0, 2000) },
    });

    return {
      ok: false,
      job_id: job.id,
      job_type: job.job_type,
      rag_id: job.rag_id,
      status: "RETRY_OR_DLQ",
      error: errMsg,
    };
  }
}

// ──────── Drain mode: process multiple jobs per invocation ────────

async function drainJobs(maxJobs: number): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  for (let i = 0; i < maxJobs; i++) {
    const result = await runOneJob();
    results.push(result);
    if (result.message === "no_jobs") break;
  }
  return results;
}

/** Self-kick: check if there are remaining PENDING/RETRY jobs for this RAG and re-invoke */
async function selfKickIfNeeded(ragId: string | null, kickCount: number) {
  try {
    // Safety cap: max 50 self-kicks per invocation chain
    if (kickCount >= 50) {
      console.warn(`[self-kick] Safety cap reached (${kickCount} kicks) for rag_id=${ragId}. Stopping.`);
      return;
    }

    // Scoped query: only count jobs for this specific RAG
    let query = sb
      .from("rag_jobs")
      .select("*", { count: "exact", head: true })
      .in("status", ["PENDING", "RETRY"])
      .lte("run_after", new Date().toISOString());

    if (ragId) {
      query = query.eq("rag_id", ragId);
    }

    const { count } = await query;

    if (count && count > 0) {
      console.log(`[self-kick] ${count} jobs still pending for rag_id=${ragId}, kick #${kickCount + 1}`);
      const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
      EdgeRuntime.waitUntil(
        fetch(`${SUPABASE_URL}/functions/v1/rag-job-runner`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ maxJobs: 20, rag_id: ragId, kickCount: kickCount + 1 }),
        }).catch((e) => console.error("[self-kick] Error:", e))
      );
    } else {
      console.log(`[self-kick] Queue drained for rag_id=${ragId}, no more pending jobs`);
    }
  } catch (err) {
    console.error("[self-kick] Check failed:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let maxJobs = 20;
    let ragId: string | null = null;
    let kickCount = 0;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        maxJobs = Math.min(body.maxJobs ?? 20, 20);
        ragId = body.rag_id ?? null;
        kickCount = body.kickCount ?? 0;
      } catch {
        // no body, defaults apply
      }
    }

    const results = await drainJobs(maxJobs);

    // Extract ragId from processed jobs if not provided in body
    if (!ragId) {
      const processedJob = results.find((r) => r.rag_id);
      ragId = processedJob ? (processedJob.rag_id as string) : null;
    }

    // Self-kick if there are still pending jobs
    const anyProcessed = results.some((r) => r.job_id);
    if (anyProcessed) {
      EdgeRuntime.waitUntil(selfKickIfNeeded(ragId, kickCount));
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
