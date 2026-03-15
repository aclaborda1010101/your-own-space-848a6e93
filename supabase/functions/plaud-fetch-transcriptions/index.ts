import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ImapClient, fetchMessagesFromSender } from "jsr:@workingdevshero/deno-imap";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IMAP_TIMEOUT_MS = 25000;
const BATCH_SIZE = 5;

function decodeImapPart(value: unknown): string {
  try {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (value instanceof Uint8Array) return new TextDecoder("utf-8", { fatal: false }).decode(value);
    if (value instanceof ArrayBuffer) return new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(value));
    if (value instanceof Map) {
      return Array.from(value.values()).map((v) => decodeImapPart(v)).filter(Boolean).join("\n");
    }
    if (Array.isArray(value)) {
      return value.map((v) => decodeImapPart(v)).filter(Boolean).join("\n");
    }
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      return decodeImapPart(obj.content ?? obj.text ?? obj.html ?? obj.value ?? obj.raw ?? "");
    }
    return "";
  } catch {
    return "";
  }
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractBodyFromImapMessage(msg: any): string {
  const chunks: string[] = [];
  const add = (value: unknown) => {
    const text = decodeImapPart(value);
    if (text && text.trim().length > 0) chunks.push(text);
  };

  add(msg?.body);
  add(msg?.text);
  add(msg?.html);

  if (Array.isArray(msg?.parts)) {
    for (const part of msg.parts) {
      if (!part) continue;
      add(part.content ?? part.body ?? part.value);
    }
  }

  const bodyParts = msg?.bodyParts;
  if (bodyParts instanceof Map) {
    for (const value of bodyParts.values()) add(value);
  } else if (bodyParts && typeof bodyParts === "object") {
    for (const value of Object.values(bodyParts)) add(value);
  }

  add(msg?.source);

  const merged = chunks.join("\n").trim();
  if (!merged) return "";

  const looksHtml = /<\/?[a-z][\s\S]*>/i.test(merged);
  return (looksHtml ? htmlToPlainText(merged) : merged)
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractRecordingDate(subject: string): { date: string; title: string } {
  try {
    // Handle encoded subjects
    let decoded = subject;
    if (subject.includes("=?utf-8?")) {
      decoded = subject.replace(/=\?utf-8\?[qQbB]\?(.*?)\?=/g, (_, encoded) => {
        try {
          return encoded
            .replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) => String.fromCharCode(parseInt(hex, 16)))
            .replace(/_/g, " ");
        } catch { return encoded; }
      });
    }
    
    const match = decoded.match(/\[Plaud-AutoFlow\]\s*(\d{2})-(\d{2})\s*(.*)/i);
    if (match) {
      const month = match[1];
      const day = match[2];
      const year = new Date().getFullYear();
      const d = new Date(`${year}-${month}-${day}T00:00:00Z`);
      if (!isNaN(d.getTime())) {
        return { date: d.toISOString(), title: match[3].trim() || "Grabación Plaud" };
      }
    }
    
    // Try alternate format: [Plaud-AutoFlow] YYYY-MM-DD HH:MM:SS
    const match2 = decoded.match(/\[Plaud-AutoFlow\]\s*(\d{4}-\d{2}-\d{2})\s*(.*)/i);
    if (match2) {
      return { date: `${match2[1]}T00:00:00Z`, title: match2[2].trim() || "Grabación Plaud" };
    }

    return { date: new Date().toISOString(), title: decoded.replace(/\[Plaud-AutoFlow\]/gi, "").trim() || "Grabación Plaud" };
  } catch {
    return { date: new Date().toISOString(), title: "Grabación Plaud" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, mode } = await req.json();
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

    // 1. Get ALL Plaud emails from cache (with or without body)
    const { data: plaudEmails, error: fetchErr } = await supabase
      .from("jarvis_emails_cache")
      .select("message_id, subject, body_text, body_html, from_addr, synced_at")
      .eq("user_id", user_id)
      .or("from_addr.ilike.%plaud.ai%,subject.ilike.%Plaud-AutoFlow%")
      .order("synced_at", { ascending: false })
      .limit(100);

    if (fetchErr) {
      console.error("[plaud-fetch] Error fetching emails:", fetchErr.message);
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[plaud-fetch] Found ${plaudEmails?.length || 0} Plaud emails in cache`);

    if (!plaudEmails || plaudEmails.length === 0) {
      return new Response(JSON.stringify({ success: true, fetched: 0, message: "No Plaud emails found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get existing transcriptions to avoid duplicates (match by source_email_id)
    const { data: existingTranscriptions } = await supabase
      .from("plaud_transcriptions")
      .select("source_email_id")
      .eq("user_id", user_id);

    const existingIds = new Set((existingTranscriptions || []).map((t: any) => t.source_email_id));

    // 3. Separate: emails with body (can process directly) vs without body (need IMAP)
    const withBody = plaudEmails.filter((e: any) => {
      const text = (e.body_text || "").trim();
      const html = (e.body_html || "").trim();
      return text.length > 10 || html.length > 30;
    });
    const withoutBody = plaudEmails.filter((e: any) => {
      const text = (e.body_text || "").trim();
      const html = (e.body_html || "").trim();
      return text.length <= 10 && html.length <= 30;
    });
    
    console.log(`[plaud-fetch] ${withBody.length} with body, ${withoutBody.length} without body`);

    let transcriptionsCreated = 0;
    let bodiesFetched = 0;

    // 4. Process emails that already have body (direct creation)
    for (const email of withBody) {
      if (existingIds.has(email.message_id)) continue;
      if (transcriptionsCreated >= BATCH_SIZE) break;

      const { date: recordingDate, title } = extractRecordingDate(email.subject || "");
      const bodyContent = (email.body_text || "").trim().length > 10
        ? (email.body_text || "")
        : htmlToPlainText(email.body_html || "");
      const summarySnippet = bodyContent.substring(0, 500).replace(/\n+/g, " ").trim();

      const { error: insertErr } = await supabase
        .from("plaud_transcriptions")
        .insert({
          user_id,
          source_email_id: email.message_id,
          recording_date: recordingDate,
          title,
          transcript_raw: null,
          summary_structured: bodyContent.substring(0, 50000),
          participants: null,
          parsed_data: { summary_snippet: summarySnippet },
          ai_processed: false,
          processing_status: "pending_review",
          context_type: "professional",
        });

      if (!insertErr) {
        transcriptionsCreated++;
        existingIds.add(email.message_id);
      } else if (!insertErr.message?.includes("duplicate")) {
        console.error(`[plaud-fetch] Insert error: ${insertErr.message}`);
      }
    }

    // 5. For emails without body, try IMAP fetch
    if (withoutBody.length > 0 && transcriptionsCreated < BATCH_SIZE) {
      // Get IMAP account
      const { data: account } = await supabase
        .from("email_accounts")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_active", true)
        .ilike("email_address", "%hustleovertalks%")
        .limit(1)
        .maybeSingle();

      if (account?.credentials_encrypted?.password) {
        const host = account.imap_host || "imap.ionos.es";
        const port = account.imap_port || 993;
        console.log(`[plaud-fetch] Fetching bodies via IMAP ${host}:${port}...`);

        try {
          const client = new ImapClient({
            host, port, tls: true,
            username: account.email_address,
            password: account.credentials_encrypted.password,
          });

          await client.connect();
          
          // Search only Plaud sender emails with body parts to avoid CPU overuse
          const since = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
          const fetchResult = await Promise.race([
            fetchMessagesFromSender(client, "INBOX", "no-reply@plaud.ai", {
              bodyParts: ["TEXT", "1", "1.1", "2"],
            }),
            new Promise<any[]>((_, reject) =>
              setTimeout(() => reject(new Error("IMAP_TIMEOUT")), IMAP_TIMEOUT_MS)
            ),
          ]) as any[];

          await client.disconnect();

          const recentMessages = (fetchResult || []).filter((msg: any) => {
            const envDate = msg?.envelope?.date ? new Date(msg.envelope.date) : null;
            return envDate && !isNaN(envDate.getTime()) ? envDate >= since : true;
          });

          console.log(`[plaud-fetch] IMAP returned ${fetchResult?.length || 0} messages (${recentMessages.length} recent)`);

          // Build a map of cached subjects for matching
          const subjectMap = new Map<string, any>();
          for (const email of withoutBody) {
            // Normalize subject for matching
            let subj = (email.subject || "").toLowerCase().trim();
            // Remove encoding artifacts
            subj = subj.replace(/=\?utf-8\?[qQbB]\?.*?\?=/g, "").trim();
            if (subj) subjectMap.set(subj, email);
          }

          for (const msg of recentMessages) {
            if (transcriptionsCreated >= BATCH_SIZE) break;
            
            const envelope = msg.envelope;
            if (!envelope) continue;

            // Extract body text robustly (string/Uint8Array/Map/object)
            const bodyText = extractBodyFromImapMessage(msg);
            if (!bodyText || bodyText.length < 20) continue;

            // Try to match with a cached email by IMAP messageId or subject pattern
            const imapSubject = (envelope.subject || "").toLowerCase().trim();
            
            // Find the cached email to update
            let matchedCacheEmail: any = null;
            
            // Match by subject similarity
            for (const [cachedSubj, cachedEmail] of subjectMap.entries()) {
              if (existingIds.has(cachedEmail.message_id)) continue;
              // Check if subjects share key parts
              if (imapSubject.includes("plaud-autoflow") && cachedSubj.includes("plaud-autoflow")) {
                // Compare date parts
                const imapDateMatch = imapSubject.match(/(\d{2}-\d{2})/);
                const cachedDateMatch = cachedSubj.match(/(\d{2}-\d{2})/);
                if (imapDateMatch && cachedDateMatch && imapDateMatch[1] === cachedDateMatch[1]) {
                  matchedCacheEmail = cachedEmail;
                  break;
                }
              }
            }

            // If no match found, create transcription without cache link
            const emailId = matchedCacheEmail?.message_id || (envelope.messageId || `imap-${msg.seq}`);
            if (existingIds.has(emailId)) continue;

            // Update cache if matched
            if (matchedCacheEmail) {
              await supabase
                .from("jarvis_emails_cache")
                .update({
                  body_text: bodyText.substring(0, 50000),
                  body_html: "",
                })
                .eq("message_id", matchedCacheEmail.message_id)
                .eq("user_id", user_id);
              bodiesFetched++;
            }

            const { date: recordingDate, title } = extractRecordingDate(envelope.subject || "");
            const summarySnippet = bodyText.substring(0, 500).replace(/\n+/g, " ").trim();

            const { error: insertErr } = await supabase
              .from("plaud_transcriptions")
              .insert({
                user_id,
                source_email_id: emailId,
                recording_date: recordingDate,
                title,
                transcript_raw: null,
                summary_structured: bodyText.substring(0, 50000),
                participants: null,
                parsed_data: { summary_snippet: summarySnippet },
                ai_processed: false,
                processing_status: "pending_review",
                context_type: "professional",
              });

            if (!insertErr) {
              transcriptionsCreated++;
              existingIds.add(emailId);
            } else if (!insertErr.message?.includes("duplicate")) {
              console.error(`[plaud-fetch] Insert error: ${insertErr.message}`);
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unknown";
          console.error(`[plaud-fetch] IMAP error: ${msg}`);
          // Continue — we may have already created some from emails with body
        }
      } else {
        console.log("[plaud-fetch] No IMAP account for body fetch");
      }
    }

    const result = {
      success: true,
      total_plaud_emails: plaudEmails.length,
      with_body: withBody.length,
      without_body: withoutBody.length,
      transcriptions_created: transcriptionsCreated,
      bodies_fetched: bodiesFetched,
      already_processed: existingIds.size - transcriptionsCreated,
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
