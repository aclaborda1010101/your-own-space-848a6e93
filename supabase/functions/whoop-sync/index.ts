import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WHOOP_CLIENT_ID = "80dc3ed7-c5bf-47eb-9c9d-5873cf281c7d";
const WHOOP_API_URL = "https://api.prod.whoop.com";
const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2";

interface WhoopData {
  recovery_score: number | null;
  hrv: number | null;
  strain: number | null;
  sleep_hours: number | null;
  resting_hr: number | null;
  sleep_performance: number | null;
  data_date: string;
  raw_data: Record<string, unknown>;
}

async function refreshTokenIfNeeded(
  supabase: ReturnType<typeof createClient>,
  tokenData: { user_id: string; access_token: string; refresh_token: string; expires_at: string },
  clientSecret: string
): Promise<string> {
  // Check if token needs refresh (with 5 min buffer)
  if (new Date(tokenData.expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    return tokenData.access_token;
  }

  console.log("Refreshing WHOOP token for user:", tokenData.user_id);

  const refreshResponse = await fetch(`${WHOOP_AUTH_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokenData.refresh_token,
      client_id: WHOOP_CLIENT_ID,
      client_secret: clientSecret,
    }),
  });

  if (!refreshResponse.ok) {
    throw new Error("Failed to refresh token");
  }

  const newTokens = await refreshResponse.json();
  const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);

  await supabase.from("whoop_tokens").update({
    access_token: newTokens.access_token,
    refresh_token: newTokens.refresh_token,
    expires_at: newExpiresAt.toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", tokenData.user_id);

  return newTokens.access_token;
}

async function fetchWhoopDataForDate(
  accessToken: string,
  date: string
): Promise<WhoopData> {
  const result: WhoopData = {
    recovery_score: null,
    hrv: null,
    strain: null,
    sleep_hours: null,
    resting_hr: null,
    sleep_performance: null,
    data_date: date,
    raw_data: {},
  };

  // Fetch recovery
  try {
    const recoveryResponse = await fetch(
      `${WHOOP_API_URL}/developer/v1/recovery?start=${date}&end=${date}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (recoveryResponse.ok) {
      const recoveryData = await recoveryResponse.json();
      if (recoveryData.records?.[0]) {
        const record = recoveryData.records[0].score;
        result.recovery_score = Math.round(record.recovery_score);
        result.hrv = Math.round(record.hrv_rmssd_milli);
        result.resting_hr = Math.round(record.resting_heart_rate);
        result.raw_data.recovery = recoveryData.records[0];
      }
    }
  } catch (e) {
    console.error("Recovery fetch error:", e);
  }

  // Fetch cycle (strain)
  try {
    const cycleResponse = await fetch(
      `${WHOOP_API_URL}/developer/v1/cycle?start=${date}&end=${date}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (cycleResponse.ok) {
      const cycleData = await cycleResponse.json();
      if (cycleData.records?.[0]) {
        result.strain = cycleData.records[0].score?.strain;
        result.raw_data.cycle = cycleData.records[0];
      }
    }
  } catch (e) {
    console.error("Cycle fetch error:", e);
  }

  // Fetch sleep
  try {
    const sleepResponse = await fetch(
      `${WHOOP_API_URL}/developer/v1/activity/sleep?start=${date}&end=${date}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (sleepResponse.ok) {
      const sleepData = await sleepResponse.json();
      if (sleepData.records?.[0]) {
        const sleep = sleepData.records[0].score;
        result.sleep_hours = sleep.total_in_bed_time_milli / 3600000;
        result.sleep_performance = sleep.sleep_performance_percentage;
        result.raw_data.sleep = sleepData.records[0];
      }
    }
  } catch (e) {
    console.error("Sleep fetch error:", e);
  }

  // Fetch workouts
  try {
    const workoutResponse = await fetch(
      `${WHOOP_API_URL}/developer/v1/activity/workout?start=${date}&end=${date}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (workoutResponse.ok) {
      const workoutData = await workoutResponse.json();
      if (workoutData.records?.length > 0) {
        result.raw_data.workouts = workoutData.records;
      }
    }
  } catch (e) {
    console.error("Workout fetch error:", e);
  }

  return result;
}

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

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { action, userId, days = 1 } = await req.json();

    if (action === "sync_all_users") {
      // Cron job: sync all users with WHOOP connected
      const { data: allTokens, error: tokensError } = await supabase
        .from("whoop_tokens")
        .select("*");

      if (tokensError) throw tokensError;

      const results = [];
      const today = new Date().toISOString().split("T")[0];

      for (const tokenData of allTokens || []) {
        try {
          const accessToken = await refreshTokenIfNeeded(supabase, tokenData, whoopClientSecret);
          const whoopData = await fetchWhoopDataForDate(accessToken, today);

          await supabase.from("whoop_data").upsert({
            user_id: tokenData.user_id,
            ...whoopData,
            fetched_at: new Date().toISOString(),
          }, { onConflict: "user_id,data_date" });

          results.push({ userId: tokenData.user_id, status: "success" });
        } catch (e) {
          console.error("Sync error for user:", tokenData.user_id, e);
          results.push({ userId: tokenData.user_id, status: "error", error: (e as Error).message });
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        synced: results.filter(r => r.status === "success").length,
        failed: results.filter(r => r.status === "error").length,
        results 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "sync_user" && userId) {
      // Sync specific user, optionally for multiple days
      const { data: tokenData, error: tokenError } = await supabase
        .from("whoop_tokens")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (tokenError || !tokenData) {
        throw new Error("WHOOP not connected for this user");
      }

      const accessToken = await refreshTokenIfNeeded(supabase, tokenData, whoopClientSecret);
      const results = [];

      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        const whoopData = await fetchWhoopDataForDate(accessToken, dateStr);

        await supabase.from("whoop_data").upsert({
          user_id: userId,
          ...whoopData,
          fetched_at: new Date().toISOString(),
        }, { onConflict: "user_id,data_date" });

        results.push({ date: dateStr, data: whoopData });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        synced: results.length,
        results 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "backfill" && userId) {
      // Backfill historical data (up to 30 days)
      const { data: tokenData, error: tokenError } = await supabase
        .from("whoop_tokens")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (tokenError || !tokenData) {
        throw new Error("WHOOP not connected for this user");
      }

      const accessToken = await refreshTokenIfNeeded(supabase, tokenData, whoopClientSecret);
      const daysToBackfill = Math.min(days, 30);
      const results = [];

      for (let i = 0; i < daysToBackfill; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        // Check if we already have data for this date
        const { data: existing } = await supabase
          .from("whoop_data")
          .select("id")
          .eq("user_id", userId)
          .eq("data_date", dateStr)
          .single();

        if (existing) {
          results.push({ date: dateStr, status: "skipped" });
          continue;
        }

        const whoopData = await fetchWhoopDataForDate(accessToken, dateStr);

        if (whoopData.recovery_score || whoopData.sleep_hours) {
          await supabase.from("whoop_data").insert({
            user_id: userId,
            ...whoopData,
            fetched_at: new Date().toISOString(),
          });
          results.push({ date: dateStr, status: "synced" });
        } else {
          results.push({ date: dateStr, status: "no_data" });
        }

        // Rate limit protection
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return new Response(JSON.stringify({ 
        success: true, 
        synced: results.filter(r => r.status === "synced").length,
        skipped: results.filter(r => r.status === "skipped").length,
        results 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action. Use: sync_all_users, sync_user, or backfill");

  } catch (error: unknown) {
    console.error("WHOOP Sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
