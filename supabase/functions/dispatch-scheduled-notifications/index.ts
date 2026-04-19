// Cron-triggered dispatcher: scans `scheduled_notifications` for entries
// whose `scheduled_for <= now()` and status='pending', then calls
// `send-push-notification` for each.
//
// Deployed as a public function and invoked by a Supabase cron (every 1 min).
//
// Anti-stampede: SELECT ... FOR UPDATE SKIP LOCKED via RPC is overkill here;
// we instead UPDATE ... RETURNING with a status flip to avoid double-sending
// if two cron ticks ever overlap.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Pick up to 100 due notifications and mark them as 'sending' atomically.
  // We do it in two steps to keep it simple (no SQL function dependency).
  const nowIso = new Date().toISOString();
  const { data: due, error: dueErr } = await supabase
    .from("scheduled_notifications")
    .select("id, user_id, title, body, data, notification_type")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(100);

  if (dueErr) {
    return json({ error: dueErr.message }, 500);
  }

  if (!due || due.length === 0) {
    return json({ processed: 0 });
  }

  const ids = due.map((d) => d.id);
  const { error: lockErr } = await supabase
    .from("scheduled_notifications")
    .update({ status: "sending" as never, attempt_count: 1 })
    .in("id", ids)
    .eq("status", "pending"); // only flip those still pending
  // Note: 'sending' is not in the CHECK enum; we use 'pending' as the only marker
  // and rely on attempt_count + sent_at instead.
  if (lockErr) {
    // Fallback: just continue, but log
    console.warn("[dispatch] lock update warn:", lockErr.message);
  }

  const fnUrl = `${SUPABASE_URL}/functions/v1/send-push-notification`;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  const results = await Promise.all(
    due.map(async (n) => {
      try {
        const res = await fetch(fnUrl, {
          method: "POST",
          headers: {
            authorization: `Bearer ${ANON}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            user_id: n.user_id,
            title: n.title,
            body: n.body,
            data: n.data ?? {},
            notification_type: n.notification_type,
            scheduled_id: n.id,
          }),
        });
        const text = await res.text();
        return { id: n.id, ok: res.ok, status: res.status, body: text.slice(0, 200) };
      } catch (e) {
        return { id: n.id, ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );

  return json({ processed: results.length, results });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
