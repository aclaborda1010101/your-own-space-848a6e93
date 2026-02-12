import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_ADMIN_CHAT_ID = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function sendTelegramMessage(text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) {
    console.error("[TelegramBridge] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID");
    return false;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_ADMIN_CHAT_ID,
      text,
      parse_mode: "Markdown",
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("[TelegramBridge] Telegram API error:", res.status, errBody);
    return false;
  }

  await res.text(); // consume body
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) {
      return new Response(
        JSON.stringify({ error: "Missing Telegram secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { message, user_id, agent_type } = await req.json();

    if (!message || !user_id) {
      return new Response(
        JSON.stringify({ error: "message and user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[TelegramBridge] Sending message from ${user_id}: ${message.substring(0, 80)}`);

    // 1. Save user message to conversation_history
    const { error: insertError } = await supabase.from("conversation_history").insert({
      user_id,
      role: "user",
      content: message,
      agent_type: agent_type || "jarvis",
      metadata: { source: "app", channel: "telegram-bridge" },
    });

    if (insertError) {
      console.error("[TelegramBridge] Insert error:", insertError);
    }

    // 2. Send to Telegram
    const prefix = agent_type && agent_type !== "jarvis" ? `[${agent_type.toUpperCase()}] ` : "";
    const sent = await sendTelegramMessage(`${prefix}${message}`);

    if (!sent) {
      return new Response(
        JSON.stringify({ error: "Failed to send to Telegram" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Also save to potus_chat for gateway continuity
    await supabase.from("potus_chat").insert({
      user_id,
      message,
      role: "user",
      platform: "telegram",
    });

    console.log("[TelegramBridge] Message sent and saved successfully");

    return new Response(
      JSON.stringify({ success: true, sent: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[TelegramBridge] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
