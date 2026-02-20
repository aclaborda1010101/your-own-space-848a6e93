import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ImapClient, fetchMessagesSince } from "jsr:@workingdevshero/deno-imap";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailAccount {
  id: string;
  user_id: string;
  provider: "gmail" | "outlook" | "icloud" | "imap";
  email_address: string;
  credentials_encrypted: Record<string, string> | null;
  imap_host: string | null;
  imap_port: number | null;
  is_active: boolean;
  last_sync_at: string | null;
}

interface ParsedEmail {
  from_addr: string;
  to_addr: string;
  cc_addr: string;
  bcc_addr: string;
  subject: string;
  preview: string;
  body_text: string;
  body_html: string;
  date: string;
  message_id?: string;
  thread_id?: string;
  reply_to_id?: string;
  direction: "sent" | "received";
  received_at?: string;
  has_attachments: boolean;
  attachments_meta?: Record<string, unknown>[];
  email_type?: string;
  importance?: string;
  is_forwarded: boolean;
  original_sender?: string;
  is_auto_reply: boolean;
  email_language?: string;
  signature_raw?: string;
  signature_parsed?: Record<string, unknown>;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const BODY_TEXT_MAX = 50000;
const GMAIL_BATCH_SIZE = 10; // Reduced from 20 for format=full
const IMAP_BATCH_SIZE = 500;

// ─── Pre-classification helpers ───────────────────────────────────────────────

function preClassifyEmail(email: ParsedEmail): string {
  const from = email.from_addr.toLowerCase();
  const subject = email.subject.toLowerCase();

  // Plaud transcription detection — MUST be before newsletter/noreply filter
  if (from.includes("plaud.ai") || subject.includes("[plaud-autoflow]")) return "plaud_transcription";

  // Auto-reply detection
  if (email.is_auto_reply) return "auto_reply";

  // Newsletter / marketing patterns
  const newsletterFromPatterns = [
    "noreply@", "no-reply@", "newsletter@", "news@", "marketing@",
    "info@", "notifications@", "updates@", "digest@", "mailer@",
    "donotreply@", "do-not-reply@", "bounce@", "bulk@",
  ];
  if (newsletterFromPatterns.some(p => from.includes(p))) return "newsletter";

  // Notification patterns (automated systems)
  const notificationPatterns = [
    "calendar-notification@google.com", "jira@", "github.com",
    "slack.com", "trello.com", "asana.com", "notion.so",
    "linear.app", "gitlab.com", "bitbucket.org",
  ];
  if (notificationPatterns.some(p => from.includes(p))) return "notification";

  // Calendar invite
  if (email.has_attachments && email.attachments_meta?.some(a => 
    (a.type as string)?.includes("calendar") || 
    (a.name as string)?.toLowerCase().endsWith(".ics")
  )) return "calendar_invite";

  // Subject-based patterns
  if (subject.startsWith("re:") || subject.startsWith("fwd:") || subject.startsWith("fw:")) {
    // These are conversations, mark as personal
  }

  return "personal";
}

function detectImportance(email: ParsedEmail): string {
  const subject = email.subject.toLowerCase();
  if (subject.includes("urgent") || subject.includes("urgente") || subject.includes("asap")) return "high";
  if (subject.includes("[low]") || subject.includes("fyi")) return "low";
  return "normal";
}

function detectForwarded(subject: string): { is_forwarded: boolean; cleaned_subject?: string } {
  const fwPatterns = /^(fw|fwd|rv|wg|tr|i)\s*:\s*/i;
  if (fwPatterns.test(subject)) {
    return { is_forwarded: true, cleaned_subject: subject.replace(fwPatterns, "") };
  }
  return { is_forwarded: false };
}

function detectAutoReply(headers: Record<string, string>): boolean {
  if (headers["auto-submitted"] && headers["auto-submitted"] !== "no") return true;
  if (headers["x-auto-response-suppress"]) return true;
  if (headers["x-autoreply"]) return true;
  if (headers["x-autorespond"]) return true;
  const precedence = headers["precedence"] || "";
  if (precedence === "auto_reply" || precedence === "bulk" || precedence === "junk") return true;
  return false;
}

function detectLanguage(text: string): string {
  if (!text || text.length < 20) return "unknown";
  const sample = text.substring(0, 500).toLowerCase();
  
  // Simple heuristic based on common words
  const esWords = ["hola", "gracias", "buenas", "saludos", "adjunto", "reunión", "proyecto", "equipo", "favor"];
  const enWords = ["hello", "thanks", "regards", "please", "meeting", "project", "team", "attached"];
  const frWords = ["bonjour", "merci", "cordialement", "réunion", "projet"];

  const esScore = esWords.filter(w => sample.includes(w)).length;
  const enScore = enWords.filter(w => sample.includes(w)).length;
  const frScore = frWords.filter(w => sample.includes(w)).length;

  if (esScore > enScore && esScore > frScore) return "es";
  if (frScore > enScore && frScore > esScore) return "fr";
  if (enScore > 0) return "en";
  return "unknown";
}

// ─── Signature extraction ─────────────────────────────────────────────────────

function extractSignature(bodyText: string): { raw: string | null; parsed: Record<string, unknown> | null } {
  if (!bodyText) return { raw: null, parsed: null };
  
  // Common signature delimiters
  const sigPatterns = [
    /\n--\s*\n/,
    /\n_{3,}\n/,
    /\nSent from my /i,
    /\nEnviado desde mi /i,
    /\nGet Outlook for /i,
    /\n(?:Best regards|Saludos|Cordialmente|Atentamente|Kind regards|Regards|Un saludo)\s*[,.]?\s*\n/i,
  ];

  let sigStart = -1;
  let sigText = "";

  for (const pattern of sigPatterns) {
    const match = bodyText.search(pattern);
    if (match !== -1 && (sigStart === -1 || match < sigStart)) {
      sigStart = match;
    }
  }

  if (sigStart === -1 || sigStart > bodyText.length - 10) return { raw: null, parsed: null };

  sigText = bodyText.substring(sigStart).trim();
  if (sigText.length > 1000) sigText = sigText.substring(0, 1000);

  // Parse structured data from signature
  const parsed: Record<string, unknown> = {};

  // Phone
  const phoneMatch = sigText.match(/(?:\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/);
  if (phoneMatch) parsed.telefono = phoneMatch[0].trim();

  // LinkedIn
  const linkedinMatch = sigText.match(/(?:linkedin\.com\/in\/)([\w-]+)/i);
  if (linkedinMatch) parsed.linkedin = `linkedin.com/in/${linkedinMatch[1]}`;

  // Website
  const webMatch = sigText.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/\S*)?)/i);
  if (webMatch && !webMatch[0].includes("linkedin")) parsed.web = webMatch[0];

  // Job title heuristic: line after the name (first line after delimiter)
  const sigLines = sigText.split("\n").map(l => l.trim()).filter(l => l.length > 0 && l !== "--");
  if (sigLines.length >= 2) {
    // Second line is often the title
    const possibleTitle = sigLines[1];
    if (possibleTitle.length < 80 && !possibleTitle.includes("@") && !possibleTitle.match(/\d{5,}/)) {
      parsed.cargo = possibleTitle;
    }
    // Third line is often company
    if (sigLines.length >= 3) {
      const possibleCompany = sigLines[2];
      if (possibleCompany.length < 60 && !possibleCompany.includes("@") && !possibleCompany.match(/\d{5,}/)) {
        parsed.empresa = possibleCompany;
      }
    }
  }

  // Email in signature
  const emailMatch = sigText.match(/[\w.+-]+@[\w.-]+\.\w{2,}/);
  if (emailMatch) parsed.email = emailMatch[0];

  return { 
    raw: sigText.substring(0, 500), 
    parsed: Object.keys(parsed).length > 0 ? parsed : null 
  };
}

