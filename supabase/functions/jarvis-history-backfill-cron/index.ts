// JARVIS History Backfill Cron
// Runs every 5 min. Processes:
//   1. Pending ingestion jobs queue (priority)
//   2. If queue empty: rotates through source_types for the active user(s)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const SOURCE_ROTATION = ["whatsapp", "email", "transcription", "plaud"];

async function callIngest(body: Record<string, unknown>): Promise<any> {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/jarvis-history-ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    return { ok: false, status: r.status, text: await r.text() };
  }
  return await r.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const startedAt = Date.now();
    const log: any[] = [];

    // 1) Drain pending jobs from queue
    const queueResult = await callIngest({ mode: "queue", batch_size: 30 });
    log.push({ phase: "queue", ...queueResult });

    // 2) Discover active users (users that have data to process)
    const { data: users } = await sb
      .from("user_directory")
      .select("id")
      .limit(20);

    const activeUserIds = (users || []).map((u: any) => u.id);

    // 3) Rotate backfill across source types — small batches per user
    for (const userId of activeUserIds) {
      // Pick rotation slot based on time
      const slot = Math.floor(Date.now() / (5 * 60 * 1000)) % SOURCE_ROTATION.length;
      const sourceType = SOURCE_ROTATION[slot];

      const r = await callIngest({
        mode: "backfill",
        user_id: userId,
        source_type: sourceType,
        batch_size: 25,
        days: 90,
      });
      log.push({ phase: "backfill", user_id: userId, source_type: sourceType, ...r });

      // Stop if we've spent too long (cron should be quick)
      if (Date.now() - startedAt > 50000) {
        log.push({ phase: "timeout-stop" });
        break;
      }
    }

    return new Response(JSON.stringify({ success: true, log, elapsed_ms: Date.now() - startedAt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[backfill-cron] fatal:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
