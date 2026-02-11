import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// ─── Gmail sync via REST API ───────────────────────────────────────────────────
async function syncGmail(account: EmailAccount): Promise<ParsedEmail[]> {
  const creds = account.credentials_encrypted;
  if (!creds?.access_token) throw new Error("No Gmail access token");

  let accessToken = creds.access_token;

  // Try to refresh if we have a refresh token
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
    : "newer_than:7d";

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listRes.ok) {
    const err = await listRes.text();
    throw new Error(`Gmail list error ${listRes.status}: ${err.substring(0, 200)}`);
  }

  const listData = await listRes.json();
  const messages = listData.messages || [];
  const emails: ParsedEmail[] = [];

  for (const msg of messages.slice(0, 10)) {
    try {
      const detailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!detailRes.ok) continue;

      const detail = await detailRes.json();
      const headers = detail.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h: { name: string }) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

      emails.push({
        from_addr: getHeader("From"),
        subject: getHeader("Subject"),
        preview: detail.snippet || "",
        date: getHeader("Date") || new Date().toISOString(),
        message_id: msg.id,
      });
    } catch (e) {
      console.error("Gmail detail fetch error:", e);
    }
  }

  return emails;
}

// ─── Gmail sync via Supabase provider token (reuses Google Calendar OAuth) ────
async function syncGmailViaProviderToken(account: EmailAccount, supabase: any): Promise<ParsedEmail[]> {
  // The user's Google provider token is stored in the auth session
  // We need to get it from the email_accounts credentials or use a passed token
  const creds = account.credentials_encrypted;
  
  // If we have a direct access_token, use it
  if (creds?.access_token) {
    return await fetchGmailMessages(creds.access_token, account.last_sync_at);
  }

  // If we have a provider_refresh_token stored, try refreshing
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
        
        // Update stored token
        await supabase
          .from("email_accounts")
          .update({ 
            credentials_encrypted: { 
              ...creds, 
              access_token: data.access_token 
            } 
          })
          .eq("id", account.id);

        return await fetchGmailMessages(data.access_token, account.last_sync_at);
      }
    }
  }

  throw new Error("No Gmail access token or refresh token available. Re-connect Gmail in Settings.");
}

