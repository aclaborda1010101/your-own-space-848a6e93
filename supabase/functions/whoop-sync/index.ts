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

async function refreshTokenIfNeeded(
  supabase: ReturnType<typeof createClient>,
  tokenData: any,
  clientSecret: string
): Promise<string> {
  if (new Date(tokenData.expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    return tokenData.access_token;
  }

  if (!tokenData.refresh_token) {
    throw new Error("Token expired and no refresh_token available");
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
      scope: "offline",
    }),
  });

  if (!refreshResponse.ok) {
    throw new Error("Failed to refresh token");
  }

  const newTokens = await refreshResponse.json();
  const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);

  const updateRecord: Record<string, any> = {
    access_token: newTokens.access_token,
    expires_at: newExpiresAt.toISOString(),
  };
  if (newTokens.refresh_token) updateRecord.refresh_token = newTokens.refresh_token;

  await supabase.from("whoop_tokens").update(updateRecord).eq("user_id", tokenData.user_id);
  return newTokens.access_token;
}

const ms2h = (ms: number) => ms / 3600000;

async function fetchWhoopDataForDateRange(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<Record<string, any>> {
  const dayMap: Record<string, any> = {};
  
  // Initialize days in range
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const ds = d.toISOString().split("T")[0];
    dayMap[ds] = {
      data_date: ds,
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

  // WHOOP API requires full ISO 8601 timestamps
  const startISO = `${startDate}T00:00:00.000Z`;
  const endISO = `${endDate}T23:59:59.999Z`;

  // Fetch recovery
  try {
    const res = await fetch(
      `${WHOOP_API_URL}/developer/${WHOOP_API_VERSION}/recovery?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (res.ok) {
      const data = await res.json();
      for (const rec of data.records || []) {
        const date = rec.created_at?.split("T")[0];
        if (date && dayMap[date] && rec.score) {
          const s = rec.score;
          dayMap[date].recovery_score = Math.round(s.recovery_score);
          dayMap[date].hrv = Math.round(s.hrv_rmssd_milli);
          dayMap[date].resting_hr = Math.round(s.resting_heart_rate);
          if (s.spo2_percentage != null) dayMap[date].spo2 = s.spo2_percentage;
          if (s.skin_temp_celsius != null) dayMap[date].skin_temp = s.skin_temp_celsius;
        }
      }
    }
  } catch (e) { console.error("Recovery fetch error:", e); }

  // Fetch cycles (strain)
  try {
    const res = await fetch(
      `${WHOOP_API_URL}/developer/${WHOOP_API_VERSION}/cycle?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (res.ok) {
      const data = await res.json();
      for (const rec of data.records || []) {
        const date = rec.created_at?.split("T")[0];
        if (date && dayMap[date] && rec.score) {
          dayMap[date].strain = rec.score.strain;
          if (rec.score.kilojoule != null) dayMap[date].calories = Math.round(rec.score.kilojoule * 0.239006);
          if (rec.score.average_heart_rate != null) dayMap[date].avg_hr = Math.round(rec.score.average_heart_rate);
          if (rec.score.max_heart_rate != null) dayMap[date].max_hr = Math.round(rec.score.max_heart_rate);
        }
      }
    }
  } catch (e) { console.error("Cycle fetch error:", e); }

  // Fetch sleep
  try {
    const res = await fetch(
      `${WHOOP_API_URL}/developer/${WHOOP_API_VERSION}/activity/sleep?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (res.ok) {
      const data = await res.json();
      for (const rec of data.records || []) {
        const date = rec.created_at?.split("T")[0];
        if (date && dayMap[date] && rec.score) {
          const s = rec.score;
          if (s.stage_summary) {
            const ss = s.stage_summary;
            dayMap[date].time_in_bed_hours = ms2h(ss.total_in_bed_time_milli || 0);
            dayMap[date].awake_hours = ms2h(ss.total_awake_time_milli || 0);
            dayMap[date].light_sleep_hours = ms2h(ss.total_light_sleep_time_milli || 0);
            dayMap[date].deep_sleep_hours = ms2h(ss.total_slow_wave_sleep_time_milli || 0);
            dayMap[date].rem_sleep_hours = ms2h(ss.total_rem_sleep_time_milli || 0);
            dayMap[date].disturbances = ss.disturbance_count || 0;
            dayMap[date].time_asleep_hours = dayMap[date].time_in_bed_hours - dayMap[date].awake_hours;
          }
          dayMap[date].sleep_hours = dayMap[date].time_in_bed_hours || (s.total_in_bed_time_milli ? ms2h(s.total_in_bed_time_milli) : null);
          dayMap[date].sleep_performance = s.sleep_performance_percentage ?? null;
          dayMap[date].sleep_efficiency = s.sleep_efficiency_percentage ?? null;
          dayMap[date].sleep_consistency = s.sleep_consistency_percentage ?? null;
          if (s.latency_milli != null) dayMap[date].sleep_latency_min = s.latency_milli / 60000;
          if (s.respiratory_rate != null) dayMap[date].respiratory_rate = s.respiratory_rate;
          if (s.sleep_needed) {
            if (s.sleep_needed.baseline_milli != null) dayMap[date].sleep_need_hours = ms2h(s.sleep_needed.baseline_milli);
            if (s.sleep_needed.need_from_sleep_debt_milli != null) dayMap[date].sleep_debt_hours = ms2h(s.sleep_needed.need_from_sleep_debt_milli);
          }
        }
      }
    }
  } catch (e) { console.error("Sleep fetch error:", e); }

  return dayMap;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const whoopClientSecret = Deno.env.get("WHOOP_CLIENT_SECRET");

    if (!whoopClientSecret) throw new Error("WHOOP_CLIENT_SECRET not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { action, userId, days = 1 } = await req.json();

    if (action === "sync_all_users") {
      const { data: allTokens, error: tokensError } = await supabase
        .from("whoop_tokens")
        .select("*");

      if (tokensError) throw tokensError;

      const results = [];
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      for (const tokenData of allTokens || []) {
        try {
          const accessToken = await refreshTokenIfNeeded(supabase, tokenData, whoopClientSecret);
          const dayMap = await fetchWhoopDataForDateRange(
            accessToken,
            yesterday.toISOString().split("T")[0],
            today.toISOString().split("T")[0]
          );

          const rows = Object.values(dayMap)
            .filter((v: any) => v.recovery_score !== null || v.strain !== null || v.sleep_hours !== null)
            .map((v: any) => ({
              user_id: tokenData.user_id,
              ...v,
              fetched_at: new Date().toISOString(),
            }));

          if (rows.length > 0) {
            await supabase.from("whoop_data").upsert(rows, { onConflict: "user_id,data_date" });
          }
          results.push({ userId: tokenData.user_id, status: "success" });
        } catch (e) {
          console.error("Sync error for user:", tokenData.user_id, e);
          results.push({ userId: tokenData.user_id, status: "error", error: (e as Error).message });
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "backfill" && userId) {
      const { data: tokenData, error: tokenError } = await supabase
        .from("whoop_tokens")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (tokenError || !tokenData) throw new Error("WHOOP not connected for this user");

      const accessToken = await refreshTokenIfNeeded(supabase, tokenData, whoopClientSecret);
      const daysToBackfill = Math.min(days, 90);

      // Fetch in batches of 7 days to avoid API rate limits
      const allRows: any[] = [];
      for (let i = 0; i < daysToBackfill; i += 7) {
        const batchEnd = new Date();
        batchEnd.setDate(batchEnd.getDate() - i);
        const batchStart = new Date();
        batchStart.setDate(batchStart.getDate() - Math.min(i + 6, daysToBackfill - 1));

        const dayMap = await fetchWhoopDataForDateRange(
          accessToken,
          batchStart.toISOString().split("T")[0],
          batchEnd.toISOString().split("T")[0]
        );

        for (const [, v] of Object.entries(dayMap)) {
          if ((v as any).recovery_score !== null || (v as any).strain !== null || (v as any).sleep_hours !== null) {
            allRows.push({
              user_id: userId,
              ...(v as any),
              fetched_at: new Date().toISOString(),
            });
          }
        }

        // Rate limit protection
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      if (allRows.length > 0) {
        const { error: upsertErr } = await supabase
          .from("whoop_data")
          .upsert(allRows, { onConflict: "user_id,data_date" });
        if (upsertErr) console.error("Backfill upsert error:", upsertErr);
      }

      return new Response(JSON.stringify({
        success: true,
        synced: allRows.length,
        days_requested: daysToBackfill,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action. Use: sync_all_users or backfill");
  } catch (error: unknown) {
    console.error("WHOOP Sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
