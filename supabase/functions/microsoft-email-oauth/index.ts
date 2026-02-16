import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MICROSOFT_CLIENT_ID = Deno.env.get("MICROSOFT_CLIENT_ID")!;
const MICROSOFT_CLIENT_SECRET = Deno.env.get("MICROSOFT_CLIENT_SECRET")!;

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/microsoft-email-oauth?action=callback`;

const SCOPES = "Mail.Read offline_access User.Read";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  let action = url.searchParams.get("action");

  let body: any = null;
  if (req.method === "POST") {
    body = await req.json();
    if (!action && body?.action) {
      action = body.action;
    }
  }

  try {
    // ── START: generate Microsoft auth URL ──
    if (action === "start") {
      if (!body) body = {};
      const accountId = body.account_id;
      if (!accountId) {
        return new Response(
          JSON.stringify({ error: "account_id required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const origin = body.origin || "https://pure-logic-flow.lovable.app";
      const state = btoa(JSON.stringify({ account_id: accountId, origin }));

      const params = new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        scope: SCOPES,
        response_mode: "query",
        prompt: "consent",
        state,
      });

      if (body.login_hint) {
        params.set("login_hint", body.login_hint);
      }

      const authUrl = `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?${params}`;

      return new Response(
        JSON.stringify({ url: authUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── CALLBACK: exchange code for tokens ──
    if (action === "callback") {
      const code = url.searchParams.get("code");
      const stateRaw = url.searchParams.get("state");
      const errorParam = url.searchParams.get("error");
      const errorDesc = url.searchParams.get("error_description");

      if (errorParam) {
        return redirectWithError(stateRaw, `Microsoft denied: ${errorDesc || errorParam}`);
      }
      if (!code || !stateRaw) {
        return redirectWithError(stateRaw, "Missing code or state");
      }

      let state: { account_id: string; origin: string };
      try {
        state = JSON.parse(atob(stateRaw));
      } catch {
        return new Response("Invalid state", { status: 400 });
      }

      // Exchange code for tokens
      const tokenRes = await fetch("https://login.microsoftonline.com/consumers/oauth2/v2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: MICROSOFT_CLIENT_ID,
          client_secret: MICROSOFT_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
          scope: SCOPES,
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.access_token) {
        console.error("Token exchange failed:", tokenData);
        return redirectWithError(
          stateRaw,
          tokenData.error_description || "Token exchange failed"
        );
      }

      // Get user info from Microsoft Graph
      const userInfoRes = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userInfo = await userInfoRes.json();

      // Save tokens to email_accounts
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { error: updateError } = await supabase
        .from("email_accounts")
        .update({
          credentials_encrypted: {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || null,
            token_type: tokenData.token_type,
            expires_in: tokenData.expires_in,
            obtained_at: new Date().toISOString(),
            email: userInfo.mail || userInfo.userPrincipalName,
          },
          sync_error: null,
        })
        .eq("id", state.account_id);

      if (updateError) {
        console.error("DB update error:", updateError);
        return redirectWithError(stateRaw, "Error saving tokens");
      }

      console.log(`OAuth tokens saved for account ${state.account_id} (${userInfo.mail || userInfo.userPrincipalName})`);

      const redirectUrl = `${state.origin}/settings?outlook_connected=true`;
      return new Response(null, {
        status: 302,
        headers: { Location: redirectUrl },
      });
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Use ?action=start or ?action=callback" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("microsoft-email-oauth error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function redirectWithError(stateRaw: string | null, message: string): Response {
  let origin = "https://pure-logic-flow.lovable.app";
  try {
    if (stateRaw) {
      const s = JSON.parse(atob(stateRaw));
      if (s.origin) origin = s.origin;
    }
  } catch { /* ignore */ }

  const redirectUrl = `${origin}/settings?outlook_error=${encodeURIComponent(message)}`;
  return new Response(null, {
    status: 302,
    headers: { Location: redirectUrl },
  });
}
