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
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { response, userId, source, agentType } = await req.json();

    if (!response || !userId) {
      return new Response(JSON.stringify({ error: "response and userId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[TelegramResponseWebhook] Response for ${userId.substring(0, 8)}...: "${response.substring(0, 60)}"`);

    // 1. Save to conversation_history
    const { error } = await supabase.from("conversation_history").insert({
      user_id: userId,
      role: "assistant",
      content: response,
      agent_type: agentType || "jarvis-unified",
      metadata: { source: source || "telegram", from: "potus", timestamp: new Date().toISOString() },
    });

    if (error) {
      console.error("[TelegramResponseWebhook] Insert error:", error);
    }

    // 2. Emit Realtime event so the app updates the chat
    try {
      await supabase.channel("jarvis-state").send({
        type: "broadcast",
        event: "jarvis_response",
        payload: {
          state: "response_ready",
          response,
          agentType: agentType || "jarvis-unified",
          userId,
          source: "telegram",
        },
      });
      console.log("[TelegramResponseWebhook] Realtime broadcast sent");
    } catch (e) {
      console.warn("[TelegramResponseWebhook] Broadcast error (non-critical):", e);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[TelegramResponseWebhook] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
