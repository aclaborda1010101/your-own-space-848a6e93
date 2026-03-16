import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_WHOOP_CLIENT_ID = "80dc3ed7-c5bf-47eb-9c9d-5873cf281c7d";
const WHOOP_CLIENT_ID = Deno.env.get("WHOOP_CLIENT_ID") || DEFAULT_WHOOP_CLIENT_ID;
const WHOOP_API_URL = "https://api.prod.whoop.com";
const WHOOP_API_VERSION = "v2";
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

    const { action, code, redirectUri, date } = await req.json();

    if (action === "get_auth_url") {
      // Generate OAuth URL
const scopes = "offline read:recovery read:cycles read:sleep read:workout read:profile";
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
      console.log("WHOOP token response keys:", Object.keys(tokens));
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

      // Store tokens (refresh_token may be null for some WHOOP grants)
      const tokenRecord: Record<string, any> = {
        user_id: user.id,
        access_token: tokens.access_token,
        expires_at: expiresAt.toISOString(),
      };
      if (tokens.refresh_token) {
        tokenRecord.refresh_token = tokens.refresh_token;
      }

      const { error: upsertError } = await supabase
        .from("whoop_tokens")
        .upsert(tokenRecord, { onConflict: "user_id" });

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

      const isExpired = tokenData?.expires_at ? new Date(tokenData.expires_at) < new Date() : true;
      const connected = !!tokenData && (!isExpired || !!tokenData.refresh_token);

      return new Response(JSON.stringify({ 
        connected,
        expiresAt: tokenData?.expires_at 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "fetch_data") {
      const { date } = await req.json().catch(() => ({}));
      
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
        if (!tokenData.refresh_token) {
          await supabase.from("whoop_tokens").delete().eq("user_id", user.id);
          throw new Error("Token expired and no refresh_token available, please reconnect");
        }

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
            scope: "offline",
          }),
        });

        if (!refreshResponse.ok) {
          await supabase.from("whoop_tokens").delete().eq("user_id", user.id);
          throw new Error("Token expired, please reconnect");
        }

        const newTokens = await refreshResponse.json();
        accessToken = newTokens.access_token;
        const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);

        const updateRecord: Record<string, any> = {
          access_token: newTokens.access_token,
          expires_at: newExpiresAt.toISOString(),
        };
        if (newTokens.refresh_token) {
          updateRecord.refresh_token = newTokens.refresh_token;
        }

        await supabase
          .from("whoop_tokens")
          .update(updateRecord)
          .eq("user_id", user.id);
      }

      // Use the requested date or default to today
      const targetDate = date || new Date().toISOString().split("T")[0];
      const prevDate = new Date(targetDate + "T00:00:00Z");
      prevDate.setDate(prevDate.getDate() - 1);
      const prevDateStr = prevDate.toISOString().split("T")[0];

      const startISO = `${prevDateStr}T00:00:00.000Z`;
      const endISO = `${targetDate}T23:59:59.999Z`;

      console.log(`[whoop-auth] Fetching data for date=${targetDate}, range ${startISO} to ${endISO}`);

      // Fetch recovery data (v2 API)
      const recoveryResponse = await fetch(
        `${WHOOP_API_URL}/developer/${WHOOP_API_VERSION}/recovery?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!recoveryResponse.ok) console.error(`[whoop-auth] Recovery API error: ${recoveryResponse.status}`);

      // Fetch cycle data for strain (v2 API)
      const cycleResponse = await fetch(
        `${WHOOP_API_URL}/developer/${WHOOP_API_VERSION}/cycle?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!cycleResponse.ok) console.error(`[whoop-auth] Cycle API error: ${cycleResponse.status}`);

      // Fetch sleep data (v2 API)
      const sleepResponse = await fetch(
        `${WHOOP_API_URL}/developer/${WHOOP_API_VERSION}/activity/sleep?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!sleepResponse.ok) console.error(`[whoop-auth] Sleep API error: ${sleepResponse.status}`);

      // Parse responses and build per-day data
      const recoveryRecords = recoveryResponse.ok ? (await recoveryResponse.json()).records || [] : [];
      const cycleRecords = cycleResponse.ok ? (await cycleResponse.json()).records || [] : [];
      const sleepRecords = sleepResponse.ok ? (await sleepResponse.json()).records || [] : [];

      console.log(`[whoop-auth] Recovery records: ${recoveryRecords.length}, Cycle: ${cycleRecords.length}, Sleep: ${sleepRecords.length}`);

      const ms2h = (ms: number) => ms / 3600000;

      // Build data for each day
      const dayMap: Record<string, any> = {};
      for (const dateStr of [prevDateStr, targetDate]) {
        dayMap[dateStr] = {
          data_date: dateStr,
          recovery_score: null, hrv: null, resting_hr: null,
          spo2: null, skin_temp: null, respiratory_rate: null,
          strain: null, calories: null, avg_hr: null, max_hr: null,
          sleep_hours: null, sleep_performance: null, sleep_efficiency: null,
          sleep_consistency: null, sleep_latency_min: null, sleep_need_hours: null,
          deep_sleep_hours: null, rem_sleep_hours: null, light_sleep_hours: null,
          awake_hours: null, disturbances: null, time_in_bed_hours: null,
          time_asleep_hours: null, sleep_debt_hours: null,
        };
      }

      for (const rec of recoveryRecords) {
        const d = rec.created_at?.split("T")[0] || rec.cycle?.days?.[0];
        if (d && dayMap[d] && rec.score) {
          const s = rec.score;
          dayMap[d].recovery_score = Math.round(s.recovery_score);
          dayMap[d].hrv = Math.round(s.hrv_rmssd_milli);
          dayMap[d].resting_hr = Math.round(s.resting_heart_rate);
          if (s.spo2_percentage != null) dayMap[d].spo2 = s.spo2_percentage;
          if (s.skin_temp_celsius != null) dayMap[d].skin_temp = s.skin_temp_celsius;
        }
      }

      for (const rec of cycleRecords) {
        const d = rec.created_at?.split("T")[0] || rec.days?.[0];
        if (d && dayMap[d] && rec.score) {
          dayMap[d].strain = rec.score.strain;
          if (rec.score.kilojoule != null) dayMap[d].calories = Math.round(rec.score.kilojoule * 0.239006);
          if (rec.score.average_heart_rate != null) dayMap[d].avg_hr = Math.round(rec.score.average_heart_rate);
          if (rec.score.max_heart_rate != null) dayMap[d].max_hr = Math.round(rec.score.max_heart_rate);
        }
      }

      for (const rec of sleepRecords) {
        const d = rec.created_at?.split("T")[0];
        if (d && dayMap[d] && rec.score) {
          const s = rec.score;
          if (s.stage_summary) {
            const ss = s.stage_summary;
            dayMap[d].time_in_bed_hours = ms2h(ss.total_in_bed_time_milli || 0);
            dayMap[d].awake_hours = ms2h(ss.total_awake_time_milli || 0);
            dayMap[d].light_sleep_hours = ms2h(ss.total_light_sleep_time_milli || 0);
            dayMap[d].deep_sleep_hours = ms2h(ss.total_slow_wave_sleep_time_milli || 0);
            dayMap[d].rem_sleep_hours = ms2h(ss.total_rem_sleep_time_milli || 0);
            dayMap[d].disturbances = ss.disturbance_count || 0;
            dayMap[d].time_asleep_hours = dayMap[d].time_in_bed_hours - dayMap[d].awake_hours;
          }
          dayMap[d].sleep_hours = dayMap[d].time_in_bed_hours || (s.total_in_bed_time_milli ? ms2h(s.total_in_bed_time_milli) : null);
          dayMap[d].sleep_performance = s.sleep_performance_percentage ?? null;
          dayMap[d].sleep_efficiency = s.sleep_efficiency_percentage ?? null;
          dayMap[d].sleep_consistency = s.sleep_consistency_percentage ?? null;
          if (s.latency_milli != null) dayMap[d].sleep_latency_min = s.latency_milli / 60000;
          if (s.respiratory_rate != null) dayMap[d].respiratory_rate = s.respiratory_rate;
          if (s.sleep_needed) {
            if (s.sleep_needed.baseline_milli != null) dayMap[d].sleep_need_hours = ms2h(s.sleep_needed.baseline_milli);
            if (s.sleep_needed.need_from_sleep_debt_milli != null) dayMap[d].sleep_debt_hours = ms2h(s.sleep_needed.need_from_sleep_debt_milli);
          }
        }
      }

      // Upsert both days
      const upsertRows = Object.entries(dayMap)
        .filter(([_, v]) => v.recovery_score !== null || v.strain !== null || v.sleep_hours !== null)
        .map(([dateStr, v]) => ({
          user_id: user.id,
          ...v,
          fetched_at: new Date().toISOString(),
        }));

      if (upsertRows.length > 0) {
        const { error: upsertErr } = await supabase
          .from("whoop_data")
          .upsert(upsertRows, { onConflict: "user_id,data_date" });
        if (upsertErr) console.error("[whoop-auth] Upsert error:", upsertErr);
      }

      // Return data for the target date (prefer target, fallback prev)
      const returnData = (dayMap[targetDate].recovery_score !== null || dayMap[targetDate].strain !== null || dayMap[targetDate].sleep_hours !== null)
        ? dayMap[targetDate]
        : dayMap[prevDateStr];

      console.log("[whoop-auth] Returning data for date:", returnData?.data_date);

      return new Response(JSON.stringify({ 
        success: true, 
        data: returnData 
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