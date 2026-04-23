// JARVIS History Ingest
// Modes:
//  - single: process one specific source row (called by webhooks)
//  - backfill: pull N pending rows of given source_type and process

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// ─────────────────────────────────────────────────────────
// Embedding (OpenAI text-embedding-3-small @ 1024 dims)
// ─────────────────────────────────────────────────────────
async function embed(text: string): Promise<number[] | null> {
  const truncated = text.slice(0, 32000);
  if (!truncated.trim()) return null;
  try {
    const r = await fetch("https://api.openai.com/v1/embeddings", {
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
    if (!r.ok) {
      console.warn("[ingest] embed failed:", r.status, await r.text());
      return null;
    }
    const j = await r.json();
    return j.data?.[0]?.embedding ?? null;
  } catch (e) {
    console.warn("[ingest] embed exception:", e);
    return null;
  }
}

// ─────────────────────────────────────────────────────────
// Topic & summary extraction (Lovable AI Gateway / gemini-flash)
// One call per chunk, JSON-only
// ─────────────────────────────────────────────────────────
async function extractMeta(content: string): Promise<{ summary: string; topics: string[]; importance: number }> {
  const fallback = {
    summary: content.slice(0, 200),
    topics: [],
    importance: 5,
  };
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Extract metadata from text. Reply ONLY JSON: {\"summary\":\"1-2 sentences max 200 chars\",\"topics\":[\"tag1\",\"tag2\"],\"importance\":1-10}. Topics in lowercase Spanish, max 5. Importance: 1=trivial, 5=normal, 8=important, 10=critical.",
          },
          { role: "user", content: content.slice(0, 4000) },
        ],
        temperature: 0.3,
      }),
    });
    if (!r.ok) return fallback;
    const j = await r.json();
    const raw = j.choices?.[0]?.message?.content?.trim() ?? "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      summary: String(parsed.summary || fallback.summary).slice(0, 300),
      topics: Array.isArray(parsed.topics) ? parsed.topics.map(String).slice(0, 5) : [],
      importance: Math.min(10, Math.max(1, Number(parsed.importance) || 5)),
    };
  } catch {
    return fallback;
  }
}

function fastMeta(content: string, sourceType: string, metadata?: Record<string, unknown>): { summary: string; topics: string[]; importance: number } {
  const topics: string[] = [];
  if (sourceType === "whatsapp") {
    topics.push("whatsapp");
    // Tag agustito messages distinctly for filtering
    const src = String(metadata?.source || "");
    if (src === "whatsapp_agustito") topics.push("agustito");
  } else if (sourceType === "email") {
    topics.push("email");
  } else if (sourceType === "plaud") {
    topics.push("plaud", "transcripcion");
  } else if (sourceType === "transcription") {
    topics.push("transcripcion");
  }
  return {
    summary: content.slice(0, 220),
    topics,
    importance: 5,
  };
}

// ─────────────────────────────────────────────────────────
// Chunking — token-approx ≈ 4 chars
// ─────────────────────────────────────────────────────────
function chunkText(text: string, targetChars = 3500, overlapChars = 400): string[] {
  const t = (text || "").trim();
  if (!t) return [];
  if (t.length <= targetChars) return [t];

  const chunks: string[] = [];
  let i = 0;
  while (i < t.length) {
    const end = Math.min(i + targetChars, t.length);
    let slice = t.slice(i, end);
    // try to break on sentence
    if (end < t.length) {
      const lastPeriod = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("\n"));
      if (lastPeriod > targetChars * 0.5) slice = slice.slice(0, lastPeriod + 1);
    }
    chunks.push(slice.trim());
    i += slice.length - overlapChars;
    if (i <= 0) i = end;
  }
  return chunks.filter(Boolean);
}

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toPgVector(embedding: number[] | null): string | null {
  return embedding && embedding.length > 0 ? `[${embedding.join(",")}]` : null;
}

// ─────────────────────────────────────────────────────────
// Source loaders — given source_table + source_id, returns content + metadata
// ─────────────────────────────────────────────────────────
interface LoadedSource {
  content: string;
  occurred_at: string;
  people: string[];
  metadata: Record<string, unknown>;
  user_id: string;
}