// ─── Gmail body extraction helpers ────────────────────────────────────────────

function decodeBase64Url(data: string): string {
  try {
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
    const bytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

function extractGmailBody(payload: Record<string, unknown>): { text: string; html: string } {
  let text = "";
  let html = "";

  const mimeType = payload.mimeType as string || "";
  const body = payload.body as Record<string, unknown> || {};
  const parts = payload.parts as Record<string, unknown>[] || [];

  if (body.data) {
    const decoded = decodeBase64Url(body.data as string);
    if (mimeType === "text/plain") text = decoded;
    else if (mimeType === "text/html") html = decoded;
  }

  for (const part of parts) {
    const partMime = part.mimeType as string || "";
    const partBody = part.body as Record<string, unknown> || {};
    const subParts = part.parts as Record<string, unknown>[] || [];

    if (partBody.data) {
      const decoded = decodeBase64Url(partBody.data as string);
      if (partMime === "text/plain" && !text) text = decoded;
      else if (partMime === "text/html" && !html) html = decoded;
    }

    // Recurse into multipart
    if (subParts.length > 0) {
      const sub = extractGmailBody(part);
      if (!text && sub.text) text = sub.text;
      if (!html && sub.html) html = sub.html;
    }
  }

  return { text: text.substring(0, BODY_TEXT_MAX), html: html.substring(0, BODY_TEXT_MAX) };
}

function extractGmailAttachments(payload: Record<string, unknown>): Record<string, unknown>[] {
  const attachments: Record<string, unknown>[] = [];
  const parts = payload.parts as Record<string, unknown>[] || [];

  for (const part of parts) {
    const filename = part.filename as string;
    const body = part.body as Record<string, unknown> || {};
    const mimeType = part.mimeType as string || "";

    if (filename && filename.length > 0) {
      const isIcs = filename.toLowerCase().endsWith(".ics") || mimeType.includes("calendar");
      attachments.push({
        name: filename,
        type: mimeType,
        size: body.size || 0,
        is_ics: isIcs,
      });
    }

    // Recurse
    if (part.parts) {
      attachments.push(...extractGmailAttachments(part));
    }
  }

  return attachments;
}

// ─── Exponential backoff for Gmail ────────────────────────────────────────────

async function fetchWithBackoff(url: string, headers: Record<string, string>, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers });
    if (res.status === 429 && attempt < retries) {
      const delay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
      console.log(`[email-sync] Gmail rate limit (429), waiting ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      continue;
    }
    return res;
  }
  throw new Error("Gmail rate limit exceeded after retries");
}

// ─── Sanitize IMAP date strings (strip "(UTC)" suffix etc.) ──────────────────
function sanitizeImapDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

// ─── IMAP date format helper ──────────────────────────────────────────────────
function formatImapDate(date: Date): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

// ─── Direction detection ──────────────────────────────────────────────────────
function detectDirection(fromAddr: string, accountEmail: string): "sent" | "received" {
  const from = fromAddr.toLowerCase();
  const account = accountEmail.toLowerCase();
  if (from.includes(account)) return "sent";
  return "received";
}

// ─── Extract original sender from forwarded email body ────────────────────────
function extractOriginalSender(bodyText: string): string | null {
  if (!bodyText) return null;
  // Look for "From:" in forwarded content
  const fwdMatch = bodyText.match(/(?:------\s*Forwarded|------\s*Mensaje reenviado)[\s\S]*?From:\s*(.+?)(?:\n|$)/i);
  if (fwdMatch) return fwdMatch[1].trim().substring(0, 200);
  
  const altMatch = bodyText.match(/De:\s*(.+?)(?:\n|$)/i);
  if (altMatch && bodyText.indexOf(altMatch[0]) > 50) return altMatch[1].trim().substring(0, 200);
  
  return null;
}

// ─── Generic IMAP sync ───────────────────────────────────────────────────────
async function syncIMAP(account: EmailAccount): Promise<ParsedEmail[]> {
  const creds = account.credentials_encrypted;
  if (!creds?.password) throw new Error("No IMAP password configured. Add your app password in Settings.");

  let password = creds.password;
  if (password.startsWith("ENV:")) {
    const envKey = password.substring(4);
    password = Deno.env.get(envKey) || "";
    if (!password) throw new Error(`Secret ${envKey} not configured`);
  }

  const host = account.imap_host || "outlook.office365.com";
  const port = account.imap_port || 993;

  console.log(`[email-sync] IMAP connecting to ${host}:${port} as ${account.email_address}`);

  const client = new ImapClient({ host, port, tls: true, username: account.email_address, password });

  try {
    await client.connect();
    await client.authenticate();

    const since = account.last_sync_at
      ? new Date(account.last_sync_at)
      : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    // Try to fetch with body, fallback to envelope only
    let fetchResult;
    let hasBody = false;
    try {
      fetchResult = await fetchMessagesSince(client, "INBOX", since, {
        envelope: true,
        headers: ["Subject", "From", "Date", "To", "Cc", "Bcc", "In-Reply-To", "List-Unsubscribe", "Auto-Submitted", "X-Auto-Response-Suppress", "Precedence"],
        bodyParts: ["TEXT"],
      });
      hasBody = true;
    } catch {
      console.log("[email-sync] IMAP body fetch failed, falling back to envelope only");
      fetchResult = await fetchMessagesSince(client, "INBOX", since, {
        envelope: true,
        headers: ["Subject", "From", "Date"],
      });
    }

    const emails: ParsedEmail[] = [];
    let count = 0;

    if (fetchResult && Array.isArray(fetchResult)) {
      for (const msg of fetchResult) {
        if (count >= IMAP_BATCH_SIZE) break;
        try {
          const envelope = msg.envelope;
          if (!envelope) continue;

          const fromAddr = envelope.from?.[0]
            ? `${envelope.from[0].name || ""} <${envelope.from[0].mailbox}@${envelope.from[0].host}>`
            : "unknown";

          const toAddr = envelope.to?.map((t: { name?: string; mailbox: string; host: string }) => 
            `${t.name || ""} <${t.mailbox}@${t.host}>`).join(", ") || "";

          const ccAddr = envelope.cc?.map((c: { name?: string; mailbox: string; host: string }) =>
            `${c.name || ""} <${c.mailbox}@${c.host}>`).join(", ") || "";

          const bodyText = hasBody ? (msg.bodyParts?.TEXT || msg.body?.text || "") : "";
          const subject = envelope.subject || "(sin asunto)";
          const fwInfo = detectForwarded(subject);
          
          // Build headers map for auto-reply detection
          const headersMap: Record<string, string> = {};
          if (msg.headers) {
            for (const [k, v] of Object.entries(msg.headers)) {
              headersMap[k.toLowerCase()] = String(v);
            }
          }

          const isAutoReply = detectAutoReply(headersMap);
          const hasListUnsub = !!headersMap["list-unsubscribe"];
          const direction = detectDirection(fromAddr, account.email_address);
          const sig = extractSignature(bodyText);

          const email: ParsedEmail = {
            from_addr: fromAddr,
            to_addr: toAddr,
            cc_addr: ccAddr,
            bcc_addr: "",
            subject,
            preview: bodyText.substring(0, 200),
            body_text: bodyText.substring(0, BODY_TEXT_MAX),
            body_html: "",
            date: sanitizeImapDate(envelope.date) || new Date().toISOString(),
            message_id: envelope.messageId || String(msg.seq),
            thread_id: undefined,
            reply_to_id: headersMap["in-reply-to"] || envelope.inReplyTo || undefined,
            direction,
            received_at: sanitizeImapDate(envelope.date) || new Date().toISOString(),
            has_attachments: false,
            attachments_meta: [],
            email_type: undefined,
            importance: "normal",
            is_forwarded: fwInfo.is_forwarded,
            original_sender: fwInfo.is_forwarded ? extractOriginalSender(bodyText) || undefined : undefined,
            is_auto_reply: isAutoReply,
            email_language: detectLanguage(bodyText),
            signature_raw: sig.raw || undefined,
            signature_parsed: sig.parsed || undefined,
          };

          // Pre-classify — Plaud detection takes priority over newsletter
          const preType = preClassifyEmail(email);
          if (preType === "plaud_transcription") {
            email.email_type = "plaud_transcription";
          } else if (hasListUnsub) {
            email.email_type = "newsletter";
          } else {
            email.email_type = preType;
          }
          email.importance = detectImportance(email);

          // If no body and it's metadata only
          if (!bodyText && !hasBody) {
            email.email_type = "metadata_only";
          }

          emails.push(email);
          count++;
        } catch (e) {
          console.error("[email-sync] IMAP parse error:", e);
        }
      }
    }

    await client.disconnect();
    console.log(`[email-sync] IMAP fetched ${emails.length} emails from ${host}`);
    return emails;
  } catch (e) {
    try { await client.disconnect(); } catch { /* ignore */ }
    throw e;
  }
}

// ─── Gmail sync via REST API ──────────────────────────────────────────────────
async function syncGmail(account: EmailAccount): Promise<ParsedEmail[]> {
  const creds = account.credentials_encrypted;
  if (!creds?.access_token) throw new Error("No Gmail access token");

  let accessToken = creds.access_token;

  if (creds.refresh_token) {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (clientId && clientSecret) {
      try {
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: creds.refresh_token,
            grant_type: "refresh_token",
          }),
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          accessToken = data.access_token;
        }
      } catch (e) {
        console.error("Gmail token refresh failed:", e);
      }
    }
  }

  return await fetchGmailMessages(accessToken, account.last_sync_at, account.email_address);
}

async function fetchGmailMessages(accessToken: string, lastSyncAt: string | null, accountEmail: string): Promise<ParsedEmail[]> {
  const query = lastSyncAt
    ? `after:${Math.floor(new Date(lastSyncAt).getTime() / 1000)}`
    : "newer_than:365d";

  const emails: ParsedEmail[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    url.searchParams.set("maxResults", "500");
    url.searchParams.set("q", query);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const listRes = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listRes.ok) {
      const err = await listRes.text();
      throw new Error(`Gmail list error ${listRes.status}: ${err.substring(0, 200)}`);
    }

    const listData = await listRes.json();
    const messages = listData.messages || [];
    pageToken = listData.nextPageToken;

    // Fetch details in batches of 10 (reduced for format=full)
    for (let i = 0; i < messages.length; i += GMAIL_BATCH_SIZE) {
      const batch = messages.slice(i, i + GMAIL_BATCH_SIZE);
      const detailPromises = batch.map(async (msg: { id: string }) => {
        try {
          const detailRes = await fetchWithBackoff(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
            { Authorization: `Bearer ${accessToken}` }
          );
          if (!detailRes.ok) { await detailRes.text(); return null; }

          const detail = await detailRes.json();
          const headers = detail.payload?.headers || [];
          const getHeader = (name: string) =>
            headers.find((h: { name: string }) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

          // Build headers map for auto-reply detection
          const headersMap: Record<string, string> = {};
          for (const h of headers) {
            headersMap[(h.name as string).toLowerCase()] = h.value as string;
          }

          // Extract body from payload
          const { text: bodyText, html: bodyHtml } = extractGmailBody(detail.payload || {});
          
          // Extract attachments metadata
          const attachments = extractGmailAttachments(detail.payload || {});

          const subject = getHeader("Subject") || "(sin asunto)";
          const fromAddr = getHeader("From");
          const fwInfo = detectForwarded(subject);
          const isAutoReply = detectAutoReply(headersMap);
          const direction = detectDirection(fromAddr, accountEmail);
          const sig = extractSignature(bodyText);
          const hasListUnsub = !!headersMap["list-unsubscribe"];

          const email: ParsedEmail = {
            from_addr: fromAddr,
            to_addr: getHeader("To"),
            cc_addr: getHeader("Cc"),
            bcc_addr: direction === "sent" ? getHeader("Bcc") : "",
            subject,
            preview: detail.snippet || "",
            body_text: bodyText,
            body_html: bodyHtml,
            date: getHeader("Date") || new Date().toISOString(),
            message_id: msg.id,
            thread_id: detail.threadId || undefined,
            reply_to_id: getHeader("In-Reply-To") || undefined,
            direction,
            received_at: getHeader("Date") || new Date().toISOString(),
            has_attachments: attachments.length > 0,
            attachments_meta: attachments.length > 0 ? attachments : undefined,
            email_type: undefined,
            importance: "normal",
            is_forwarded: fwInfo.is_forwarded,
            original_sender: fwInfo.is_forwarded ? extractOriginalSender(bodyText) || undefined : undefined,
            is_auto_reply: isAutoReply,
            email_language: detectLanguage(bodyText),
            signature_raw: sig.raw || undefined,
            signature_parsed: sig.parsed || undefined,
          };

          // Pre-classify
          if (hasListUnsub) {
            email.email_type = "newsletter";
          } else {
            email.email_type = preClassifyEmail(email);
          }
          email.importance = detectImportance(email);

          return email;
        } catch (e) {
          console.error("Gmail detail fetch error:", e);
          return null;
        }
      });

      const results = await Promise.all(detailPromises);
      for (const r of results) {
        if (r) emails.push(r);
      }
    }

    console.log(`[email-sync] Gmail page fetched: ${messages.length} msgs, total so far: ${emails.length}`);
  } while (pageToken);

  return emails;
}

// ─── Gmail sync via Supabase provider token ──────────────────────────────────
async function syncGmailViaProviderToken(account: EmailAccount, supabase: any): Promise<ParsedEmail[]> {
  const creds = account.credentials_encrypted;
  
  if (creds?.access_token) {
    return await fetchGmailMessages(creds.access_token, account.last_sync_at, account.email_address);
  }

  if (creds?.provider_refresh_token) {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (clientId && clientSecret) {
      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: creds.provider_refresh_token,
          grant_type: "refresh_token",
        }),
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        await supabase
          .from("email_accounts")
          .update({ credentials_encrypted: { ...creds, access_token: data.access_token } })
          .eq("id", account.id);
        return await fetchGmailMessages(data.access_token, account.last_sync_at, account.email_address);
      }
    }
  }

  throw new Error("No Gmail access token or refresh token available. Re-connect Gmail in Settings.");
}

// ─── Outlook sync ─────────────────────────────────────────────────────────────
async function syncOutlook(account: EmailAccount): Promise<ParsedEmail[]> {
  const creds = account.credentials_encrypted;

  if (creds?.password && !creds?.access_token) {
    account.imap_host = account.imap_host || "outlook.office365.com";
    account.imap_port = account.imap_port || 993;
    return syncIMAP(account);
  }

  if (!creds?.access_token) throw new Error("No credentials. Add your app password in Settings.");

  let accessToken = creds.access_token;

  if (creds.refresh_token) {
    const clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
    const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET");

    if (clientId && clientSecret) {
      try {
        const refreshRes = await fetch("https://login.microsoftonline.com/consumers/oauth2/v2.0/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: creds.refresh_token,
            grant_type: "refresh_token",
            scope: "https://graph.microsoft.com/Mail.Read",
          }),
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          accessToken = data.access_token;
        }
      } catch (e) {
        console.error("Outlook token refresh failed:", e);
      }
    }
  }

  const filter = account.last_sync_at
    ? `&$filter=receivedDateTime ge ${new Date(account.last_sync_at).toISOString()}`
    : "";

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages?$top=20&$select=subject,from,bodyPreview,receivedDateTime,id,toRecipients,ccRecipients,body,hasAttachments&$orderby=receivedDateTime desc${filter}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Outlook error ${res.status}: ${err.substring(0, 200)}`);
  }

  const data = await res.json();
  return (data.value || []).map((m: Record<string, unknown>) => {
    const subject = m.subject as string || "(sin asunto)";
    const fwInfo = detectForwarded(subject);
    const bodyContent = ((m.body as Record<string, unknown>)?.content as string) || "";
    const bodyText = bodyContent.replace(/<[^>]*>/g, "").substring(0, BODY_TEXT_MAX);
    
    return {
      from_addr: (m.from as { emailAddress?: { address?: string } })?.emailAddress?.address || "unknown",
      to_addr: ((m.toRecipients as any[]) || []).map((r: any) => r.emailAddress?.address).filter(Boolean).join(", "),
      cc_addr: ((m.ccRecipients as any[]) || []).map((r: any) => r.emailAddress?.address).filter(Boolean).join(", "),
      bcc_addr: "",
      subject,
      preview: (m.bodyPreview as string || "").substring(0, 200),
      body_text: bodyText,
      body_html: bodyContent.substring(0, BODY_TEXT_MAX),
      date: m.receivedDateTime as string,
      message_id: m.id as string,
      direction: "received" as const,
      received_at: m.receivedDateTime as string,
      has_attachments: m.hasAttachments as boolean || false,
      attachments_meta: [],
      is_forwarded: fwInfo.is_forwarded,
      is_auto_reply: false,
      email_type: "personal",
      importance: "normal",
      email_language: detectLanguage(bodyText),
    } as ParsedEmail;
  });
}

