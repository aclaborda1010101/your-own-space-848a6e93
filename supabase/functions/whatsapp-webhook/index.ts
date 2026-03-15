import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WHATSAPP_API_TOKEN = Deno.env.get("WHATSAPP_API_TOKEN");
const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID");
const WHATSAPP_VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "jarvis-verify-token";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendWhatsAppMessage(to: string, text: string) {
  const cleanPhone = to.replace(/\D/g, "");
  const url = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WHATSAPP_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: cleanPhone,
      type: "text",
      text: { body: text },
    }),
  });
  const resText = await res.text();
  if (!res.ok) {
    console.error("WhatsApp send error:", resText, "| Sent to:", cleanPhone);
  } else {
    console.log("[WhatsApp] Message sent successfully to", cleanPhone);
  }
}

async function resolveUserId(
  supabase: ReturnType<typeof createClient>,
  phoneNumber: string
): Promise<string | null> {
  const { data } = await supabase
    .from("platform_users")
    .select("user_id")
    .eq("platform", "whatsapp")
    .eq("platform_user_id", phoneNumber)
    .single();

  return data?.user_id || null;
}

async function handleLinkCode(
  supabase: ReturnType<typeof createClient>,
  phoneNumber: string,
  displayName: string,
  code: string
): Promise<string> {
  const { data: linkCode } = await supabase
    .from("linking_codes")
    .select("*")
    .eq("code", code.toUpperCase())
    .eq("platform", "whatsapp")
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!linkCode) {
    return "❌ Código inválido o expirado. Genera uno nuevo desde la app web en Ajustes > Integraciones.";
  }

  const { data: existing } = await supabase
    .from("platform_users")
    .select("id")
    .eq("platform", "whatsapp")
    .eq("platform_user_id", phoneNumber)
    .single();

  if (existing) {
    return "✅ Tu WhatsApp ya está vinculado a JARVIS.";
  }

  await Promise.all([
    supabase.from("platform_users").insert({
      user_id: linkCode.user_id,
      platform: "whatsapp",
      platform_user_id: phoneNumber,
      display_name: displayName,
    }),
    supabase.from("linking_codes").update({ used_at: new Date().toISOString() }).eq("id", linkCode.id),
    supabase.from("user_integrations").update({ whatsapp_phone: phoneNumber }).eq("user_id", linkCode.user_id),
  ]);

  return "✅ ¡WhatsApp vinculado a JARVIS! Escribe cualquier mensaje para empezar.";
}

// ── CRM persistence (mirrors evolution-webhook logic) ─────────────────────────

async function persistToCRM(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  supabaseKey: string,
  phoneNumber: string,
  contactName: string,
  textContent: string,
  direction: "incoming" | "outgoing",
  messageDate: string
) {
  const crmUserId = Deno.env.get("EVOLUTION_DEFAULT_USER_ID");
  if (!crmUserId) {
    console.log("[WhatsApp CRM] No EVOLUTION_DEFAULT_USER_ID, skipping CRM persistence");
    return;
  }

  const waId = phoneNumber.replace(/\D/g, "");
  const senderName = direction === "outgoing" ? "Yo" : (contactName || waId);

  // Find or create contact
  let contactId: string;
  let contactIsFavorite = false;

  const { data: contactByWaId } = await supabase
    .from("people_contacts")
    .select("id, is_favorite")
    .eq("wa_id", waId)
    .eq("user_id", crmUserId)
    .maybeSingle();

  if (contactByWaId) {
    contactId = contactByWaId.id;
    contactIsFavorite = contactByWaId.is_favorite || false;
  } else {
    const { data: contactByPhone } = await supabase
      .from("people_contacts")
      .select("id, is_favorite")
      .eq("user_id", crmUserId)
      .contains("phone_numbers", [waId])
      .maybeSingle();

    if (contactByPhone) {
      contactId = contactByPhone.id;
      contactIsFavorite = contactByPhone.is_favorite || false;
      await supabase.from("people_contacts").update({ wa_id: waId }).eq("id", contactId);
    } else {
      const { data: newContact, error: createErr } = await supabase
        .from("people_contacts")
        .insert({
          user_id: crmUserId,
          name: contactName || waId,
          wa_id: waId,
          category: "pendiente",
          phone_numbers: [waId],
        })
        .select("id")
        .single();

      if (createErr || !newContact) {
        console.error("[WhatsApp CRM] Error creating contact:", createErr);
        return;
      }
      contactId = newContact.id;
      console.log(`[WhatsApp CRM] New contact created: ${contactName || waId} (${contactId})`);
    }
  }

  // Persist message
  const { data: insertedMessage, error: msgErr } = await supabase
    .from("contact_messages")
    .insert({
      contact_id: contactId,
      user_id: crmUserId,
      content: textContent,
      direction,
      sender: senderName,
      source: "whatsapp",
      message_date: messageDate,
    })
    .select("id")
    .single();

  if (msgErr) {
    console.error("[WhatsApp CRM] Error inserting message:", msgErr);
    return;
  }

  console.log(`[WhatsApp CRM] Message persisted: ${insertedMessage.id} (${direction}) from ${senderName}`);

  // Update last_contact on people_contacts
  await supabase
    .from("people_contacts")
    .update({ last_contact: messageDate })
    .eq("id", contactId)
    .lt("last_contact", messageDate);

  // Only trigger intelligence for incoming messages
  if (direction === "incoming") {
    let shouldAnalyze = textContent.length > 20;
    if (!shouldAnalyze) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("contact_messages")
        .select("id", { count: "exact", head: true })
        .eq("contact_id", contactId)
        .eq("direction", "incoming")
        .gte("message_date", todayStart.toISOString());
      shouldAnalyze = (count || 0) >= 5;
    }

    if (shouldAnalyze) {
      console.log(`[WhatsApp CRM] Triggering contact-analysis for ${contactId}`);
      fetch(`${supabaseUrl}/functions/v1/contact-analysis`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, userId: crmUserId, scope: "profesional" }),
      }).catch((err) => console.error("contact-analysis fire error:", err));
    }

    if (contactIsFavorite) {
      console.log(`[WhatsApp CRM] Triggering generate-response-draft for favorite ${contactId}`);
      fetch(`${supabaseUrl}/functions/v1/generate-response-draft`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: contactId,
          user_id: crmUserId,
          message_id: insertedMessage.id,
          message_content: textContent,
        }),
      }).catch((err) => console.error("generate-response-draft fire error:", err));
    }
  }
}

