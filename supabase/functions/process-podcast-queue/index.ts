// process-podcast-queue
// Called every minute by pg_cron. Picks pending jobs and dispatches them to
// generate-contact-podcast-segment. Stays simple: max N jobs per tick.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_PER_TICK = 3;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { data: jobs } = await supabase
      .from("podcast_generation_queue")
      .select("*")
      .eq("status", "pending")
      .lt("attempts", 3)
      .order("created_at", { ascending: true })
      .limit(MAX_PER_TICK);

    if (!jobs || jobs.length === 0) {
      return jsonResp({ ok: true, processed: 0 });
    }

    const results: unknown[] = [];
    for (const job of jobs) {
      // Mark processing
      await supabase
        .from("podcast_generation_queue")
        .update({
          status: "processing",
          attempts: (job.attempts || 0) + 1,
        })
        .eq("id", job.id);

      try {
        const r = await fetch(
          `${SUPABASE_URL}/functions/v1/generate-contact-podcast-segment`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SERVICE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contactId: job.contact_id,
              userId: job.user_id,
              format: job.format,
              force_full_regenerate: job.force_full_regenerate,
            }),
          },
        );
        const txt = await r.text();
        if (r.ok) {
          await supabase
            .from("podcast_generation_queue")
            .update({
              status: "done",
              processed_at: new Date().toISOString(),
            })
            .eq("id", job.id);
          results.push({ id: job.id, ok: true });
        } else {
          await supabase
            .from("podcast_generation_queue")
            .update({
              status: "error",
              error_message: txt.slice(0, 500),
              processed_at: new Date().toISOString(),
            })
            .eq("id", job.id);
          results.push({ id: job.id, ok: false, error: txt.slice(0, 200) });
        }
      } catch (e) {
        await supabase
          .from("podcast_generation_queue")
          .update({
            status: "error",
            error_message: String(e).slice(0, 500),
            processed_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        results.push({ id: job.id, ok: false, error: String(e) });
      }
    }

    return jsonResp({ ok: true, processed: results.length, results });
  } catch (err) {
    console.error("process-podcast-queue error:", err);
    return jsonResp({ error: String(err) }, 500);
  }
});

function jsonResp(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
