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
  const url = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WHATSAPP_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
  if (!res.ok) {
    console.error("WhatsApp send error:", await res.text());
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

serve(async (req) => {
  // WhatsApp webhook verification (GET)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
      console.log("[WhatsApp] Webhook verified");
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
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
      // Not a text message, acknowledge
      return new Response("OK", { status: 200 });
    }

    const phoneNumber = msgObj.from;
    const text = msgObj.text.body.trim();
    const contactName = value.contacts?.[0]?.profile?.name || "User";

    console.log(`[WhatsApp] Message from ${contactName} (${phoneNumber}): ${text.substring(0, 80)}`);

    // Check for linking code (6-char alphanumeric)
    if (/^[A-Z0-9]{6}$/i.test(text)) {
      const result = await handleLinkCode(supabase, phoneNumber, contactName, text);
      await sendWhatsAppMessage(phoneNumber, result);
      return new Response("OK", { status: 200 });
    }

    // Resolve user
    const userId = await resolveUserId(supabase, phoneNumber);
    if (!userId) {
      await sendWhatsAppMessage(phoneNumber,
        "👋 ¡Hola! Soy JARVIS.\n\n" +
        "Para empezar, vincula tu cuenta:\n" +
        "1. Ve a la app web → Ajustes → Integraciones\n" +
        "2. Pulsa 'Vincular WhatsApp'\n" +
        "3. Envía el código de 6 caracteres aquí"
      );
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
      return new Response("OK", { status: 200 });
    }

    const gatewayData = await gatewayRes.json();
    await sendWhatsAppMessage(phoneNumber, gatewayData.response);

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("[WhatsApp] Error:", error);
    return new Response("OK", { status: 200 });
  }
});
