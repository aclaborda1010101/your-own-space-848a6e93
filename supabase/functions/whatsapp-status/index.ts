import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("WHATSAPP_API_TOKEN");
    const phoneId = Deno.env.get("WHATSAPP_PHONE_ID");

    if (!token || !phoneId) {
      return new Response(JSON.stringify({
        connected: false,
        error: "missing_credentials",
        message: "WHATSAPP_API_TOKEN o WHATSAPP_PHONE_ID no configurados",
        phone_id: phoneId ? "✓" : "✗",
        token: token ? "✓" : "✗",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check WhatsApp Business API phone number status
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}?fields=verified_name,quality_rating,display_phone_number,name_status,code_verification_status`,
      {
        headers: { "Authorization": `Bearer ${token}` },
      }
    );

    const data = await res.json();

    if (!res.ok) {
      // Token expired or invalid
      const errorCode = data?.error?.code;
      const errorSubcode = data?.error?.error_subcode;
      const isTokenExpired = errorCode === 190 || errorSubcode === 463;
      
      return new Response(JSON.stringify({
        connected: false,
        error: isTokenExpired ? "token_expired" : "api_error",
        message: isTokenExpired 
          ? "El token de WhatsApp ha expirado. Genera uno nuevo en Meta Business Suite."
          : (data?.error?.message || "Error al conectar con la API de WhatsApp"),
        details: data?.error,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Self-test webhook endpoint to verify it's live
    let webhookSubscribed = false;
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const challenge = "status-check-" + Date.now();
      const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "jarvis-verify-token";
      const testUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=${challenge}`;
      const webhookRes = await fetch(testUrl);
      const webhookBody = await webhookRes.text();
      webhookSubscribed = webhookRes.ok && webhookBody.trim() === challenge;
      console.log("[whatsapp-status] Webhook self-test:", webhookSubscribed ? "OK" : "FAIL", webhookBody.substring(0, 50));
    } catch (e) {
      console.log("[whatsapp-status] Webhook self-test error:", e);
    }

    return new Response(JSON.stringify({
      connected: true,
      phone_number: data.display_phone_number || null,
      verified_name: data.verified_name || null,
      quality_rating: data.quality_rating || null,
      name_status: data.name_status || null,
      webhook_subscribed: webhookSubscribed,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({
      connected: false,
      error: "unknown",
      message: String(err),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
