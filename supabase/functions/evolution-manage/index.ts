import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Evolution API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, instanceName } = await req.json();
    const instance = instanceName || "jarvis-whatsapp";

    const evoHeaders = {
      "Content-Type": "application/json",
      apikey: EVOLUTION_API_KEY,
    };

    // Helper to normalize base URL
    const baseUrl = EVOLUTION_API_URL.replace(/\/+$/, "");

    switch (action) {
      case "create_instance": {
        // Create instance with webhook pointing to our evolution-webhook
        const webhookUrl = `${SUPABASE_URL}/functions/v1/evolution-webhook`;

        const res = await fetch(`${baseUrl}/instance/create`, {
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
              events: [
                "MESSAGES_UPSERT",
                "CONNECTION_UPDATE",
              ],
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
        const res = await fetch(`${baseUrl}/instance/connect/${instance}`, {
          method: "GET",
          headers: evoHeaders,
        });

        const data = await res.json();
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "status": {
        const res = await fetch(
          `${baseUrl}/instance/connectionState/${instance}`,
          { method: "GET", headers: evoHeaders }
        );

        const data = await res.json();
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "disconnect": {
        const res = await fetch(`${baseUrl}/instance/logout/${instance}`, {
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
    console.error("evolution-manage error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