// ─── iCloud sync ──────────────────────────────────────────────────────────────
async function syncICloud(account: EmailAccount, supabase: any): Promise<ParsedEmail[]> {
  const creds = account.credentials_encrypted;
  
  if (creds?.password) {
    account.imap_host = account.imap_host || "imap.mail.me.com";
    account.imap_port = account.imap_port || 993;
    return syncIMAP(account);
  }

  const { data: integration } = await supabase
    .from("user_integrations")
    .select("icloud_email, icloud_password_encrypted")
    .eq("user_id", account.user_id)
    .single();

  if (integration?.icloud_email && integration?.icloud_password_encrypted) {
    account.imap_host = "imap.mail.me.com";
    account.imap_port = 993;
    account.credentials_encrypted = { ...creds, password: integration.icloud_password_encrypted } as any;
    return syncIMAP(account);
  }

  console.log(`[email-sync] iCloud: no credentials for ${account.email_address}`);
  return [];
}

// ─── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const { user_id, account_id, action, provider, provider_token, provider_refresh_token } = body;

    // Action: sync
    if (action === "sync" || !action) {
      let accounts: EmailAccount[] = [];

      if (account_id) {
        const { data } = await supabase
          .from("email_accounts")
          .select("*")
          .eq("id", account_id)
          .eq("is_active", true)
          .single();
        if (data) accounts = [data as EmailAccount];
      } else if (user_id) {
        let query = supabase
          .from("email_accounts")
          .select("*")
          .eq("user_id", user_id)
          .eq("is_active", true);
        if (provider) query = query.eq("provider", provider);
        const { data } = await query;
        accounts = (data || []) as EmailAccount[];
      } else {
        let query = supabase
          .from("email_accounts")
          .select("*")
          .eq("is_active", true);
        if (provider) query = query.eq("provider", provider);
        const { data } = await query;
        accounts = (data || []) as EmailAccount[];
      }

      console.log(`[email-sync] Syncing ${accounts.length} account(s)`);

      const results: Array<{ account_id: string; synced: number; error?: string }> = [];

      for (const account of accounts) {
        try {
          let emails: ParsedEmail[] = [];

          switch (account.provider) {
            case "gmail": {
              const gmailCreds = account.credentials_encrypted;
              
              if (gmailCreds?.password && !gmailCreds?.access_token) {
                account.imap_host = account.imap_host || "imap.gmail.com";
                account.imap_port = account.imap_port || 993;
                emails = await syncIMAP(account);
                break;
              }
              
              if (provider_token) {
                const updatedCreds = {
                  ...(account.credentials_encrypted || {}),
                  access_token: provider_token,
                  ...(provider_refresh_token ? { provider_refresh_token } : {}),
                };
                await supabase
                  .from("email_accounts")
                  .update({ credentials_encrypted: updatedCreds })
                  .eq("id", account.id);
                account.credentials_encrypted = updatedCreds as any;
              }
              emails = await syncGmailViaProviderToken(account, supabase);
              break;
            }
            case "outlook":
              emails = await syncOutlook(account);
              break;
            case "icloud":
              emails = await syncICloud(account, supabase);
              break;
            case "imap":
              emails = await syncIMAP(account);
              break;
          }

          // Upsert emails into jarvis_emails_cache with ALL new fields
          if (emails.length > 0) {
            const batchSize = 500;
            let insertedCount = 0;

            for (let i = 0; i < emails.length; i += batchSize) {
              const batch = emails.slice(i, i + batchSize);
              const rows = batch.map((e) => ({
                user_id: account.user_id,
                account: account.email_address,
                from_addr: e.from_addr.substring(0, 500),
                to_addr: e.to_addr?.substring(0, 1000) || null,
                cc_addr: e.cc_addr?.substring(0, 1000) || null,
                bcc_addr: e.bcc_addr?.substring(0, 500) || null,
                subject: e.subject.substring(0, 500),
                preview: e.preview.substring(0, 500),
                body_text: e.body_text || null,
                body_html: e.body_html || null,
                synced_at: new Date().toISOString(),
                is_read: false,
                message_id: e.message_id || `gen-${account.email_address}-${Date.now()}-${i + batch.indexOf(e)}`,
                thread_id: e.thread_id || null,
                reply_to_id: e.reply_to_id || null,
                direction: e.direction || null,
                received_at: e.received_at || null,
                has_attachments: e.has_attachments || false,
                attachments_meta: e.attachments_meta && e.attachments_meta.length > 0 ? e.attachments_meta : null,
                signature_raw: e.signature_raw || null,
                signature_parsed: e.signature_parsed || null,
                email_type: e.email_type || null,
                importance: e.importance || "normal",
                is_forwarded: e.is_forwarded || false,
                original_sender: e.original_sender || null,
                is_auto_reply: e.is_auto_reply || false,
                email_language: e.email_language || null,
                ai_processed: false,
              }));

              const { error: insertError } = await supabase
                .from("jarvis_emails_cache")
                .upsert(rows, { 
                  onConflict: "user_id,account,message_id",
                  ignoreDuplicates: true 
                });

              if (insertError) {
                console.error(`[email-sync] Insert error for ${account.email_address}:`, insertError);
              }
              insertedCount += batch.length;
            }

            console.log(`[email-sync] Inserted/upserted ${insertedCount} emails for ${account.email_address}`);

            // ─── Plaud auto-trigger ─────────────────────────────────────────
            const plaudEmails = emails.filter(e => e.email_type === "plaud_transcription");
            if (plaudEmails.length > 0) {
              console.log(`[email-sync] Found ${plaudEmails.length} Plaud email(s), triggering plaud-intelligence...`);
              const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
              const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
              for (const pe of plaudEmails) {
                try {
                  const plaudRes = await fetch(`${supabaseUrl}/functions/v1/plaud-intelligence`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${serviceKey}`,
                    },
                    body: JSON.stringify({
                      email_id: pe.message_id,
                      user_id: account.user_id,
                      account: account.email_address,
                    }),
                  });
                  const plaudResult = await plaudRes.json();
                  console.log(`[email-sync] Plaud intelligence result for ${pe.message_id}:`, JSON.stringify(plaudResult));
                } catch (plaudErr) {
                  console.error(`[email-sync] Plaud intelligence error for ${pe.message_id}:`, plaudErr);
                }
              }
            }
          }

          // Update last_sync_at
          await supabase
            .from("email_accounts")
            .update({ last_sync_at: new Date().toISOString(), sync_error: null })
            .eq("id", account.id);

          results.push({ account_id: account.id, synced: emails.length });
          console.log(`[email-sync] ${account.provider}:${account.email_address} → ${emails.length} emails`);
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          console.error(`[email-sync] Error syncing ${account.email_address}:`, errorMsg);

          await supabase
            .from("email_accounts")
            .update({ sync_error: errorMsg })
            .eq("id", account.id);

          results.push({ account_id: account.id, synced: 0, error: errorMsg });
        }
      }

      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: test connection
    if (action === "test") {
      const { provider: testProvider, credentials } = body;

      if (testProvider === "gmail" && credentials?.access_token) {
        const res = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/profile",
          { headers: { Authorization: `Bearer ${credentials.access_token}` } }
        );
        const ok = res.ok;
        return new Response(
          JSON.stringify({ success: ok, message: ok ? "Gmail conectado" : "Token inválido" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if ((testProvider === "outlook" || testProvider === "icloud" || testProvider === "imap" || testProvider === "gmail") && credentials?.password) {
        try {
          const host = credentials.imap_host || (testProvider === "icloud" ? "imap.mail.me.com" : testProvider === "gmail" ? "imap.gmail.com" : "outlook.office365.com");
          const port = credentials.imap_port || 993;
          const client = new ImapClient({
            host, port, tls: true,
            username: credentials.email,
            password: credentials.password,
          });
          await client.connect();
          await client.authenticate();
          await client.disconnect();
          return new Response(
            JSON.stringify({ success: true, message: `${testProvider} conectado via IMAP` }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Connection failed";
          return new Response(
            JSON.stringify({ success: false, message: `IMAP error: ${msg}` }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      if (testProvider === "outlook" && credentials?.access_token) {
        const res = await fetch(
          "https://graph.microsoft.com/v1.0/me",
          { headers: { Authorization: `Bearer ${credentials.access_token}` } }
        );
        const ok = res.ok;
        return new Response(
          JSON.stringify({ success: ok, message: ok ? "Outlook conectado" : "Token inválido" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, message: "Proveedor no soportado para test" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Action: reprocess ──────────────────────────────────────────────────
    if (action === "reprocess") {
      if (!user_id) {
        return new Response(
          JSON.stringify({ error: "user_id required for reprocess" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[email-sync] REPROCESS started for user ${user_id}`);

      // Fetch all active accounts for this user
      const { data: accountsData } = await supabase
        .from("email_accounts")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_active", true);

      const accounts = (accountsData || []) as EmailAccount[];
      console.log(`[email-sync] Reprocessing ${accounts.length} account(s)`);

      const results: Array<{ account_id: string; synced: number; hasMore?: boolean; error?: string }> = [];
      let globalHasMore = false;

      for (const account of accounts) {
        // Save original last_sync_at
        const originalLastSync = account.last_sync_at;

        try {
          // Force full 365-day fetch by clearing last_sync_at
          account.last_sync_at = null;

          let emails: ParsedEmail[] = [];

          switch (account.provider) {
            case "gmail": {
              const gmailCreds = account.credentials_encrypted;
              if (gmailCreds?.password && !gmailCreds?.access_token) {
                account.imap_host = account.imap_host || "imap.gmail.com";
                account.imap_port = account.imap_port || 993;
                emails = await syncIMAP(account);
              } else {
                emails = await syncGmailViaProviderToken(account, supabase);
              }
              break;
            }
            case "outlook":
              emails = await syncOutlook(account);
              break;
            case "icloud":
              emails = await syncICloud(account, supabase);
              break;
            case "imap":
              emails = await syncIMAP(account);
              break;
          }

          // Check if IMAP hit batch limit (hasMore)
          const accountHasMore = (account.provider === "imap" || 
            (account.provider === "gmail" && account.credentials_encrypted?.password)) && 
            emails.length >= IMAP_BATCH_SIZE;
          if (accountHasMore) globalHasMore = true;

          // Upsert with ignoreDuplicates: FALSE to UPDATE existing rows
          if (emails.length > 0) {
            const batchSize = 500;
            let insertedCount = 0;

            for (let i = 0; i < emails.length; i += batchSize) {
              const batch = emails.slice(i, i + batchSize);
              const rows = batch.map((e) => ({
                user_id: account.user_id,
                account: account.email_address,
                from_addr: e.from_addr.substring(0, 500),
                to_addr: e.to_addr?.substring(0, 1000) || null,
                cc_addr: e.cc_addr?.substring(0, 1000) || null,
                bcc_addr: e.bcc_addr?.substring(0, 500) || null,
                subject: e.subject.substring(0, 500),
                preview: e.preview.substring(0, 500),
                body_text: e.body_text || null,
                body_html: e.body_html || null,
                synced_at: new Date().toISOString(),
                message_id: e.message_id || `gen-${account.email_address}-${Date.now()}-${i + batch.indexOf(e)}`,
                thread_id: e.thread_id || null,
                reply_to_id: e.reply_to_id || null,
                direction: e.direction || null,
                received_at: e.received_at || null,
                has_attachments: e.has_attachments || false,
                attachments_meta: e.attachments_meta && e.attachments_meta.length > 0 ? e.attachments_meta : null,
                signature_raw: e.signature_raw || null,
                signature_parsed: e.signature_parsed || null,
                email_type: e.email_type || null,
                importance: e.importance || "normal",
                is_forwarded: e.is_forwarded || false,
                original_sender: e.original_sender || null,
                is_auto_reply: e.is_auto_reply || false,
                email_language: e.email_language || null,
                ai_processed: false,
              }));

              // KEY DIFFERENCE: ignoreDuplicates = false → updates existing rows
              const { error: insertError } = await supabase
                .from("jarvis_emails_cache")
                .upsert(rows, {
                  onConflict: "user_id,account,message_id",
                  ignoreDuplicates: false,
                });

              if (insertError) {
                console.error(`[email-sync] Reprocess insert error for ${account.email_address}:`, insertError);
              }
              insertedCount += batch.length;
            }

            console.log(`[email-sync] Reprocessed ${insertedCount} emails for ${account.email_address}`);
          }

          // Restore original last_sync_at (don't change the sync cursor)
          await supabase
            .from("email_accounts")
            .update({ last_sync_at: originalLastSync, sync_error: null })
            .eq("id", account.id);

          results.push({ account_id: account.id, synced: emails.length, hasMore: accountHasMore });
          console.log(`[email-sync] REPROCESS ${account.provider}:${account.email_address} → ${emails.length} emails`);
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          console.error(`[email-sync] Reprocess error ${account.email_address}:`, errorMsg);

          // Restore original last_sync_at even on error
          await supabase
            .from("email_accounts")
            .update({ last_sync_at: originalLastSync, sync_error: errorMsg })
            .eq("id", account.id);

          results.push({ account_id: account.id, synced: 0, error: errorMsg });
        }
      }

      return new Response(
        JSON.stringify({ success: true, action: "reprocess", results, hasMore: globalHasMore }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[email-sync] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
