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

async function handleFetch(job: Job) {
  const sourceId = job.source_id!;
  const { data: src, error } = await sb
    .from("rag_sources")
    .select("*")
    .eq("id", sourceId)
    .single();
  if (error) throw error;

  const url = src.source_url || src.url;
  if (!url) throw new Error("Source has no URL");

  const res = await fetch(url, {
    headers: { "User-Agent": "JarvisRAG/1.0" },
    signal: AbortSignal.timeout(15000),
  });

  const contentType = res.headers.get("content-type") ?? "";
  const httpStatus = res.status;

  if (httpStatus < 200 || httpStatus >= 300) {
    await sb
      .from("rag_sources")
      .update({
        http_status: httpStatus,
        content_type: contentType,
        status: "FAILED",
        error: { message: `HTTP ${httpStatus}` },
      })
      .eq("id", sourceId);
    return; // no enqueue
  }

  // For now we only handle text/html
  let rawText = "";
  if (contentType.includes("text") || contentType.includes("html") || contentType.includes("json")) {
    rawText = await res.text();
  } else {
    // PDF or binary: mark as FETCHED but with low extraction quality
    await sb
      .from("rag_sources")
      .update({
        http_status: httpStatus,
        content_type: contentType,
        status: "SKIPPED",
        extraction_quality: "none",
        error: { message: "Binary/PDF content not supported in job runner yet" },
      })
      .eq("id", sourceId);
    return;
  }

  await sb
    .from("rag_sources")
    .update({
      http_status: httpStatus,
      content_type: contentType,
      status: "FETCHED",
    })
    .eq("id", sourceId);

  // Enqueue EXTRACT with raw text in payload
  await sb.from("rag_jobs").insert({
    rag_id: job.rag_id,
    job_type: "EXTRACT",
    source_id: sourceId,
    payload: { rawText: rawText.slice(0, 500000) }, // cap payload size
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

  const chunks = cheapChunk(cleaned);

  await sb.from("rag_jobs").insert({
    rag_id: job.rag_id,
    job_type: "SCORE",
    source_id: sourceId,
    payload: { chunks },
  });

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
      default:
        throw new Error(`Unknown job_type: ${job.job_type}`);
    }

    await sb.rpc("mark_job_done", { job_id: job.id });
    return { ok: true, job_id: job.id, job_type: job.job_type, status: "DONE" };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let maxJobs = 1;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        maxJobs = Math.min(body.maxJobs ?? 1, 20);
      } catch {
        // no body, default to 1
      }
    }

    const results = await drainJobs(maxJobs);
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
