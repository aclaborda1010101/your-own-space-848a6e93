import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INSTANCE_NAME = "alpha3";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, phone, contact_id, message } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
        .select("wa_id, phone_numbers, name")
        .eq("id", contact_id)
        .maybeSingle();

      if (contactData) {
        targetPhone = contactData.wa_id || contactData.phone_numbers?.[0];
        
        // If still no phone, log clearly
        if (!targetPhone) {
          console.log(`[send-whatsapp] Contact "${contactData.name}" has no wa_id or phone_numbers`);
        }
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
      return new Response(JSON.stringify({ 
        error: "No phone number found",
        detail: "Este contacto no tiene número de WhatsApp (wa_id) asociado. Edita el contacto y añade su número de teléfono, o espera a recibir un mensaje directo suyo para que se capture automáticamente."
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean phone number
    const cleanPhone = targetPhone.replace(/\D/g, "");

    // Try Evolution API first (personal WhatsApp)
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");

    let sent = false;
    let messageId: string | undefined;

    if (EVOLUTION_API_URL && EVOLUTION_API_KEY) {
      try {
        const evoUrl = `${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`;
        console.log(`[send-whatsapp] Sending via Evolution API to ...${cleanPhone.slice(-4)}`);
        
        const evoResponse = await fetch(evoUrl, {
          method: "POST",
          headers: {
            "apikey": EVOLUTION_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            number: cleanPhone,
            text: message,
          }),
        });

        const evoData = await evoResponse.json();

        if (evoResponse.ok && evoData?.key?.id) {
          sent = true;
          messageId = evoData.key.id;
          console.log(`[send-whatsapp] Sent via Evolution API, msgId: ${messageId}`);
        } else {
          console.error("[send-whatsapp] Evolution API error:", JSON.stringify(evoData));
        }
      } catch (evoErr) {
        console.error("[send-whatsapp] Evolution API exception:", evoErr);
      }
    }

    // Fallback to Meta WhatsApp API
    if (!sent) {
      const WHATSAPP_API_TOKEN = Deno.env.get("WHATSAPP_API_TOKEN");
      const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID");

      if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_ID) {
        return new Response(JSON.stringify({ error: "WhatsApp not configured (neither Evolution nor Meta API available)" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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

      sent = true;
      messageId = waData.messages?.[0]?.id;
      console.log(`[send-whatsapp] Sent via Meta API to ...${cleanPhone.slice(-4)}`);
    }

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

    return new Response(JSON.stringify({ success: true, message_id: messageId }), {
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
