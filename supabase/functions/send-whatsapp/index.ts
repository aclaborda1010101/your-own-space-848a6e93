import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INSTANCE_NAME = Deno.env.get("EVOLUTION_INSTANCE_NAME") || "jarvis-whatsapp";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const extractPhoneFromValue = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  if (value.includes("@g.us")) return null;
  const candidate = value.split("@")[0].replace(/\D/g, "");
  return candidate.length >= 8 ? candidate : null;
};

const extractPhoneFromEvolutionContact = (contact: any): string | null => {
  if (!contact || typeof contact !== "object") return null;

  const candidates = [
    contact.id,
    contact.remoteJid,
    contact.remoteJidAlt,
    contact.jid,
    contact.wa_id,
    contact.waId,
    contact.number,
    contact.phone,
    contact.mobile,
  ];

  for (const value of candidates) {
    const parsed = extractPhoneFromValue(value);
    if (parsed) return parsed;
  }

  return null;
};

const normalizeEvolutionMatches = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.contacts)) return payload.contacts;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
};

const getEvolutionState = async (baseUrl: string, apiKey: string, instanceName: string) => {
  const response = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
    method: "GET",
    headers: {
      "apikey": apiKey,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json().catch(() => null);
  const rawState = data?.instance?.state || data?.state || "unknown";
  return {
    ok: response.ok,
    data,
    state: typeof rawState === "string" ? rawState.toLowerCase() : "unknown",
  };
};

const triggerEvolutionConnect = async (baseUrl: string, apiKey: string, instanceName: string) => {
  try {
    const response = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
      method: "GET",
      headers: {
        "apikey": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const payload = await response.text().catch(() => "");
      console.warn(`[send-whatsapp] connect/${instanceName} failed [${response.status}] ${payload}`);
    }
  } catch (error) {
    console.warn(`[send-whatsapp] connect/${instanceName} request failed`, error);
  }
};

const ensureEvolutionReady = async (baseUrl: string, apiKey: string, instanceName: string) => {
  let status = await getEvolutionState(baseUrl, apiKey, instanceName);

  if (status.state === "open") return status;

  await triggerEvolutionConnect(baseUrl, apiKey, instanceName);

  const delays = [2000, 3000, 4000, 5000, 6000, 8000, 10000];
  let consecutiveConnecting = status.state === "connecting" ? 1 : 0;

  for (let index = 0; index < delays.length; index += 1) {
    await wait(delays[index]);
    status = await getEvolutionState(baseUrl, apiKey, instanceName);

    if (status.state === "open") return status;

    consecutiveConnecting = status.state === "connecting" ? consecutiveConnecting + 1 : 0;

    if (status.state === "close" || status.state === "closed" || status.state === "unknown") {
      await triggerEvolutionConnect(baseUrl, apiKey, instanceName);
    }

    if (consecutiveConnecting >= 3 && index < delays.length - 1) {
      console.log(`[send-whatsapp] Instance ${instanceName} still connecting, refreshing connect handshake`);
      await triggerEvolutionConnect(baseUrl, apiKey, instanceName);
    }

    console.log(`[send-whatsapp] Waiting for instance ${instanceName}, state=${status.state}`);
  }

  return status;
};

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
    let contactName: string | null = null;

    // If contact_id provided, resolve phone from people_contacts
    if (!targetPhone && contact_id) {
      const { data: contactData } = await supabase
        .from("people_contacts")
        .select("wa_id, phone_numbers, name")
        .eq("id", contact_id)
        .maybeSingle();

      if (contactData) {
        contactName = contactData.name || null;
        targetPhone = extractPhoneFromValue(contactData.wa_id) || contactData.phone_numbers?.map(extractPhoneFromValue).find(Boolean) || null;

        if (!targetPhone) {
          console.log(`[send-whatsapp] Contact "${contactData.name}" has no wa_id or phone_numbers`);
        }
      }
    }

    // Fallback: recover a phone that may already exist in prior messages/imported chats
    if (!targetPhone && contact_id) {
      const { data: recentMessages } = await supabase
        .from("contact_messages")
        .select("sender, chat_name")
        .eq("contact_id", contact_id)
        .in("source", ["whatsapp", "whatsapp_backup"])
        .order("message_date", { ascending: false })
        .limit(20);

      const derivedPhone = recentMessages
        ?.flatMap((msg) => [msg.sender, msg.chat_name])
        .map(extractPhoneFromValue)
        .find(Boolean) || null;

      if (derivedPhone) {
        targetPhone = derivedPhone;
        console.log(`[send-whatsapp] Recovered phone from prior messages: ...${derivedPhone.slice(-4)}`);

        await supabase
          .from("people_contacts")
          .update({ wa_id: derivedPhone, phone_numbers: [derivedPhone] })
          .eq("id", contact_id);
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

      targetPhone = extractPhoneFromValue(platformUser?.phone) || null;
    }

    // Fallback: query Evolution API contacts by name
    if (!targetPhone && contact_id) {
      const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
      const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");

      if (EVOLUTION_API_URL && EVOLUTION_API_KEY) {
        if (!contactName) {
          const { data: contactForName } = await supabase
            .from("people_contacts")
            .select("name")
            .eq("id", contact_id)
            .maybeSingle();
          contactName = contactForName?.name || null;
        }

        if (contactName) {
          try {
            console.log(`[send-whatsapp] Looking up "${contactName}" in Evolution API contacts`);
            const evoContactsUrl = `${EVOLUTION_API_URL}/chat/findContacts/${INSTANCE_NAME}`;
            const lookupBodies = [
              { where: { pushName: contactName } },
              { where: { name: contactName } },
            ];
            // If name has multiple words, also try first name only
            const firstName = contactName.split(/\s+/)[0];
            if (firstName && firstName !== contactName) {
              lookupBodies.push({ where: { pushName: firstName } });
            }

            for (const lookupBody of lookupBodies) {
              const evoRes = await fetch(evoContactsUrl, {
                method: "POST",
                headers: {
                  "apikey": EVOLUTION_API_KEY,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(lookupBody),
              });

              const evoPayload = await evoRes.json().catch(() => null);

              if (!evoRes.ok) {
                console.error("[send-whatsapp] Evolution lookup error:", JSON.stringify(evoPayload));
                continue;
              }

              const matches = normalizeEvolutionMatches(evoPayload);
              const match = matches.find((c: any) => extractPhoneFromEvolutionContact(c));
              const foundPhone = match ? extractPhoneFromEvolutionContact(match) : null;

              if (foundPhone) {
                console.log(`[send-whatsapp] Found phone via Evolution API: ...${foundPhone.slice(-4)}`);
                targetPhone = foundPhone;
                await supabase
                  .from("people_contacts")
                  .update({ wa_id: foundPhone, phone_numbers: [foundPhone] })
                  .eq("id", contact_id);
                break;
              }
            }
          } catch (evoErr) {
            console.error("[send-whatsapp] Evolution contact lookup error:", evoErr);
          }
        }
      }
    }

    if (!targetPhone) {
      return new Response(JSON.stringify({ 
        error: "No phone number found",
        detail: "Este contacto no tiene número de WhatsApp (wa_id) asociado y no se pudo resolver automáticamente desde el historial ni desde Evolution. Edita el contacto y añade su número, o espera a recibir un mensaje directo suyo para capturarlo."
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanPhone = targetPhone.replace(/\D/g, "");

    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");

    let sent = false;
    let messageId: string | undefined;

    if (EVOLUTION_API_URL && EVOLUTION_API_KEY) {
      try {
        const baseUrl = EVOLUTION_API_URL.replace(/\/+$/, "");
        const preflight = await ensureEvolutionReady(baseUrl, EVOLUTION_API_KEY, INSTANCE_NAME);

        if (preflight.state !== "open") {
          return new Response(JSON.stringify({
            error: "No se pudo enviar el mensaje",
            detail: preflight.state === "connecting"
              ? "WhatsApp se está reconectando en este momento. Espera unos segundos y vuelve a intentar."
              : "Tu instancia de WhatsApp no está conectada. Abre el panel de WhatsApp Personal y escanea el QR para reconectar.",
            retryable: preflight.state === "connecting",
            status: preflight.state,
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const evoUrl = `${baseUrl}/message/sendText/${INSTANCE_NAME}`;
        console.log(`[send-whatsapp] Sending via Evolution API instance=${INSTANCE_NAME} to ...${cleanPhone.slice(-4)}`);

        let evoResponse = await fetch(evoUrl, {
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

        let evoData = await evoResponse.json().catch(() => null);

        if (!evoResponse.ok && evoData?.response?.message === "Connection Closed") {
          const retryStatus = await ensureEvolutionReady(baseUrl, EVOLUTION_API_KEY, INSTANCE_NAME);

          if (retryStatus.state === "open") {
            evoResponse = await fetch(evoUrl, {
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
            evoData = await evoResponse.json().catch(() => null);
          } else {
            return new Response(JSON.stringify({
              error: "No se pudo enviar el mensaje",
              detail: retryStatus.state === "connecting"
                ? "WhatsApp todavía se está reconectando. El QR ya fue generado; escanéalo y prueba de nuevo en unos segundos."
                : "WhatsApp está desconectado. Abre el panel de WhatsApp Personal y escanea el QR para reconectar.",
              retryable: retryStatus.state === "connecting",
              status: retryStatus.state,
            }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        if (evoResponse.ok && evoData?.key?.id) {
          sent = true;
          messageId = evoData.key.id;
          console.log(`[send-whatsapp] Sent via Evolution API, msgId: ${messageId}`);
        } else {
          console.error("[send-whatsapp] Evolution API error:", JSON.stringify(evoData));
          return new Response(JSON.stringify({
            error: "No se pudo enviar el mensaje",
            detail: evoData?.response?.message || evoData?.message || "Evolution API devolvió un error desconocido"
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (evoErr) {
        console.error("[send-whatsapp] Evolution API exception:", evoErr);
        return new Response(JSON.stringify({
          error: "No se pudo enviar el mensaje",
          detail: evoErr instanceof Error ? evoErr.message : "Error de conexión con Evolution API"
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!sent) {
      // Evolution API failed or not configured — return clear error
      // Meta API fallback is disabled (token expired/invalid)
      return new Response(JSON.stringify({ 
        error: "No se pudo enviar el mensaje",
        detail: "Evolution API no respondió correctamente. Verifica que tu instancia de WhatsApp esté conectada en el panel de configuración."
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (resolvedContactId) {
      // Resolve from instance owner table, then fallback
      const { data: ownerRow } = await supabase
        .from("whatsapp_instance_owners")
        .select("user_id")
        .eq("instance_name", INSTANCE_NAME)
        .maybeSingle();
      const crmUserId = user_id || ownerRow?.user_id || Deno.env.get("EVOLUTION_DEFAULT_USER_ID");
      if (crmUserId) {
        const sentAt = new Date().toISOString();
        const { error: persistErr } = await supabase
          .from("contact_messages")
          .insert({
            contact_id: resolvedContactId,
            user_id: crmUserId,
            content: message,
            direction: "outgoing",
            sender: "Yo",
            source: "whatsapp",
            message_date: sentAt,
          });

        if (persistErr) {
          console.error("[send-whatsapp] Error persisting outgoing message:", persistErr);
        } else {
          console.log(`[send-whatsapp] Outgoing message persisted for contact ${resolvedContactId}`);
        }

        // Bump last_contact (handles NULL correctly)
        const { data: cur } = await supabase
          .from("people_contacts")
          .select("last_contact")
          .eq("id", resolvedContactId)
          .maybeSingle();
        const curMs = cur?.last_contact ? new Date(cur.last_contact).getTime() : 0;
        const newMs = new Date(sentAt).getTime();
        if (!cur?.last_contact || newMs > curMs) {
          await supabase
            .from("people_contacts")
            .update({ last_contact: sentAt })
            .eq("id", resolvedContactId);
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