async function loadSource(
  source_table: string,
  source_id: string,
  user_id_hint?: string,
): Promise<LoadedSource | null> {
  switch (source_table) {
    case "contact_messages": {
      const { data: msg, error: msgErr } = await sb
        .from("contact_messages")
        .select("id, contact_id, content, message_date, source, sender, chat_name, external_id, user_id")
        .eq("id", source_id)
        .maybeSingle();
      if (msgErr) { console.warn("[ingest] contact_messages load error:", msgErr.message, "id=", source_id); return null; }
      if (!msg) { console.warn("[ingest] contact_messages not found id=", source_id); return null; }
      if (!msg.content || !String(msg.content).trim()) { console.warn("[ingest] contact_messages empty content id=", source_id); return null; }
      let contactName = msg.chat_name || msg.sender || "contacto";
      let contactId: string | null = msg.contact_id ?? null;
      let resolvedUserId: string | null = msg.user_id ?? null;
      if (contactId) {
        const { data: contact } = await sb
          .from("people_contacts")
          .select("id, name, user_id")
          .eq("id", contactId)
          .maybeSingle();
        if (contact) {
          contactName = contact.name || contactName;
          resolvedUserId = resolvedUserId || contact.user_id;
        }
      }
      if (!resolvedUserId) { console.warn("[ingest] contact_messages no user_id resolvable id=", source_id); return null; }
      const dirArrow = msg.sender === "me" || msg.sender === "out" ? "→" : "←";
      const sourceLabel = msg.source === "whatsapp_agustito" ? "WhatsApp Agustito" : "WhatsApp";
      return {
        content: `[${sourceLabel} ${dirArrow} ${contactName}] ${msg.content}`,
        occurred_at: msg.message_date || new Date().toISOString(),
        people: contactId ? [contactId] : [],
        metadata: { contact_name: contactName, source: msg.source, sender: msg.sender, external_id: msg.external_id },
        user_id: resolvedUserId,
      };
    }
    case "jarvis_emails_cache": {
      const { data: email } = await sb
        .from("jarvis_emails_cache")
        .select("id, user_id, from_addr, to_addrs, subject, body_text, preview, synced_at, received_at")
        .eq("id", source_id)
        .single();
      if (!email) return null;
      const body = email.body_text || email.preview || "";
      if (!body.trim()) return null;
      return {
        content: `[Email de ${email.from_addr}] ${email.subject || "(sin asunto)"}\n\n${body}`,
        occurred_at: email.received_at || email.synced_at || new Date().toISOString(),
        people: [],
        metadata: { from: email.from_addr, to: email.to_addrs, subject: email.subject },
        user_id: email.user_id,
      };
    }
    case "transcriptions": {
      const { data: t } = await sb
        .from("transcriptions")
        .select("id, user_id, transcription_text, summary, brain, created_at, recorded_at")
        .eq("id", source_id)
        .single();
      if (!t || !t.transcription_text) return null;
      return {
        content: `[Transcripción${t.brain ? " " + t.brain : ""}] ${t.summary ? t.summary + "\n\n" : ""}${t.transcription_text}`,
        occurred_at: t.recorded_at || t.created_at || new Date().toISOString(),
        people: [],
        metadata: { brain: t.brain, summary: t.summary },
        user_id: t.user_id,
      };
    }
    case "plaud_transcriptions": {
      const { data: t } = await sb
        .from("plaud_transcriptions")
        .select("id, user_id, transcription, summary, title, created_at, recorded_at")
        .eq("id", source_id)
        .single();
      if (!t || !t.transcription) return null;
      return {
        content: `[Plaud${t.title ? ": " + t.title : ""}] ${t.summary ? t.summary + "\n\n" : ""}${t.transcription}`,
        occurred_at: t.recorded_at || t.created_at || new Date().toISOString(),
        people: [],
        metadata: { title: t.title, summary: t.summary },
        user_id: t.user_id,
      };
    }
    case "potus_chat": {
      const { data: m } = await sb
        .from("potus_chat")
        .select("id, user_id, message, role, platform, created_at")
        .eq("id", source_id)
        .single();
      if (!m || !m.message) return null;
      return {
        content: `[Chat ${m.platform || "web"} ${m.role}] ${m.message}`,
        occurred_at: m.created_at || new Date().toISOString(),
        people: [],
        metadata: { role: m.role, platform: m.platform },
        user_id: m.user_id,
      };
    }
    case "project_wizard_steps": {
      const { data: step } = await sb
        .from("project_wizard_steps")
        .select("id, project_id, step_number, step_name, output_data, user_id, created_at, updated_at")
        .eq("id", source_id)
        .single();
      if (!step || !step.output_data) return null;
      // Look up project name for context
      let projectName = "proyecto";
      try {
        const { data: proj } = await sb
          .from("business_projects")
          .select("name")
          .eq("id", step.project_id)
          .maybeSingle();
        if (proj?.name) projectName = proj.name;
      } catch (_e) { /* ignore */ }
      // Stringify output_data — already structured (PRD/scope/audit/etc)
      // Truncate aggressively: wizard step payloads can be 100KB+ and OOM the worker
      let body = "";
      try {
        body = typeof step.output_data === "string"
          ? step.output_data
          : JSON.stringify(step.output_data, null, 2);
      } catch {
        body = String(step.output_data);
      }
      if (!body.trim()) return null;
      // Hard cap at 60KB to prevent worker resource exhaustion during chunking
      if (body.length > 60000) {
        body = body.slice(0, 60000) + "\n\n[...truncado para indexación]";
      }
      return {
        content: `[Proyecto ${projectName} · Paso ${step.step_number} ${step.step_name || ""}]\n\n${body}`,
        occurred_at: step.updated_at || step.created_at || new Date().toISOString(),
        people: [],
        metadata: { project_id: step.project_id, project_name: projectName, step_number: step.step_number, step_name: step.step_name },
        user_id: step.user_id,
      };
    }
    case "business_project_timeline": {
      const { data: ev } = await sb
        .from("business_project_timeline")
        .select("id, project_id, user_id, title, description, channel, contact_id, event_date, created_at")
        .eq("id", source_id)
        .single();
      if (!ev) return null;
      const body = `${ev.title || ""}\n${ev.description || ""}`.trim();
      if (!body) return null;
      let projectName = "proyecto";
      try {
        const { data: proj } = await sb
          .from("business_projects")
          .select("name")
          .eq("id", ev.project_id)
          .maybeSingle();
        if (proj?.name) projectName = proj.name;
      } catch (_e) { /* ignore */ }
      return {
        content: `[Timeline ${projectName}${ev.channel ? " · " + ev.channel : ""}] ${body}`,
        occurred_at: ev.event_date || ev.created_at || new Date().toISOString(),
        people: ev.contact_id ? [ev.contact_id] : [],
        metadata: { project_id: ev.project_id, project_name: projectName, channel: ev.channel, title: ev.title },
        user_id: ev.user_id,
      };
    }
    case "people_contacts": {
      const { data: c } = await sb
        .from("people_contacts")
        .select("id, user_id, name, context, role, company, updated_at, created_at")
        .eq("id", source_id)
        .single();
      if (!c || !c.context || !c.context.trim()) return null;
      return {
        content: `[Nota de contacto · ${c.name}${c.role ? " (" + c.role + ")" : ""}${c.company ? " — " + c.company : ""}]\n${c.context}`,
        occurred_at: c.updated_at || c.created_at || new Date().toISOString(),
        people: [c.id],
        metadata: { contact_name: c.name, role: c.role, company: c.company },
        user_id: c.user_id,
      };
    }
    default:
      console.warn("[ingest] unknown source_table:", source_table);
      return null;
  }
}