serve(async (req) => {
  // WhatsApp webhook verification (GET)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
      console.log("[WhatsApp] Webhook verified");
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_ID) {
    console.error("WhatsApp not configured");
    return new Response("OK", { status: 200 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();

    // Extract message from WhatsApp webhook payload
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const msgObj = value?.messages?.[0];

    if (!msgObj || msgObj.type !== "text") {
      return new Response("OK", { status: 200 });
    }

    const phoneNumber = msgObj.from;
    const text = msgObj.text.body.trim();
    const contactName = value.contacts?.[0]?.profile?.name || "User";
    const messageDate = msgObj.timestamp
      ? new Date(Number(msgObj.timestamp) * 1000).toISOString()
      : new Date().toISOString();

    console.log(`[WhatsApp] Message from ${contactName} (${phoneNumber}): ${text.substring(0, 80)}`);

    // ── CRM persistence (always, in parallel with Jarvis flow) ──
    const crmPromise = persistToCRM(
      supabase, supabaseUrl, supabaseKey,
      phoneNumber, contactName, text, "incoming", messageDate
    ).catch(err => console.error("[WhatsApp CRM] Error:", err));

    // Check for linking code (6-char alphanumeric)
    if (/^[A-Z0-9]{6}$/i.test(text)) {
      const result = await handleLinkCode(supabase, phoneNumber, contactName, text);
      await sendWhatsAppMessage(phoneNumber, result);
      await crmPromise;
      return new Response("OK", { status: 200 });
    }

    // Resolve user for Jarvis chatbot flow
    const userId = await resolveUserId(supabase, phoneNumber);
    if (!userId) {
      await sendWhatsAppMessage(phoneNumber,
        "👋 ¡Hola! Soy JARVIS.\n\n" +
        "Para empezar, vincula tu cuenta:\n" +
        "1. Ve a la app web → Ajustes → Integraciones\n" +
        "2. Pulsa 'Vincular WhatsApp'\n" +
        "3. Envía el código de 6 caracteres aquí"
      );
      await crmPromise;
      return new Response("OK", { status: 200 });
    }

    // Call jarvis-gateway
    const gatewayUrl = `${supabaseUrl}/functions/v1/jarvis-gateway`;
    const gatewayRes = await fetch(gatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        message: text,
        user_id: userId,
        platform: "whatsapp",
      }),
    });

    if (!gatewayRes.ok) {
      console.error("[WhatsApp] Gateway error:", await gatewayRes.text());
      await sendWhatsAppMessage(phoneNumber, "⚠️ Error procesando tu mensaje. Intenta de nuevo.");
      await crmPromise;
      return new Response("OK", { status: 200 });
    }

    const gatewayData = await gatewayRes.json();
    await sendWhatsAppMessage(phoneNumber, gatewayData.response);

    await crmPromise;
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("[WhatsApp] Error:", error);
    return new Response("OK", { status: 200 });
  }
});
