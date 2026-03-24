import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (i === retries) throw err;
      console.warn(`Fetch attempt ${i + 1} failed, retrying...`, String(err));
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw new Error("Unreachable");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const INSTANCE_NAME = Deno.env.get("EVOLUTION_INSTANCE_NAME") || "jarvis-whatsapp";

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Evolution API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, instanceName } = await req.json();
    const instance = instanceName || INSTANCE_NAME;

    const evoHeaders = {
      "Content-Type": "application/json",
      apikey: EVOLUTION_API_KEY,
    };

    const baseUrl = EVOLUTION_API_URL.replace(/\/+$/, "");

    switch (action) {
      case "create_instance": {
        const webhookUrl = `${SUPABASE_URL}/functions/v1/evolution-webhook`;

        const res = await fetchWithRetry(`${baseUrl}/instance/create`, {
          method: "POST",
          headers: evoHeaders,
          body: JSON.stringify({
            instanceName: instance,
            integration: "WHATSAPP-BAILEYS",
            qrcode: true,
            webhook: {
              url: webhookUrl,
              byEvents: false,
              base64: false,
              headers: {},
              events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
            },
          }),
        });

        const data = await res.json();
        console.log("create_instance response:", JSON.stringify(data).substring(0, 500));

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_qr": {
        const res = await fetchWithRetry(`${baseUrl}/instance/connect/${instance}`, {
          method: "GET",
          headers: evoHeaders,
        });

        const data = await res.json();
        console.log("get_qr response keys:", Object.keys(data || {}));
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "status": {
        const res = await fetchWithRetry(
          `${baseUrl}/instance/connectionState/${instance}`,
          { method: "GET", headers: evoHeaders }
        );

        const data = await res.json();
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "disconnect": {
        const res = await fetchWithRetry(`${baseUrl}/instance/logout/${instance}`, {
          method: "DELETE",
          headers: evoHeaders,
        });

        const data = await res.json();
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err) {
    console.error("evolution-manage-v2 error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
