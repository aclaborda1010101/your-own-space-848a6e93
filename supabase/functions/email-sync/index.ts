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

  // Fetch last 20 messages
  const query = account.last_sync_at
    ? `after:${Math.floor(new Date(account.last_sync_at).getTime() / 1000)}`
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

  // Fetch details for each (max 10 to stay fast)
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

// ─── Outlook sync via Microsoft Graph ──────────────────────────────────────────
async function syncOutlook(account: EmailAccount): Promise<ParsedEmail[]> {
  const creds = account.credentials_encrypted;
  if (!creds?.access_token) throw new Error("No Outlook access token");

  let accessToken = creds.access_token;

  // Refresh token if available
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

// ─── iCloud / IMAP sync via basic IMAP-like approach ───────────────────────────
async function syncICloud(account: EmailAccount): Promise<ParsedEmail[]> {
  // iCloud IMAP isn't natively supported in Deno's fetch API.
  // We use a minimal approach: query iCloud's webmail-like endpoints.
  // For now, this is a placeholder that returns empty - real IMAP needs a TCP client.
  console.log(`[email-sync] iCloud sync for ${account.email_address} - IMAP not yet available in Deno runtime`);
  return [];
}

async function syncIMAP(account: EmailAccount): Promise<ParsedEmail[]> {
  console.log(`[email-sync] Generic IMAP sync for ${account.email_address} - IMAP not yet available in Deno runtime`);
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
    const { user_id, account_id, action } = body;

    // Action: sync a specific account or all accounts for a user
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
        // Sync all active accounts (for cron job)
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
            case "gmail":
              emails = await syncGmail(account);
              break;
            case "outlook":
              emails = await syncOutlook(account);
              break;
            case "icloud":
              emails = await syncICloud(account);
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
      const { provider, credentials, email_address } = body;

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
