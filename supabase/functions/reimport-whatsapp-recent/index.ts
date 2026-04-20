// Re-importa mensajes recientes de WhatsApp desde Evolution API para recuperar
// audios/imágenes/PDFs que el pipeline antiguo descartó. Hace fetch paginado de
// chat/findMessages, deduplica por external_id y reenvía cada mensaje al
// evolution-webhook (que ya transcribe multimedia automáticamente).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PAGE_SIZE = 100;
const MAX_PAGES = 50; // hasta 5000 mensajes por contacto
const DELAY_BETWEEN_REPLAYS_MS = 250;

async function fetchEvolutionMessages(
  instance: string,
  remoteJid: string,
  sinceUnix: number,
): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(
      `${EVOLUTION_API_URL}/chat/findMessages/${instance}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: EVOLUTION_API_KEY!,
        },
        body: JSON.stringify({
          where: { key: { remoteJid } },
          limit: PAGE_SIZE,
          page,
        }),
      },
    );
    if (!res.ok) {
      console.error(`[reimport] findMessages page=${page} status=${res.status}`);
      break;
    }
    const json = await res.json();
    // Evolution puede devolver { messages: { records: [...] } } o array directo
    const records: any[] =
      json?.messages?.records ||
      json?.records ||
      (Array.isArray(json) ? json : []);
    if (records.length === 0) break;
    let stopPaging = false;
    for (const m of records) {
      const ts = Number(m.messageTimestamp || m.message_timestamp || 0);
      if (ts && ts < sinceUnix) {
        stopPaging = true;
        continue;
      }
      all.push(m);
    }
    if (records.length < PAGE_SIZE || stopPaging) break;
  }
  return all;
}

function isMediaMessage(message: any): boolean {
  if (!message) return false;
  return !!(
    message.audioMessage ||
    message.imageMessage ||
    message.documentMessage ||
    message.documentWithCaptionMessage ||
    message.videoMessage
  );
}

async function replayToWebhook(
  instance: string,
  rawMessage: any,
): Promise<void> {
  const payload = {
    instance,
    data: {
      key: rawMessage.key,
      message: rawMessage.message,
      messageTimestamp: rawMessage.messageTimestamp,
      pushName: rawMessage.pushName || rawMessage.push_name || "",
    },
  };
  await fetch(`${SUPABASE_URL}/functions/v1/evolution-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(payload),
  }).catch((e) => console.error("[reimport] replay failed:", e));
}

