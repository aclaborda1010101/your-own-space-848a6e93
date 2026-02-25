import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RAG_FARMACIAS = "8a3b722d-5def-4dc9-98f8-421f56843d63";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const results: Record<string, unknown> = {};

  try {
    // Trigger post-build KG for Farmacias
    const architectUrl = `${supabaseUrl}/functions/v1/rag-architect`;
    const resp = await fetch(architectUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        action: "post-build",
        ragId: RAG_FARMACIAS,
        step: "knowledge_graph",
      }),
    });
    const body = await resp.text();
    let parsed: unknown;
    try { parsed = JSON.parse(body); } catch { parsed = body; }
    results.farmacias_postbuild = { status: resp.status, body: parsed };

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
