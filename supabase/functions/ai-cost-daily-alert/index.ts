// Daily alert: notifies when AUTOMATIC AI consumption (last 24h) exceeds threshold.
// Manual operations (chat, project wizard, audits) are excluded.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Edit these to tune the alert.
const THRESHOLD_USD = 0.10;

// Operations considered MANUAL (excluded from automatic-consumption sum).
const MANUAL_OPERATIONS = new Set<string>([
  "chat",
  "ai-client:chat",
  "jarvis-chat",
  "potus-chat",
  "budget_estimation",
  "extract_briefing",
  "ai_audit_internal",
  "generate_scope_internal",
  "project-wizard-step",
  "expert-forge",
  "pattern-detector",
  "generate-prd",
]);

// deno-lint-ignore no-explicit-any
const supabase: any = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await supabase
      .from("project_costs")
      .select("operation, cost_usd")
      .gte("created_at", since);
    if (error) throw error;

    const auto = (rows ?? []).filter((r: any) => !MANUAL_OPERATIONS.has(r.operation));
    const totalAuto = auto.reduce((s: number, r: any) => s + Number(r.cost_usd || 0), 0);

    // Group breakdown
    const byOp: Record<string, number> = {};
    for (const r of auto) {
      byOp[r.operation] = (byOp[r.operation] || 0) + Number(r.cost_usd || 0);
    }
    const breakdown = Object.entries(byOp)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([op, c]) => `${op}: $${c.toFixed(4)}`)
      .join(" · ");

    let alerted = false;
    if (totalAuto >= THRESHOLD_USD) {
      // Idempotency: skip if an alert already created in the last 22h
      const { data: recent } = await supabase
        .from("jarvis_notifications")
        .select("id")
        .eq("type", "ai_cost_auto_alert")
        .gte("created_at", new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (!recent || recent.length === 0) {
        await supabase.from("jarvis_notifications").insert({
          type: "ai_cost_auto_alert",
          title: `⚠️ Consumo IA automático: $${totalAuto.toFixed(4)} (24h)`,
          body: `Umbral: $${THRESHOLD_USD.toFixed(2)}. Top: ${breakdown || "(sin desglose)"}`,
        });
        alerted = true;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        threshold_usd: THRESHOLD_USD,
        total_auto_usd: Number(totalAuto.toFixed(6)),
        alerted,
        breakdown: byOp,
        manual_excluded: [...MANUAL_OPERATIONS],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