async function runReimportForUser(
  supabase: any,
  userId: string,
  daysBack: number,
  contactIdFilter: string | null,
) {
  const { data: ownerRow } = await supabase
    .from("whatsapp_instance_owners")
    .select("instance_name")
    .eq("user_id", userId)
    .maybeSingle();
  const instance = ownerRow?.instance_name || "jarvis-whatsapp";

  let q = supabase
    .from("people_contacts")
    .select("id, name, wa_id")
    .eq("user_id", userId)
    .not("wa_id", "is", null);
  if (contactIdFilter) {
    q = q.eq("id", contactIdFilter);
  } else {
    q = q.or("is_favorite.eq.true,in_strategic_network.eq.true");
  }
  const { data: contacts, error: contactsErr } = await q;
  if (contactsErr) throw contactsErr;

  const targets = (contacts || []).filter((c: any) => c.wa_id);
  const sinceUnix = Math.floor(Date.now() / 1000) - daysBack * 86400;

  let totalMedia = 0;
  let totalReplayed = 0;
  let contactsDone = 0;
  for (const c of targets) {
    const remoteJid = `${c.wa_id}@s.whatsapp.net`;
    try {
      const messages = await fetchEvolutionMessages(instance, remoteJid, sinceUnix);
      const mediaMsgs = messages.filter((m) => isMediaMessage(m.message));
      totalMedia += mediaMsgs.length;

      for (const m of mediaMsgs) {
        const externalId = m?.key?.id;
        if (!externalId) continue;
        const { data: existing } = await supabase
          .from("contact_messages")
          .select("id")
          .eq("user_id", userId)
          .eq("external_id", externalId)
          .maybeSingle();
        if (existing) continue;

        await replayToWebhook(instance, m);
        totalReplayed++;
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_REPLAYS_MS));
      }
      contactsDone++;
      console.log(
        `[reimport] user=${userId} ${c.name}: ${mediaMsgs.length} media, ${totalReplayed} encolados (acum)`,
      );
    } catch (e) {
      console.error(`[reimport] user=${userId} contact ${c.name} failed:`, e);
    }
  }
  console.log(
    `[reimport] DONE user=${userId} contacts=${contactsDone}/${targets.length} mediaFound=${totalMedia} replayed=${totalReplayed}`,
  );
  return { contactsScanned: targets.length, totalMedia, totalReplayed };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      throw new Error("Evolution API not configured");
    }

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const body = await req.json().catch(() => ({}));
    const isServiceMode = token === SERVICE_KEY || body.mode === "all-users";

    const daysBack: number = Math.min(Math.max(Number(body.daysBack) || 21, 1), 60);
    const contactIdFilter: string | null = body.contactId || null;

    // ---- SERVICE MODE: iterar todos los usuarios con red activa ----
    if (isServiceMode) {
      const { data: usersRows, error: uErr } = await supabase
        .from("people_contacts")
        .select("user_id")
        .or("is_favorite.eq.true,in_strategic_network.eq.true")
        .not("wa_id", "is", null);
      if (uErr) throw uErr;
      const uniqueUsers = Array.from(new Set((usersRows || []).map((r: any) => r.user_id)));
      console.log(`[reimport] SERVICE mode: ${uniqueUsers.length} users`);

      const job = (async () => {
        for (const uid of uniqueUsers) {
          try {
            await runReimportForUser(supabase, uid, daysBack, null);
          } catch (e) {
            console.error(`[reimport] user ${uid} failed:`, e);
          }
        }
      })();
      // @ts-ignore EdgeRuntime
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(job);
      } else {
        job.catch((e) => console.error("[reimport] background error:", e));
      }

      return new Response(
        JSON.stringify({
          ok: true,
          mode: "all-users",
          users: uniqueUsers.length,
          daysBack,
          message: `Re-importando ${daysBack} días para ${uniqueUsers.length} usuarios en background.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- USER MODE ----
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    // Pre-count for response
    let q = supabase
      .from("people_contacts")
      .select("id, name, wa_id")
      .eq("user_id", userId)
      .not("wa_id", "is", null);
    if (contactIdFilter) q = q.eq("id", contactIdFilter);
    else q = q.or("is_favorite.eq.true,in_strategic_network.eq.true");
    const { data: contacts } = await q;
    const targets = (contacts || []).filter((c: any) => c.wa_id);
    if (targets.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, contactsScanned: 0, message: "No hay contactos activos con wa_id." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const job = (async () => {
      let totalMedia = 0;
      let totalReplayed = 0;
      let contactsDone = 0;
      for (const c of targets) {
        const remoteJid = `${c.wa_id}@s.whatsapp.net`;
        try {
          const messages = await fetchEvolutionMessages(instance, remoteJid, sinceUnix);
          const mediaMsgs = messages.filter((m) => isMediaMessage(m.message));
          totalMedia += mediaMsgs.length;

          for (const m of mediaMsgs) {
            const externalId = m?.key?.id;
            if (!externalId) continue;
            // Skip si ya existe
            const { data: existing } = await supabase
              .from("contact_messages")
              .select("id")
              .eq("user_id", userId)
              .eq("external_id", externalId)
              .maybeSingle();
            if (existing) continue;

            await replayToWebhook(instance, m);
            totalReplayed++;
            await new Promise((r) => setTimeout(r, DELAY_BETWEEN_REPLAYS_MS));
          }
          contactsDone++;
          console.log(
            `[reimport] ${c.name}: ${mediaMsgs.length} media, ${totalReplayed} encolados (acum)`,
          );
        } catch (e) {
          console.error(`[reimport] contact ${c.name} failed:`, e);
        }
      }
      console.log(
        `[reimport] DONE — contacts=${contactsDone}/${targets.length} mediaFound=${totalMedia} replayed=${totalReplayed}`,
      );
    })();

    // @ts-ignore EdgeRuntime exists at runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(job);
    } else {
      job.catch((e) => console.error("[reimport] background error:", e));
    }

    return new Response(
      JSON.stringify({
        ok: true,
        contactsScanned: targets.length,
        daysBack,
        message: `Re-importando últimos ${daysBack} días de ${targets.length} contactos en segundo plano. Vuelve en 2-5 minutos.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[reimport-whatsapp-recent] error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