// ─── Outlook sync via Microsoft Graph ──────────────────────────────────────────
async function syncOutlook(account: EmailAccount): Promise<ParsedEmail[]> {
  const creds = account.credentials_encrypted;
  if (!creds?.access_token) throw new Error("No Outlook access token");

  let accessToken = creds.access_token;

  if (creds.refresh_token) {
    const clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
    const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET");

    if (clientId && clientSecret) {
      try {
        const refreshRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
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

// ─── iCloud Mail sync via IMAP-like REST (reuses iCloud Calendar credentials) ─
async function syncICloud(account: EmailAccount, supabase: any): Promise<ParsedEmail[]> {
  // Try to get credentials from: 1) account credentials, 2) user_integrations, 3) env vars
  let email = "";
  let password = "";

  const creds = account.credentials_encrypted;
  
  if (creds?.password) {
    email = account.email_address;
    password = creds.password;
  } else {
    // Try user_integrations (reuse iCloud Calendar credentials)
    const { data: integration } = await supabase
      .from("user_integrations")
      .select("icloud_email, icloud_password_encrypted")
      .eq("user_id", account.user_id)
      .single();

    if (integration?.icloud_email && integration?.icloud_password_encrypted) {
      email = integration.icloud_email;
      password = integration.icloud_password_encrypted;
    } else {
      // Fall back to env vars
      email = Deno.env.get("APPLE_ID_EMAIL") || "";
      password = Deno.env.get("APPLE_APP_SPECIFIC_PASSWORD") || "";
    }
  }

  email = email.trim();
  password = password.trim().replace(/\s+/g, "");

  if (!email || !password) {
    console.log(`[email-sync] iCloud: no credentials for ${account.email_address}`);
    return [];
  }

  console.log(`[email-sync] Fetching iCloud mail for ${email} via JMAP/webmail...`);

  // iCloud doesn't have a public REST API for mail, but we can use the 
  // same CalDAV auth to verify credentials are valid
  // For actual email fetching, we use Apple's webmail endpoint
  const auth = btoa(`${email}:${password}`);
  
  // Verify credentials work using CalDAV (same as calendar)
  try {
    const testRes = await fetch("https://caldav.icloud.com/", {
      method: "PROPFIND",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/xml; charset=utf-8",
        "Depth": "0",
      },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:current-user-principal/></d:prop>
</d:propfind>`,
    });

    if (testRes.status === 401) {
      throw new Error("iCloud credentials are invalid or expired");
    }

    if (!testRes.ok) {
      throw new Error(`iCloud auth check failed: ${testRes.status}`);
    }

    // Credentials valid - now try IMAP via Apple's mail server
    // Note: Native IMAP/TCP isn't available in Deno edge functions
    // We mark the account as verified but can't fetch emails without a TCP connection
    console.log(`[email-sync] iCloud credentials verified for ${email}. IMAP TCP not available in edge runtime.`);
    console.log(`[email-sync] Consider using a cron-triggered external IMAP proxy for full iCloud mail sync.`);
    
    return [];
  } catch (e) {
    console.error(`[email-sync] iCloud auth error:`, e);
    throw e;
  }
}

async function syncIMAP(_account: EmailAccount): Promise<ParsedEmail[]> {
  console.log(`[email-sync] Generic IMAP sync for ${_account.email_address} - IMAP not yet available in Deno runtime`);
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
    const { user_id, account_id, action, provider_token, provider_refresh_token } = body;

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
        const { data } = await supabase
          .from("email_accounts")
          .select("*")
          .eq("user_id", user_id)
          .eq("is_active", true);
        accounts = (data || []) as EmailAccount[];
      } else {
        const { data } = await supabase
          .from("email_accounts")
          .select("*")
          .eq("is_active", true);
        accounts = (data || []) as EmailAccount[];
      }

      console.log(`[email-sync] Syncing ${accounts.length} account(s)`);

      const results: Array<{ account_id: string; synced: number; error?: string }> = [];

      for (const account of accounts) {
        try {
          let emails: ParsedEmail[] = [];

          switch (account.provider) {
            case "gmail": {
              // If provider_token was passed (from the frontend), store it and use it
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

          // Upsert emails into jarvis_emails_cache
          if (emails.length > 0) {
            const rows = emails.map((e) => ({
              user_id: account.user_id,
              account: account.email_address,
              from_addr: e.from_addr.substring(0, 500),
              subject: e.subject.substring(0, 500),
              preview: e.preview.substring(0, 500),
              synced_at: new Date().toISOString(),
              is_read: false,
            }));

            const { error: insertError } = await supabase
              .from("jarvis_emails_cache")
              .insert(rows);

            if (insertError) {
              console.error(`[email-sync] Insert error for ${account.email_address}:`, insertError);
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

      if (provider === "icloud") {
        const email = credentials?.email || "";
        const password = credentials?.password || "";
        if (!email || !password) {
          return new Response(
            JSON.stringify({ success: false, message: "Faltan credenciales de iCloud" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const auth = btoa(`${email.trim()}:${password.trim().replace(/\s+/g, "")}`);
        const res = await fetch("https://caldav.icloud.com/", {
          method: "PROPFIND",
          headers: {
            "Authorization": `Basic ${auth}`,
            "Content-Type": "application/xml; charset=utf-8",
            "Depth": "0",
          },
          body: `<?xml version="1.0" encoding="UTF-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>`,
        });
        const ok = res.ok;
        return new Response(
          JSON.stringify({ success: ok, message: ok ? "iCloud conectado" : "Credenciales inválidas" }),
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
