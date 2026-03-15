import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ImapClient, fetchMessagesSince } from "jsr:@workingdevshero/deno-imap";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IMAP_TIMEOUT_MS = 25000;
const BATCH_SIZE = 5;

function sanitizeImapDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const parsed = new Date(cleaned);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function formatImapDate(d: Date): string {
  if (!(d instanceof Date) || isNaN(d.getTime())) d = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

function extractRecordingDate(subject: string): { date: string; title: string } {
  try {
    const match = subject.match(/\[Plaud-AutoFlow\]\s*(\d{2})-(\d{2})\s*(.*)/i);
    if (match) {
      const month = match[1];
      const day = match[2];
      const year = new Date().getFullYear();
      const d = new Date(`${year}-${month}-${day}T00:00:00Z`);
      if (!isNaN(d.getTime())) {
        return { date: d.toISOString(), title: match[3].trim() || "Grabación Plaud" };
      }
    }
  } catch { /* fallback */ }
  return { date: new Date().toISOString(), title: subject.replace(/\[Plaud-AutoFlow\]/gi, "").trim() || "Grabación Plaud" };
}

function extractTextFromParts(parts: any[]): { text: string; html: string; attachments: any[] } {
  let text = "";
  let html = "";
  const attachments: any[] = [];

  for (const part of parts) {
    if (!part) continue;
    const ct = (part.contentType || part.type || "").toLowerCase();
    const disposition = (part.disposition || "").toLowerCase();
    const filename = part.filename || part.name || "";

    if (disposition === "attachment" || filename) {
      attachments.push({
        filename: filename || "unnamed",
        contentType: ct,
        size: part.size || (part.content ? part.content.length : 0),
        content: typeof part.content === "string" ? part.content : null,
      });
      continue;
    }

    if (ct.includes("text/plain") && part.content) {
      text += (typeof part.content === "string" ? part.content : new TextDecoder().decode(part.content));
    } else if (ct.includes("text/html") && part.content) {
      html += (typeof part.content === "string" ? part.content : new TextDecoder().decode(part.content));
    }

    if (part.parts && Array.isArray(part.parts)) {
      const nested = extractTextFromParts(part.parts);
      text += nested.text;
      html += nested.html;
      attachments.push(...nested.attachments);
    }
  }

  return { text, html, attachments };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[plaud-fetch] Starting for user ${user_id.substring(0, 8)}...`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get IMAP account for hustleovertalks
    const { data: account, error: accErr } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("user_id", user_id)
      .eq("is_active", true)
      .ilike("email_address", "%hustleovertalks%")
      .limit(1)
      .maybeSingle();

    if (accErr || !account) {
      console.error("[plaud-fetch] No IMAP account found:", accErr?.message);
      return new Response(JSON.stringify({ error: "No email account found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const creds = account.credentials_encrypted;
    if (!creds?.password) {
      return new Response(JSON.stringify({ error: "No IMAP password" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get existing plaud emails without body
    const { data: cachedEmails } = await supabase
      .from("jarvis_emails_cache")
      .select("message_id, subject")
      .eq("user_id", user_id)
      .or("from_addr.ilike.%plaud.ai%,subject.ilike.%Plaud-AutoFlow%")
      .is("body_text", null)
      .limit(50);

    const pendingIds = new Set((cachedEmails || []).map((e: any) => e.message_id));
    console.log(`[plaud-fetch] Found ${pendingIds.size} Plaud emails without body`);

    if (pendingIds.size === 0) {
      // Check if there are already-processed ones
      const { count } = await supabase
        .from("plaud_transcriptions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user_id);

      return new Response(JSON.stringify({ 
        success: true, fetched: 0, processed: 0,
        message: `No hay emails Plaud pendientes. ${count || 0} transcripciones ya procesadas.`
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Connect IMAP and fetch bodies
    const host = account.imap_host || "imap.ionos.es";
    const port = account.imap_port || 993;
    console.log(`[plaud-fetch] Connecting IMAP ${host}:${port}...`);

    const client = new ImapClient({
      host, port, tls: true,
      username: account.email_address,
      password: creds.password,
    });

    let fetchResult: any[] = [];
    try {
      await client.connect();
      // Search from 6 months ago to cover all 32 emails
      const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
      
      fetchResult = await Promise.race([
        fetchMessagesSince(client, "INBOX", since, {
          fromFilter: "no-reply@plaud.ai",
          bodyParts: true, // Fetch full body + attachments
        }),
        new Promise<any[]>((_, reject) => 
          setTimeout(() => reject(new Error("IMAP_TIMEOUT")), IMAP_TIMEOUT_MS)
        ),
      ]) as any[];
    } catch (e) {
      if (e instanceof Error && e.message === "IMAP_TIMEOUT") {
        console.warn("[plaud-fetch] IMAP timeout");
        try { await client.disconnect(); } catch { /* ignore */ }
        return new Response(JSON.stringify({ error: "IMAP timeout. Try again." }), {
          status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }

    await client.disconnect();
    console.log(`[plaud-fetch] IMAP returned ${fetchResult?.length || 0} messages`);

    // 4. Process each message
    let fetched = 0;
    let transcriptionsCreated = 0;

    for (const msg of (fetchResult || [])) {
      if (fetched >= BATCH_SIZE) break;

      try {
        const envelope = msg.envelope;
        const messageId = envelope?.messageId || String(msg.seq);

        // Only process if it's in our pending set
        if (!pendingIds.has(messageId)) continue;

        // Extract body and attachments
        let bodyText = "";
        let bodyHtml = "";
        let attachmentsMeta: any[] = [];
        let transcriptRaw: string | null = null;

        if (msg.body) {
          bodyText = typeof msg.body === "string" ? msg.body : "";
        }

        if (msg.parts && Array.isArray(msg.parts)) {
          const extracted = extractTextFromParts(msg.parts);
          bodyText = bodyText || extracted.text;
          bodyHtml = extracted.html;
          
          for (const att of extracted.attachments) {
            attachmentsMeta.push({
              filename: att.filename,
              contentType: att.contentType,
              size: att.size,
            });
            // If it's a text attachment, use it as transcript
            if (att.content && (att.filename.match(/\.(txt|md)$/i) || att.contentType.includes("text/"))) {
              transcriptRaw = (transcriptRaw || "") + att.content;
            }
          }
        }

        // If body is in bodyStructure parts
        if (!bodyText && msg.bodyParts) {
          for (const [key, val] of Object.entries(msg.bodyParts)) {
            if (typeof val === "string") bodyText += val;
          }
        }

        const subject = envelope?.subject || "";
        const { date: recordingDate, title } = extractRecordingDate(subject);

        // 4a. Update email cache with body
        await supabase
          .from("jarvis_emails_cache")
          .update({
            body_text: bodyText.substring(0, 50000),
            body_html: bodyHtml.substring(0, 50000),
            has_attachments: attachmentsMeta.length > 0,
            attachments_meta: attachmentsMeta,
          })
          .eq("message_id", messageId)
          .eq("user_id", user_id);

        // 4b. Create plaud_transcription with pending_review status
        const summarySnippet = bodyText.substring(0, 500).replace(/\n+/g, " ").trim();

        const { error: insertErr } = await supabase
          .from("plaud_transcriptions")
          .insert({
            user_id,
            source_email_id: messageId,
            recording_date: recordingDate,
            title,
            transcript_raw: transcriptRaw,
            summary_structured: bodyText.substring(0, 50000),
            participants: null,
            parsed_data: { summary_snippet: summarySnippet },
            ai_processed: false,
            processing_status: "pending_review",
            context_type: "professional", // default, user will classify
          });

        if (insertErr) {
          // Might be duplicate - skip
          if (insertErr.message?.includes("duplicate") || insertErr.code === "23505") {
            console.log(`[plaud-fetch] Skipping duplicate: ${messageId}`);
          } else {
            console.error(`[plaud-fetch] Insert error: ${insertErr.message}`);
          }
        } else {
          transcriptionsCreated++;
        }

        fetched++;
      } catch (e) {
        console.error("[plaud-fetch] Error processing message:", e);
      }
    }

    const result = {
      success: true,
      fetched,
      transcriptions_created: transcriptionsCreated,
      remaining: Math.max(0, pendingIds.size - fetched),
    };

    console.log(`[plaud-fetch] Done: ${JSON.stringify(result)}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[plaud-fetch] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