// ─────────────────────────────────────────────────────────
// Ingest one source row → produce N chunks
// ─────────────────────────────────────────────────────────
async function ingestOne(params: {
  user_id: string;
  source_type: string;
  source_id: string;
  source_table: string;
  fast_meta?: boolean;
}): Promise<{ inserted: number; skipped: number; reason?: string; chunks?: number; debug?: Record<string, unknown> }> {
  const loaded = await loadSource(params.source_table, params.source_id, params.user_id);
  if (!loaded) return { inserted: 0, skipped: 1, reason: "loadSource_returned_null" };

  const userId = loaded.user_id || params.user_id;
  if (!userId) return { inserted: 0, skipped: 1, reason: "no_user_id" };

  const chunks = chunkText(loaded.content);
  if (chunks.length === 0) return { inserted: 0, skipped: 1, reason: "empty_chunks" };

  let inserted = 0;
  let skipped = 0;
  const total = chunks.length;
  let lastError: string | null = null;

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunkContent = chunks[idx];
    const hash = await sha256(`${userId}:${params.source_table}:${params.source_id}:${idx}:${chunkContent.slice(0, 100)}`);

    // Check existing
    const { data: existing } = await sb
      .from("jarvis_history_chunks")
      .select("id")
      .eq("user_id", userId)
      .eq("content_hash", hash)
      .maybeSingle();
    if (existing) { skipped++; continue; }

    // Embed + extract meta in parallel
    const [embedding, meta] = await Promise.all([
      embed(chunkContent),
      params.fast_meta ? Promise.resolve(fastMeta(chunkContent, params.source_type, loaded.metadata)) : extractMeta(chunkContent),
    ]);

    // Importance boost by source
    let importance = meta.importance;
    if (loaded.people.length > 0) importance = Math.min(10, importance + 1);
    if (params.source_type === "transcription" || params.source_type === "plaud") {
      importance = Math.min(10, importance + 1);
    }

    const { error } = await sb.from("jarvis_history_chunks").insert({
      user_id: userId,
      source_type: params.source_type,
      source_id: params.source_id,
      source_table: params.source_table,
      content: chunkContent,
      content_summary: meta.summary,
      content_hash: hash,
      chunk_index: idx,
      total_chunks: total,
      embedding: toPgVector(embedding),
      occurred_at: loaded.occurred_at,
      people: loaded.people,
      topics: meta.topics,
      importance,
      metadata: loaded.metadata,
    });

    if (error) {
      console.warn("[ingest] insert failed:", error.message);
      lastError = error.message;
      skipped++;
    } else {
      inserted++;
    }

    // Rate limit
    if (!params.fast_meta) await new Promise((r) => setTimeout(r, 200));
  }

  return {
    inserted,
    skipped,
    chunks: total,
    reason: inserted === 0 ? (lastError ? "insert_failed" : "all_chunks_existed_or_failed") : undefined,
    debug: lastError ? { last_error: lastError, source_id: params.source_id, source_table: params.source_table } : undefined,
  };
}

