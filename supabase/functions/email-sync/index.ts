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
  subject: string;
  preview: string;
  date: string;
  message_id?: string;
}

// ─── IMAP date format helper ──────────────────────────────────────────────────
function formatImapDate(date: Date): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

// ─── Generic IMAP sync (works for Outlook, iCloud, any IMAP server) ──────────
async function syncIMAP(account: EmailAccount): Promise<ParsedEmail[]> {
  const creds = account.credentials_encrypted;
  if (!creds?.password) throw new Error("No IMAP password configured. Add your app password in Settings.");

  // Resolve ENV: prefix — read password from Deno env secrets
  let password = creds.password;
  if (password.startsWith("ENV:")) {
    const envKey = password.substring(4);
    password = Deno.env.get(envKey) || "";
    if (!password) throw new Error(`Secret ${envKey} not configured`);
  }

  const host = account.imap_host || "outlook.office365.com";
  const port = account.imap_port || 993;

  console.log(`[email-sync] IMAP connecting to ${host}:${port} as ${account.email_address}`);

  const client = new ImapClient({
    host,
    port,
    tls: true,
    username: account.email_address,
    password,
  });

  try {
    await client.connect();
    await client.authenticate();

    // First sync: 365 days back; subsequent: since last_sync_at
    const since = account.last_sync_at
      ? new Date(account.last_sync_at)
      : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const fetchResult = await fetchMessagesSince(client, "INBOX", since, {
      envelope: true,
      headers: ["Subject", "From", "Date"],
    });

    const emails: ParsedEmail[] = [];

    if (fetchResult && Array.isArray(fetchResult)) {
      for (const msg of fetchResult) {
        try {
          const envelope = msg.envelope;
          if (!envelope) continue;

          const fromAddr = envelope.from?.[0]
            ? `${envelope.from[0].name || ""} <${envelope.from[0].mailbox}@${envelope.from[0].host}>`
            : "unknown";

          emails.push({
            from_addr: fromAddr,
            subject: envelope.subject || "(sin asunto)",
            preview: "",
            date: envelope.date || new Date().toISOString(),
            message_id: envelope.messageId || String(msg.seq),
          });
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

// ─── Gmail sync via REST API ───────────────────────────────────────────────────
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

  return await fetchGmailMessages(accessToken, account.last_sync_at);
}

async function fetchGmailMessages(accessToken: string, lastSyncAt: string | null): Promise<ParsedEmail[]> {
  const query = lastSyncAt
    ? `after:${Math.floor(new Date(lastSyncAt).getTime() / 1000)}`
    : "newer_than:365d";

  const emails: ParsedEmail[] = [];
  let pageToken: string | undefined = undefined;

  // Paginate through all Gmail messages
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

    // Fetch details in batches of 20 to avoid rate limits
    for (let i = 0; i < messages.length; i += 20) {
      const batch = messages.slice(i, i + 20);
      const detailPromises = batch.map(async (msg: { id: string }) => {
        try {
          const detailRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (!detailRes.ok) { await detailRes.text(); return null; }

          const detail = await detailRes.json();
          const headers = detail.payload?.headers || [];
          const getHeader = (name: string) =>
            headers.find((h: { name: string }) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

          return {
            from_addr: getHeader("From"),
            subject: getHeader("Subject"),
            preview: detail.snippet || "",
            date: getHeader("Date") || new Date().toISOString(),
            message_id: msg.id,
          } as ParsedEmail;
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
    return await fetchGmailMessages(creds.access_token, account.last_sync_at);
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
        return await fetchGmailMessages(data.access_token, account.last_sync_at);
      }
    }
  }

  throw new Error("No Gmail access token or refresh token available. Re-connect Gmail in Settings.");
}

// ─── Outlook sync: IMAP fallback or Graph API ─────────────────────────────────
async function syncOutlook(account: EmailAccount): Promise<ParsedEmail[]> {
  const creds = account.credentials_encrypted;

  // If has password but no access_token → use IMAP directly
  if (creds?.password && !creds?.access_token) {
    account.imap_host = account.imap_host || "outlook.office365.com";
    account.imap_port = account.imap_port || 993;
    return syncIMAP(account);
  }

  // OAuth flow (if configured)
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
    `https://graph.microsoft.com/v1.0/me/messages?$top=20&$select=subject,from,bodyPreview,receivedDateTime,id&$orderby=receivedDateTime desc${filter}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Outlook error ${res.status}: ${err.substring(0, 200)}`);
  }

  const data = await res.json();
  return (data.value || []).map((m: Record<string, unknown>) => ({
    from_addr: (m.from as { emailAddress?: { address?: string } })?.emailAddress?.address || "unknown",
    subject: m.subject as string || "(sin asunto)",
    preview: (m.bodyPreview as string || "").substring(0, 200),
    date: m.receivedDateTime as string,
    message_id: m.id as string,
  }));
}

// ─── iCloud sync ──────────────────────────────────────────────────────────────
async function syncICloud(account: EmailAccount, supabase: any): Promise<ParsedEmail[]> {
  const creds = account.credentials_encrypted;
  
  // If has password, use IMAP directly
  if (creds?.password) {
    account.imap_host = account.imap_host || "imap.mail.me.com";
    account.imap_port = account.imap_port || 993;
    return syncIMAP(account);
  }

  // Try user_integrations for existing iCloud credentials
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
        if (provider) {
          query = query.eq("provider", provider);
        }
        const { data } = await query;
        accounts = (data || []) as EmailAccount[];
      } else {
        let query = supabase
          .from("email_accounts")
          .select("*")
          .eq("is_active", true);
        if (provider) {
          query = query.eq("provider", provider);
        }
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
              
              // IMAP fallback: si tiene password pero no OAuth token
              if (gmailCreds?.password && !gmailCreds?.access_token) {
                account.imap_host = account.imap_host || "imap.gmail.com";
                account.imap_port = account.imap_port || 993;
                emails = await syncIMAP(account);
                break;
              }
              
              // OAuth flow
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

          // Upsert emails into jarvis_emails_cache (batch insert, skip duplicates)
          if (emails.length > 0) {
            const batchSize = 500;
            let insertedCount = 0;

            for (let i = 0; i < emails.length; i += batchSize) {
              const batch = emails.slice(i, i + batchSize);
              const rows = batch.map((e) => ({
                user_id: account.user_id,
                account: account.email_address,
                from_addr: e.from_addr.substring(0, 500),
                subject: e.subject.substring(0, 500),
                preview: e.preview.substring(0, 500),
                synced_at: new Date().toISOString(),
                is_read: false,
                message_id: e.message_id || `gen-${account.email_address}-${Date.now()}-${i + batch.indexOf(e)}`,
              }));

              const { error: insertError, count } = await supabase
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
      const { provider, credentials } = body;

      if (provider === "gmail" && credentials?.access_token) {
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

      // Test IMAP connection (for outlook, gmail, icloud, imap with password)
      if ((provider === "outlook" || provider === "icloud" || provider === "imap" || provider === "gmail") && credentials?.password) {
        try {
          const host = credentials.imap_host || (provider === "icloud" ? "imap.mail.me.com" : provider === "gmail" ? "imap.gmail.com" : "outlook.office365.com");
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
            JSON.stringify({ success: true, message: `${provider} conectado via IMAP` }),
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

      if (provider === "outlook" && credentials?.access_token) {
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
