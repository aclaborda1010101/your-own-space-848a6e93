import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
    voice?: { file_id: string; duration: number };
    date: number;
  };
}

async function sendTelegramMessage(chatId: number, text: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
  });
  if (!res.ok) {
    console.error("Telegram send error:", await res.text());
  }
}

async function sendTelegramChatAction(chatId: number, action = "typing") {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action }),
  });
}

async function resolveUserId(
  supabase: ReturnType<typeof createClient>,
  telegramUserId: number
): Promise<string | null> {
  const { data } = await supabase
    .from("platform_users")
    .select("user_id")
    .eq("platform", "telegram")
    .eq("platform_user_id", String(telegramUserId))
    .single();

  return data?.user_id || null;
}

async function handleLinkCommand(
  supabase: ReturnType<typeof createClient>,
  telegramUserId: number,
  telegramName: string,
  code: string
): Promise<string> {
  // Find valid linking code
  const { data: linkCode } = await supabase
    .from("linking_codes")
    .select("*")
    .eq("code", code.toUpperCase())
    .eq("platform", "telegram")
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!linkCode) {
    return "❌ Código inválido o expirado. Genera uno nuevo desde la app web en Ajustes > Integraciones.";
  }

  // Check if already linked
  const { data: existing } = await supabase
    .from("platform_users")
    .select("id")
    .eq("platform", "telegram")
    .eq("platform_user_id", String(telegramUserId))
    .single();

  if (existing) {
    return "✅ Tu cuenta de Telegram ya está vinculada a JARVIS.";
  }

  // Create mapping and mark code as used
  await Promise.all([
    supabase.from("platform_users").insert({
      user_id: linkCode.user_id,
      platform: "telegram",
      platform_user_id: String(telegramUserId),
      display_name: telegramName,
    }),
    supabase.from("linking_codes").update({ used_at: new Date().toISOString() }).eq("id", linkCode.id),
    supabase.from("user_integrations").update({ telegram_chat_id: String(telegramUserId) }).eq("user_id", linkCode.user_id),
  ]);

  return "✅ ¡Cuenta vinculada correctamente! Ahora puedes hablar con JARVIS directamente aquí. Escribe cualquier mensaje para empezar.";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN not configured");
    return new Response("Bot not configured", { status: 500 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const update: TelegramUpdate = await req.json();
    const msg = update.message;

    if (!msg || !msg.text) {
      return new Response("OK", { status: 200 });
    }

    const chatId = msg.chat.id;
    const telegramUserId = msg.from.id;
    const text = msg.text.trim();
    const telegramName = msg.from.first_name || msg.from.username || "User";

    console.log(`[Telegram] Message from ${telegramName} (${telegramUserId}): ${text.substring(0, 80)}`);

    // Handle commands
    if (text.startsWith("/")) {
      const [command, ...args] = text.split(" ");

      switch (command.toLowerCase()) {
        case "/start":
          await sendTelegramMessage(chatId,
            "👋 ¡Hola! Soy *JARVIS*, tu asistente personal.\n\n" +
            "Para empezar, necesitas vincular tu cuenta.\n\n" +
            "1. Ve a la app web → Ajustes → Integraciones\n" +
            "2. Pulsa 'Vincular Telegram'\n" +
            "3. Copia el código y envíalo aquí con:\n" +
            "`/vincular TU_CODIGO`"
          );
          return new Response("OK", { status: 200 });

        case "/vincular":
        case "/link": {
          const code = args[0];
          if (!code) {
            await sendTelegramMessage(chatId, "Usa: `/vincular TU_CODIGO`\n\nGenera el código desde la app web → Ajustes → Integraciones.");
            return new Response("OK", { status: 200 });
          }
          const result = await handleLinkCommand(supabase, telegramUserId, telegramName, code);
          await sendTelegramMessage(chatId, result);
          return new Response("OK", { status: 200 });
        }

        case "/estado": {
          const userId = await resolveUserId(supabase, telegramUserId);
          if (!userId) {
            await sendTelegramMessage(chatId, "❌ Cuenta no vinculada. Usa `/vincular TU_CODIGO` primero.");
            return new Response("OK", { status: 200 });
          }
          // Fetch quick status
          const today = new Date().toISOString().split("T")[0];
          const [whoopRes, tasksRes] = await Promise.all([
            supabase.from("whoop_data").select("recovery_score, sleep_hours, strain").eq("user_id", userId).eq("data_date", today).single(),
            supabase.from("todos").select("title").eq("user_id", userId).eq("is_completed", false).limit(5),
          ]);

          let status = "📊 *Estado actual:*\n\n";
          if (whoopRes.data) {
            const w = whoopRes.data;
            status += `💚 Recovery: ${w.recovery_score}%\n😴 Sueño: ${w.sleep_hours?.toFixed(1) || "?"}h\n🔥 Strain: ${w.strain?.toFixed(1) || "?"}\n\n`;
          } else {
            status += "Sin datos WHOOP hoy\n\n";
          }

          if (tasksRes.data && tasksRes.data.length > 0) {
            status += `📋 *Tareas pendientes:*\n${tasksRes.data.map((t: { title: string }) => `• ${t.title}`).join("\n")}`;
          } else {
            status += "✅ Sin tareas pendientes";
          }

          await sendTelegramMessage(chatId, status);
          return new Response("OK", { status: 200 });
        }

        default:
          await sendTelegramMessage(chatId, "Comandos disponibles:\n`/start` - Iniciar\n`/vincular CODIGO` - Vincular cuenta\n`/estado` - Ver estado del día");
          return new Response("OK", { status: 200 });
      }
    }

    // Regular message - route through gateway
    const userId = await resolveUserId(supabase, telegramUserId);
    if (!userId) {
      await sendTelegramMessage(chatId,
        "❌ Tu cuenta no está vinculada.\n\n" +
        "Vincula tu cuenta primero:\n" +
        "1. App web → Ajustes → Integraciones\n" +
        "2. Pulsa 'Vincular Telegram'\n" +
        "3. Envía aquí: `/vincular TU_CODIGO`"
      );
      return new Response("OK", { status: 200 });
    }

    // Show typing indicator
    await sendTelegramChatAction(chatId);

    // Route linked Telegram users through POTUS so the app and Telegram share one thread
    const potusUrl = `${supabaseUrl}/functions/v1/potus-core`;
    const potusRes = await fetch(potusUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        action: "chat",
        message: text,
        user_id: userId,
        platform: "telegram",
        transport: {
          telegram_chat_id: String(chatId),
          telegram_user_id: String(telegramUserId),
          telegram_message_id: msg.message_id,
        },
      }),
    });

    if (!potusRes.ok) {
      console.error("[Telegram] POTUS error:", await potusRes.text());
      await sendTelegramMessage(chatId, "⚠️ Error procesando tu mensaje. Intenta de nuevo.");
      return new Response("OK", { status: 200 });
    }

    const potusData = await potusRes.json();
    await sendTelegramMessage(chatId, potusData.message || potusData.response || "Sin respuesta.");

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("[Telegram] Error:", error);
    return new Response("Internal error", { status: 500 });
  }
});