// ─────────────────────────────────────────────────────────
// Backfill mode: pull rows of given source_type that have no chunks yet
// ─────────────────────────────────────────────────────────
async function backfill(source_type: string, user_id: string, batch_size: number, days: number, fast_meta = false) {
  const fromDate = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  let candidates: Array<{ id: string; source_table: string }> = [];

  if (source_type === "whatsapp") {
    const { data } = await sb
      .from("contact_messages")
      .select("id, message_date, user_id")
      .eq("user_id", user_id)
      .gte("message_date", fromDate)
      .order("message_date", { ascending: false })
      .limit(Math.min(batch_size * 20, 2000));
    candidates = (data || []).map((r: any) => ({ id: r.id, source_table: "contact_messages" }));
  } else if (source_type === "email") {
    const { data } = await sb
      .from("jarvis_emails_cache")
      .select("id, received_at, synced_at")
      .eq("user_id", user_id)
      .gte("synced_at", fromDate)
      .order("synced_at", { ascending: false })
      .limit(batch_size * 3);
    candidates = (data || []).map((r: any) => ({ id: r.id, source_table: "jarvis_emails_cache" }));
  } else if (source_type === "transcription") {
    const { data } = await sb
      .from("transcriptions")
      .select("id, created_at")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(batch_size * 3);
    candidates = (data || []).map((r: any) => ({ id: r.id, source_table: "transcriptions" }));
  } else if (source_type === "plaud") {
    const { data } = await sb
      .from("plaud_transcriptions")
      .select("id, created_at")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(batch_size * 3);
    candidates = (data || []).map((r: any) => ({ id: r.id, source_table: "plaud_transcriptions" }));
  } else if (source_type === "project") {
    const { data } = await sb
      .from("project_wizard_steps")
      .select("id, updated_at, user_id")
      .eq("user_id", user_id)
      .not("output_data", "is", null)
      .order("updated_at", { ascending: false })
      .limit(batch_size * 3);
    candidates = (data || []).map((r: any) => ({ id: r.id, source_table: "project_wizard_steps" }));
  } else if (source_type === "contact_note") {
    const { data } = await sb
      .from("people_contacts")
      .select("id, updated_at")
      .eq("user_id", user_id)
      .not("context", "is", null)
      .order("updated_at", { ascending: false })
      .limit(batch_size * 3);
    candidates = (data || []).map((r: any) => ({ id: r.id, source_table: "people_contacts" }));
  }

  // Filter out already-ingested
  const ids = candidates.map((c) => c.id);
  if (ids.length === 0) return { processed: 0, inserted: 0 };

  const { data: existing } = await sb
    .from("jarvis_history_chunks")
    .select("source_id")
    .eq("user_id", user_id)
    .in("source_id", ids);
  const done = new Set((existing || []).map((e: any) => e.source_id));

  const todo = candidates.filter((c) => !done.has(c.id)).slice(0, batch_size);

  let totalInserted = 0;
  let totalSkipped = 0;
  const concurrency = source_type === "whatsapp" ? 8 : source_type === "project" ? 1 : 3;
  for (let i = 0; i < todo.length; i += concurrency) {
    const results = await Promise.all(todo.slice(i, i + concurrency).map((c) => ingestOne({
      user_id,
      source_type,
      source_id: c.id,
      source_table: c.source_table,
      fast_meta,
    })));
    for (const r of results) {
      totalInserted += r.inserted;
      totalSkipped += r.skipped;
    }
  }

  return { processed: todo.length, inserted: totalInserted, skipped: totalSkipped, candidates: candidates.length, already_done: done.size };
}

