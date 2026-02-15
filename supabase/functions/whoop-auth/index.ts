import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WHOOP_CLIENT_ID = "80dc3ed7-c5bf-47eb-9c9d-5873cf281c7d";
const WHOOP_API_URL = "https://api.prod.whoop.com";
const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const whoopClientSecret = Deno.env.get("WHOOP_CLIENT_SECRET");

    if (!whoopClientSecret) {
      throw new Error("WHOOP_CLIENT_SECRET not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get user from JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Invalid user token");
    }

    const { action, code, redirectUri } = await req.json();

    if (action === "get_auth_url") {
      // Generate OAuth URL
      const scopes = "read:recovery read:cycles read:sleep read:workout read:profile";
      const authUrl = `${WHOOP_AUTH_URL}/auth?client_id=${WHOOP_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${user.id}`;
      
      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "exchange_code") {
      // Exchange code for tokens
      const tokenResponse = await fetch(`${WHOOP_AUTH_URL}/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: WHOOP_CLIENT_ID,
          client_secret: whoopClientSecret,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Token exchange failed:", errorText);
        throw new Error("Failed to exchange code for tokens");
      }

      const tokens = await tokenResponse.json();
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

      // Store tokens
      const { error: upsertError } = await supabase
        .from("whoop_tokens")
        .upsert({
          user_id: user.id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt.toISOString(),
        }, { onConflict: "user_id" });

      if (upsertError) {
        console.error("Failed to store tokens:", upsertError);
        throw new Error("Failed to store tokens");
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "check_connection") {
      const { data: tokenData } = await supabase
        .from("whoop_tokens")
        .select("*")
        .eq("user_id", user.id)
        .single();

      return new Response(JSON.stringify({ 
        connected: !!tokenData,
        expiresAt: tokenData?.expires_at 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "fetch_data") {
      // Get stored tokens
      const { data: tokenData, error: tokenError } = await supabase
        .from("whoop_tokens")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (tokenError || !tokenData) {
        throw new Error("WHOOP not connected");
      }

      let accessToken = tokenData.access_token;

      // Check if token needs refresh
      if (new Date(tokenData.expires_at) < new Date()) {
        const refreshResponse = await fetch(`${WHOOP_AUTH_URL}/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: tokenData.refresh_token,
            client_id: WHOOP_CLIENT_ID,
            client_secret: whoopClientSecret,
          }),
        });

        if (!refreshResponse.ok) {
          // Token expired, need to re-auth
          await supabase.from("whoop_tokens").delete().eq("user_id", user.id);
          throw new Error("Token expired, please reconnect");
        }

        const newTokens = await refreshResponse.json();
        accessToken = newTokens.access_token;
        const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);

        await supabase
          .from("whoop_tokens")
          .update({
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token,
            expires_at: newExpiresAt.toISOString(),
          })
          .eq("user_id", user.id);
      }

      // Fetch recovery data
      const today = new Date().toISOString().split("T")[0];
      const recoveryResponse = await fetch(
        `${WHOOP_API_URL}/developer/v1/recovery?start=${today}&end=${today}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      // Fetch cycle data for strain
      const cycleResponse = await fetch(
        `${WHOOP_API_URL}/developer/v1/cycle?start=${today}&end=${today}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      // Fetch sleep data
      const sleepResponse = await fetch(
        `${WHOOP_API_URL}/developer/v1/activity/sleep?start=${today}&end=${today}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      let whoopData = {
        recovery_score: null as number | null,
        hrv: null as number | null,
        strain: null as number | null,
        sleep_hours: null as number | null,
        resting_hr: null as number | null,
        sleep_performance: null as number | null,
      };

      if (recoveryResponse.ok) {
        const recoveryData = await recoveryResponse.json();
        if (recoveryData.records?.[0]) {
          const record = recoveryData.records[0].score;
          whoopData.recovery_score = Math.round(record.recovery_score);
          whoopData.hrv = Math.round(record.hrv_rmssd_milli);
          whoopData.resting_hr = Math.round(record.resting_heart_rate);
        }
      }

      if (cycleResponse.ok) {
        const cycleData = await cycleResponse.json();
        if (cycleData.records?.[0]) {
          whoopData.strain = cycleData.records[0].score?.strain;
        }
      }

      if (sleepResponse.ok) {
        const sleepData = await sleepResponse.json();
        if (sleepData.records?.[0]) {
          const sleep = sleepData.records[0].score;
          whoopData.sleep_hours = sleep.total_in_bed_time_milli / 3600000;
          whoopData.sleep_performance = sleep.sleep_performance_percentage;
        }
      }

      // Cache the data
      await supabase
        .from("whoop_data")
        .upsert({
          user_id: user.id,
          ...whoopData,
          data_date: today,
          fetched_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      return new Response(JSON.stringify({ 
        success: true, 
        data: whoopData 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "disconnect") {
      await supabase.from("whoop_tokens").delete().eq("user_id", user.id);
      await supabase.from("whoop_data").delete().eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (error: unknown) {
    console.error("WHOOP auth error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});