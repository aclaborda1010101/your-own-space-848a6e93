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
    const { user_id, phone, contact_id, message } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let targetPhone = phone;
    let resolvedContactId = contact_id;

    // If contact_id provided, resolve phone from people_contacts
    if (!targetPhone && contact_id) {
      const { data: contactData } = await supabase
        .from("people_contacts")
        .select("wa_id, phone_numbers")
        .eq("id", contact_id)
        .maybeSingle();

      if (contactData) {
        targetPhone = contactData.wa_id || contactData.phone_numbers?.[0];
      }
    }

    // Fallback: look up from platform_users
    if (!targetPhone && user_id) {
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
    const cleanPhone = targetPhone.replace(/\D/g, "");
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
          to: cleanPhone,
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

    console.log(`[send-whatsapp] Message sent to ${cleanPhone.slice(-4)}`);

    // Persist outgoing message in contact_messages if we have a contact_id
    if (resolvedContactId) {
      const crmUserId = user_id || Deno.env.get("EVOLUTION_DEFAULT_USER_ID");
      if (crmUserId) {
        const { error: persistErr } = await supabase
          .from("contact_messages")
          .insert({
            contact_id: resolvedContactId,
            user_id: crmUserId,
            content: message,
            direction: "outgoing",
            sender: "Yo",
            source: "whatsapp",
            message_date: new Date().toISOString(),
          });

        if (persistErr) {
          console.error("[send-whatsapp] Error persisting outgoing message:", persistErr);
        } else {
          console.log(`[send-whatsapp] Outgoing message persisted for contact ${resolvedContactId}`);
        }
      }
    }

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
