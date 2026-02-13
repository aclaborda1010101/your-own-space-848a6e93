import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_POTUS_BOT_TOKEN");
    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_POTUS_CHAT_ID");

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      return new Response(JSON.stringify({ error: "Missing TELEGRAM_POTUS_BOT_TOKEN or TELEGRAM_POTUS_CHAT_ID" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { message, userId, agentType } = await req.json();

    if (!message || !userId) {
      return new Response(JSON.stringify({ error: "message and userId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[TelegramBridge] User ${userId.substring(0, 8)}... → "${message.substring(0, 60)}"`);

    // 1. Save to conversation_history BEFORE sending to Telegram
    // So POTUS daemon on Mac Mini (potus-telegram-handler.js) keeps context
    if (userId) {
      await supabase.from("conversation_history").insert({
        user_id: userId,
        role: "user",
        content: message,
        agent_type: "potus",
        metadata: { source: "app", bridge: "telegram" },
      });
    }

    // 2. Send to Telegram
    const telegramRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: `[APP] ${message}`,
      }),
    });

    const telegramData = await telegramRes.json();

    if (!telegramRes.ok) {
      console.error("[TelegramBridge] Telegram error:", telegramData);
      return new Response(JSON.stringify({ error: "Telegram send failed", details: telegramData }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[TelegramBridge] Sent successfully, msg_id:", telegramData.result?.message_id);

    return new Response(JSON.stringify({
      status: "sent",
      telegram_message_id: telegramData.result?.message_id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[TelegramBridge] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
