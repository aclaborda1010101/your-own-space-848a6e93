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
    // ── Step A: Farmacias ──────────────────────────────────────
    // 1. Set status to building (constraint only allows: domain_analysis, waiting_confirmation, researching, building, completed, failed, cancelled)
    const { data: farmStatus, error: farmStatusErr } = await supabase
      .from("rag_projects")
      .update({ status: "building", updated_at: new Date().toISOString() })
      .eq("id", RAG_FARMACIAS)
      .select("id, status");

    results.farmacias_status = farmStatusErr
      ? { error: farmStatusErr.message }
      : { updated: farmStatus };

    // 2. Unlock stale PENDING/RETRY jobs
    const { data: unlockedJobs, error: unlockErr } = await supabase
      .from("rag_jobs")
      .update({
        status: "PENDING",
        locked_by: null,
        locked_at: null,
        run_after: new Date().toISOString(),
      })
      .eq("rag_id", RAG_FARMACIAS)
      .in("status", ["PENDING", "RETRY"])
      .select("id");

    results.farmacias_jobs_unlocked = unlockErr
      ? { error: unlockErr.message }
      : { count: unlockedJobs?.length ?? 0 };

    // 3. Fire-and-forget: kick rag-job-runner
    const jobRunnerUrl = `${supabaseUrl}/functions/v1/rag-job-runner`;
    fetch(jobRunnerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ rag_id: RAG_FARMACIAS, maxJobs: 20 }),
    }).catch((e) => console.error("rag-job-runner kick failed:", e));

    results.farmacias_runner_kicked = true;

    // ── Step B: Psicología ─────────────────────────────────────
    // 1. Set status to building, clear quality_verdict
    const { data: psiStatus, error: psiStatusErr } = await supabase
      .from("rag_projects")
      .update({
        status: "building",
        quality_verdict: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", RAG_PSICOLOGIA)
      .select("id, status");

    results.psicologia_status = psiStatusErr
      ? { error: psiStatusErr.message }
      : { updated: psiStatus };

    // 2. Fire-and-forget: kick rag-architect post-build
    const architectUrl = `${supabaseUrl}/functions/v1/rag-architect`;
    fetch(architectUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        action: "post-build",
        ragId: RAG_PSICOLOGIA,
        step: "knowledge_graph",
      }),
    }).catch((e) => console.error("rag-architect kick failed:", e));

    results.psicologia_postbuild_kicked = true;

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err), results }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
