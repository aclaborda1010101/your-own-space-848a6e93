import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const WHATSAPP_API_TOKEN = Deno.env.get("WHATSAPP_API_TOKEN");
  const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID");

  if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_ID) {
    console.error("[send-whatsapp] Missing WHATSAPP_API_TOKEN or WHATSAPP_PHONE_ID");
    return new Response(JSON.stringify({ error: "WhatsApp not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { user_id, phone, message } = await req.json();

    let targetPhone = phone;

    // If no phone provided, look up from platform_users
    if (!targetPhone && user_id) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: platformUser } = await supabase
        .from("platform_users")
        .select("phone")
        .eq("user_id", user_id)
        .eq("platform", "whatsapp")
        .maybeSingle();

      targetPhone = platformUser?.phone;
    }

    if (!targetPhone) {
      return new Response(JSON.stringify({ error: "No phone number found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send via Meta WhatsApp API
    const waResponse = await fetch(
      `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: targetPhone.replace(/\D/g, ""),
          type: "text",
          text: { body: message },
        }),
      }
    );

    const waData = await waResponse.json();

    if (!waResponse.ok) {
      console.error("[send-whatsapp] Meta API error:", JSON.stringify(waData));
      return new Response(JSON.stringify({ error: "WhatsApp send failed", details: waData }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[send-whatsapp] Message sent to ${targetPhone.slice(-4)}`);

    return new Response(JSON.stringify({ success: true, message_id: waData.messages?.[0]?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-whatsapp] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
