import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rag_id } = await req.json();
    if (!rag_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "rag_id required" }),
        { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }

    // Find all NEW sources for this RAG
    const { data: sources, error } = await sb
      .from("rag_sources")
      .select("id")
      .eq("rag_id", rag_id)
      .eq("status", "NEW")
      .limit(200);

    if (error) {
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }

    if (!sources?.length) {
      return new Response(
        JSON.stringify({ ok: true, enqueued: 0, message: "No NEW sources found" }),
        { headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }

    // Create FETCH jobs for each source
    const jobs = sources.map((s) => ({
      rag_id,
      job_type: "FETCH",
      source_id: s.id,
      payload: {},
    }));

    const { error: insertErr } = await sb.from("rag_jobs").insert(jobs);
    if (insertErr) {
      return new Response(
        JSON.stringify({ ok: false, error: insertErr.message }),
        { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, enqueued: jobs.length }),
      { headers: { ...corsHeaders, "content-type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } }
    );
  }
});
