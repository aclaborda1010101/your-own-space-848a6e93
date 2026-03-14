import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { project_id, document_text, project_name, project_description } = await req.json();

    if (!document_text || !project_name) {
      return new Response(JSON.stringify({ error: "Se requiere document_text y project_name" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const EXPERT_FORGE_API_KEY = Deno.env.get("EXPERT_FORGE_API_KEY");

    if (!EXPERT_FORGE_API_KEY) {
      return new Response(JSON.stringify({ error: "Expert Forge no está configurado. Añade EXPERT_FORGE_API_KEY." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GATEWAY_URL = "https://nhfocnjtgwuamelovncq.supabase.co/functions/v1/api-gateway";

    const callGateway = async (payload: Record<string, unknown>) => {
      return await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          "x-api-key": EXPERT_FORGE_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    };

    const basePayload = {
      action: "architect",
      mode: "prd",
      user_id: userId,
      project_name,
      project_description: project_description || "",
      document_text: document_text.slice(0, 200000),
    };

    let forgeResponse = await callGateway({ ...basePayload, project_id });

    if (!forgeResponse.ok) {
      let errText = await forgeResponse.text();
      const missingProject = forgeResponse.status === 404 && /project not found/i.test(errText);

      if (missingProject) {
        console.warn("[publish-to-forge] Project not found in Expert Forge, retrying without project_id");
        forgeResponse = await callGateway(basePayload);
        if (!forgeResponse.ok) {
          errText = await forgeResponse.text();
        }
      }

      if (!forgeResponse.ok) {
        console.error("[publish-to-forge] Expert Forge error:", forgeResponse.status, errText);
        return new Response(JSON.stringify({
          error: `Expert Forge respondió con error ${forgeResponse.status}`,
          details: errText.slice(0, 500),
        }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const result = await forgeResponse.json();

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[publish-to-forge] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