// ─────────────────────────────────────────────────────────
// HTTP handler
// ─────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const mode = body.mode || "single";

    if (mode === "single") {
      const { user_id, source_type, source_id, source_table } = body;
      if (!user_id || !source_type || !source_id || !source_table) {
        return new Response(
          JSON.stringify({ error: "Missing user_id, source_type, source_id, source_table" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const r = await ingestOne({ user_id, source_type, source_id, source_table });
      return new Response(JSON.stringify({ success: true, ...r }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "backfill") {
      const { user_id, source_type, batch_size = 50, days = 90, fast_meta = source_type === "whatsapp" } = body;
      if (!user_id || !source_type) {
        return new Response(
          JSON.stringify({ error: "Missing user_id or source_type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const r = await backfill(source_type, user_id, batch_size, days, Boolean(fast_meta));
      return new Response(JSON.stringify({ success: true, ...r }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "queue") {
      // Process pending jobs from jarvis_ingestion_jobs
      const { batch_size = 20 } = body;
      const { data: jobs } = await sb.rpc("pick_jarvis_ingestion_job", {
        p_worker_id: `ingest-${crypto.randomUUID().slice(0, 8)}`,
        p_batch_size: batch_size,
      });

      let processed = 0;
      let inserted = 0;
      for (const job of jobs || []) {
        try {
          const r = await ingestOne({
            user_id: job.user_id,
            source_type: job.source_type,
            source_id: job.source_id,
            source_table: job.source_table,
          });
          inserted += r.inserted;
          processed++;
          await sb
            .from("jarvis_ingestion_jobs")
            .update({ status: "done", completed_at: new Date().toISOString() })
            .eq("id", job.id);
        } catch (e: any) {
          await sb
            .from("jarvis_ingestion_jobs")
            .update({ status: "error", error: String(e?.message || e) })
            .eq("id", job.id);
        }
      }

      return new Response(JSON.stringify({ success: true, processed, inserted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown mode" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[ingest] fatal:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
