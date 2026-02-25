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

  const results: Record<string, unknown> = {};

  try {
    const architectUrl = `${supabaseUrl}/functions/v1/rag-architect`;

    // Trigger post-build KG for Farmacias
    const resp1 = await fetch(architectUrl, {
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
    const body1 = await resp1.text();
    let parsed1: unknown;
    try { parsed1 = JSON.parse(body1); } catch { parsed1 = body1; }
    results.farmacias_postbuild = { status: resp1.status, body: parsed1 };

    // Trigger post-build KG for Psicología
    const resp2 = await fetch(architectUrl, {
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
    });
    const body2 = await resp2.text();
    let parsed2: unknown;
    try { parsed2 = JSON.parse(body2); } catch { parsed2 = body2; }
    results.psicologia_postbuild = { status: resp2.status, body: parsed2 };

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
