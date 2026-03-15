import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ImapClient, fetchMessagesWithSubject } from "jsr:@workingdevshero/deno-imap";

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

function decodeQEncoding(raw: string): string {
  if (!raw.includes("=?")) return raw;
  // Join consecutive encoded words (they may be split across lines with spaces between)
  const joined = raw.replace(/\?=\s+=\?utf-8\?/gi, "?==?utf-8?");
  return joined.replace(/=\?utf-8\?([qQbB])\?([\s\S]*?)\?=/gi, (_, encoding, payload) => {
    try {
      if (encoding.toLowerCase() === "b") {
        const bytes = Uint8Array.from(atob(payload), c => c.charCodeAt(0));
        return new TextDecoder("utf-8").decode(bytes);
      }
      // Q-encoding
      const bytes: number[] = [];
      for (let i = 0; i < payload.length; i++) {
        if (payload[i] === "=" && i + 2 < payload.length) {
          bytes.push(parseInt(payload.substring(i + 1, i + 3), 16));
          i += 2;
        } else if (payload[i] === "_") {
          bytes.push(32);
        } else {
          bytes.push(payload.charCodeAt(i));
        }
      }
      return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
    } catch { return payload; }
  }).replace(/\s{2,}/g, " ").trim();
}

function extractRecordingDate(subject: string): { date: string; title: string } {
  try {
    const decoded = decodeQEncoding(subject);

    // Format: [Plaud-AutoFlow] MM-DD Title...
    const match = decoded.match(/\[Plaud-AutoFlow\]\s*(\d{2})-(\d{2})\s+(.*)/i);
    if (match) {
      const month = match[1];
      const day = match[2];
      const year = new Date().getFullYear();
      const d = new Date(`${year}-${month}-${day}T00:00:00Z`);
      if (!isNaN(d.getTime())) {
        return { date: d.toISOString(), title: match[3].trim() || "Grabación Plaud" };
      }
    }
    
    // Format: [Plaud-AutoFlow] YYYY-MM-DD HH:MM:SS (optionally followed by title)
    const match2 = decoded.match(/\[Plaud-AutoFlow\]\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})?\s*(.*)?/i);
    if (match2) {
      const dateStr = match2[1];
      const time = match2[2] || "";
      const titlePart = (match2[3] || "").trim();
      const displayTitle = titlePart || `Grabación ${time}`;
      return { date: `${dateStr}T${time || "00:00:00"}Z`, title: displayTitle };
    }

    return { date: new Date().toISOString(), title: decoded.replace(/\[Plaud-AutoFlow\]/gi, "").trim() || "Grabación Plaud" };
  } catch {
    return { date: new Date().toISOString(), title: "Grabación Plaud" };
  }
}

