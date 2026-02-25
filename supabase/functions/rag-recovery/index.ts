import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RAG_FARMACIAS = "8a3b722d-5def-4dc9-98f8-421f56843d63";
const RAG_PSICOLOGIA = "bcb87cf0-c4d5-47f4-8b8c-51f0e95a01c0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const results: Record<string, unknown> = {};

  try {
    // ── Step 1: Force both RAGs to building status ──────────────
    const { data: statusUpdate, error: statusErr } = await supabase
      .from("rag_projects")
      .update({
        status: "building",
        quality_verdict: null,
        updated_at: new Date().toISOString(),
      })
      .in("id", [RAG_FARMACIAS, RAG_PSICOLOGIA])
      .select("id, status, quality_verdict");

    results.status_reset = statusErr
      ? { error: statusErr.message }
      : { updated: statusUpdate };

    // ── Step 2: Trigger rag-architect post-build for BOTH RAGs ──
    const architectUrl = `${supabaseUrl}/functions/v1/rag-architect`;

    for (const [label, ragId] of [["farmacias", RAG_FARMACIAS], ["psicologia", RAG_PSICOLOGIA]] as const) {
      try {
        const resp = await fetch(architectUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            action: "post-build",
            ragId,
            step: "knowledge_graph",
          }),
        });
        const body = await resp.text();
        let parsed: unknown;
        try { parsed = JSON.parse(body); } catch { parsed = body; }
        results[`${label}_postbuild`] = { status: resp.status, body: parsed };
      } catch (e) {
        results[`${label}_postbuild`] = { error: String(e) };
      }
    }

    return new Response(JSON.stringify({ ok: true, results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err), results }, null, 2),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