function estimateDurationMinutes(bodyText: string): number | null {
  if (!bodyText || bodyText.length < 30) return null;
  // Look for explicit duration mentions like "Duración: 45 min" or "Duration: 1h 20m"
  const durationMatch = bodyText.match(/(?:duraci[oó]n|duration|length)[:\s]+(\d+)\s*(?:min|m\b|minutes)/i);
  if (durationMatch) return parseInt(durationMatch[1]);
  const durationHM = bodyText.match(/(?:duraci[oó]n|duration)[:\s]+(\d+)\s*(?:h|hour)[\s,]*(\d+)?\s*(?:min|m)?/i);
  if (durationHM) return parseInt(durationHM[1]) * 60 + (parseInt(durationHM[2] || "0"));
  // Estimate from word count (~150 words/min spoken)
  const wordCount = bodyText.split(/\s+/).length;
  if (wordCount > 100) return Math.round(wordCount / 150);
  return null;
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

    console.log(`[plaud-fetch] Starting for user ${user_id.substring(0, 8)}... mode=${mode || "default"}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fix existing titles by re-parsing from source email subjects
    if (mode === "fix_titles") {
      const { data: existing } = await supabase
        .from("plaud_transcriptions")
        .select("id, source_email_id, title")
        .eq("user_id", user_id);

      if (existing && existing.length > 0) {
        const emailIds = existing.map((t: any) => t.source_email_id).filter(Boolean);
        const { data: emails } = await supabase
          .from("jarvis_emails_cache")
          .select("message_id, subject")
          .in("message_id", emailIds);

        const emailMap = new Map((emails || []).map((e: any) => [e.message_id, e.subject]));
        let fixed = 0;
        for (const t of existing) {
          const subject = emailMap.get(t.source_email_id);
          if (!subject) continue;
          const { title } = extractRecordingDate(subject);
          if (title !== t.title) {
            await supabase.from("plaud_transcriptions").update({ title }).eq("id", t.id);
            fixed++;
          }
        }
        return new Response(JSON.stringify({ success: true, fixed }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, fixed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


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
      const duration = estimateDurationMinutes(bodyContent);

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
          duration_minutes: duration,
        });

      if (!insertErr) {
        transcriptionsCreated++;
        existingIds.add(email.message_id);
      } else if (!insertErr.message?.includes("duplicate")) {
        console.error(`[plaud-fetch] Insert error: ${insertErr.message}`);
      }
    }

    // 5. For emails without body, try IMAP fetch
    if (withoutBody.length > 0 && transcriptionsCreated < BATCH_SIZE && mode === "force_imap") {
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
          
          const plaudCandidates = withoutBody.filter((e: any) => !existingIds.has(e.message_id));
          console.log(`[plaud-fetch] IMAP targeted fetch for ${plaudCandidates.length} Plaud emails`);

          for (const cachedEmail of plaudCandidates) {
            if (transcriptionsCreated >= BATCH_SIZE) break;

            const rawSubject = (cachedEmail.subject || "").trim();
            if (!rawSubject) continue;

            const queryToken = (() => {
              const fullTs = rawSubject.match(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/)?.[0];
              if (fullTs) return fullTs;
              const dateToken = rawSubject.match(/\d{2}-\d{2}/)?.[0];
              if (dateToken) return dateToken;
              return "Plaud-AutoFlow";
            })();

            const matchResult = await Promise.race([
              fetchMessagesWithSubject(client, "INBOX", queryToken, {
                bodyParts: ["TEXT", "1", "1.1", "2"],
              }),
              new Promise<any[]>((_, reject) =>
                setTimeout(() => reject(new Error("IMAP_TIMEOUT")), Math.min(IMAP_TIMEOUT_MS, 8000))
              ),
            ]) as any[];

            if (!matchResult || matchResult.length === 0) continue;

            const bestMatch = matchResult.find((m: any) => {
              const s = (m?.envelope?.subject || "").toLowerCase();
              const target = rawSubject.toLowerCase();
              return s.includes("plaud-autoflow") && (s.includes(queryToken.toLowerCase()) || target.includes(queryToken.toLowerCase()));
            }) || matchResult[0];

            const bodyText = extractBodyFromImapMessage(bestMatch);
            if (!bodyText || bodyText.length < 20) continue;

            await supabase
              .from("jarvis_emails_cache")
              .update({
                body_text: bodyText.substring(0, 50000),
                body_html: "",
              })
              .eq("message_id", cachedEmail.message_id)
              .eq("user_id", user_id);
            bodiesFetched++;

            const { date: recordingDate, title } = extractRecordingDate(cachedEmail.subject || bestMatch?.envelope?.subject || "");
            const summarySnippet = bodyText.substring(0, 500).replace(/\n+/g, " ").trim();

            const { error: insertErr } = await supabase
              .from("plaud_transcriptions")
              .insert({
                user_id,
                source_email_id: cachedEmail.message_id,
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
              existingIds.add(cachedEmail.message_id);
            } else if (!insertErr.message?.includes("duplicate")) {
              console.error(`[plaud-fetch] Insert error: ${insertErr.message}`);
            }
          }

          await client.disconnect();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unknown";
          console.error(`[plaud-fetch] IMAP error: ${msg}`);
          // Continue — we may have already created some from emails with body
        }
      } else {
        console.log("[plaud-fetch] No IMAP account for body fetch");
      }
    }

    // 6. Fallback: create transcription entries even when body is not available yet
    if (transcriptionsCreated < BATCH_SIZE) {
      for (const email of withoutBody) {
        if (transcriptionsCreated >= BATCH_SIZE) break;
        if (existingIds.has(email.message_id)) continue;

        const { date: recordingDate, title } = extractRecordingDate(email.subject || "");
        const placeholder = "Cuerpo pendiente de sincronización.";

        const { error: insertErr } = await supabase
          .from("plaud_transcriptions")
          .insert({
            user_id,
            source_email_id: email.message_id,
            recording_date: recordingDate,
            title,
            transcript_raw: null,
            summary_structured: placeholder,
            participants: null,
            parsed_data: { summary_snippet: "", body_pending: true },
            ai_processed: false,
            processing_status: "pending_review",
            context_type: "professional",
            duration_minutes: null,
          });

        if (!insertErr) {
          transcriptionsCreated++;
          existingIds.add(email.message_id);
        } else if (!insertErr.message?.includes("duplicate")) {
          console.error(`[plaud-fetch] Placeholder insert error: ${insertErr.message}`);
        }
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
