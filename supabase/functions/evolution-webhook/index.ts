import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normalize a wa_id: strip suffix like ":12", non-digits, keep just digits
function normalizeWaId(raw: string): string {
  if (!raw) return "";
  const beforeColon = raw.split(":")[0];
  return beforeColon.replace(/\D/g, "");
}

// Last 9 digits — useful for matching ES numbers with/without prefix
function last9(num: string): string {
  const n = normalizeWaId(num);
  return n.length >= 9 ? n.slice(-9) : n;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Evolution webhook received:", JSON.stringify(body).substring(0, 500));

    const data = body.data || body;
    const { message, key, messageTimestamp, pushName } = data;

    if (!key || !message) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (key.remoteJid?.includes("@g.us")) {
      return new Response(JSON.stringify({ ok: true, skipped: "group" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Detect message type (text vs media) ──
    let textContent: string | null =
      message?.conversation ||
      message?.extendedTextMessage?.text ||
      null;

    type MediaKind = "audio" | "image" | "document" | "video" | null;
    let mediaKind: MediaKind = null;
    let mediaCaption = "";
    let mediaFileName = "";
    let mediaMimeType = "";

    if (!textContent) {
      if (message?.audioMessage) {
        mediaKind = "audio";
        mediaMimeType = message.audioMessage.mimetype || "audio/ogg";
        textContent = "[⏳ Procesando audio…]";
      } else if (message?.imageMessage) {
        mediaKind = "image";
        mediaCaption = message.imageMessage.caption || "";
        mediaMimeType = message.imageMessage.mimetype || "image/jpeg";
        textContent = "[⏳ Procesando imagen…]";
      } else if (message?.documentMessage || message?.documentWithCaptionMessage) {
        const doc = message.documentMessage || message.documentWithCaptionMessage?.message?.documentMessage;
        mediaKind = "document";
        mediaCaption = doc?.caption || "";
        mediaFileName = doc?.fileName || "documento";
        mediaMimeType = doc?.mimetype || "application/octet-stream";
        textContent = `[⏳ Procesando documento: ${mediaFileName}…]`;
      } else if (message?.videoMessage) {
        mediaKind = "video";
        mediaCaption = message.videoMessage.caption || "";
        mediaMimeType = message.videoMessage.mimetype || "video/mp4";
        textContent = mediaCaption ? `[🎬 Vídeo] ${mediaCaption}` : "[🎬 Vídeo recibido]";
      } else {
        return new Response(JSON.stringify({ ok: true, skipped: "no_text" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const remoteJid = key.remoteJid || "";
    const remoteJidAlt = key.remoteJidAlt || "";
    const isLid = remoteJid.includes("@lid");
    const phoneJid = isLid && remoteJidAlt ? remoteJidAlt : remoteJid;
    const rawWaId = phoneJid.split("@")[0];
    const waId = normalizeWaId(rawWaId);
    const waLast9 = last9(waId);
    const lidId = isLid ? remoteJid.split("@")[0] : null;

    if (!waId) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_waid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const externalId: string | null = key.id || null;
    const direction = key.fromMe ? "outgoing" : "incoming";
    const senderName = key.fromMe ? "Yo" : (pushName || waId);
    const messageDate = messageTimestamp
      ? new Date(Number(messageTimestamp) * 1000).toISOString()
      : new Date().toISOString();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Resolve user_id STRICTLY from instance owner.
    // We removed the EVOLUTION_DEFAULT_USER_ID fallback to prevent messages from
    // unknown / unowned instances being attributed to a default user (data leak).
    const instanceName = body.instance || "jarvis-whatsapp";
    const { data: owner } = await supabase
      .from("whatsapp_instance_owners")
      .select("user_id")
      .eq("instance_name", instanceName)
      .maybeSingle();

    const userId = owner?.user_id;
    if (!userId) {
      console.warn(`[evolution-webhook] No owner for instance "${instanceName}", dropping message`);
      return new Response(JSON.stringify({ ok: true, skipped: "no_owner_for_instance", instance: instanceName }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================
    // IDEMPOTENCY: short-circuit if message already stored
    // ============================
    if (externalId) {
      const { data: existing } = await supabase
        .from("contact_messages")
        .select("id")
        .eq("user_id", userId)
        .eq("external_id", externalId)
        .maybeSingle();
      if (existing) {
        console.log(`[idempotency] Already stored ${externalId}, skipping`);
        return new Response(
          JSON.stringify({ ok: true, deduped: true, message_id: existing.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ============================
    // CONTACT RESOLUTION (deterministic, dup-safe)
    // Carga TODOS los candidatos posibles, elige el mejor con prioridad
    // determinista, normaliza el wa_id en el ganador y NO asume unicidad.
    // ============================
    let contactId: string | null = null;
    let contactIsFavorite = false;

    type Cand = {
      id: string;
      name: string | null;
      wa_id: string | null;
      is_favorite: boolean | null;
      in_strategic_network: boolean | null;
      wa_message_count: number | null;
      created_at: string | null;
    };

    // 1) Candidatos por wa_id exacto
    const { data: exactMatches } = await supabase
      .from("people_contacts")
      .select("id, name, wa_id, is_favorite, in_strategic_network, wa_message_count, created_at")
      .eq("user_id", userId)
      .eq("wa_id", waId);

    // 2) Candidatos por últimos 9 dígitos
    const { data: last9Matches } = await supabase
      .from("people_contacts")
      .select("id, name, wa_id, is_favorite, in_strategic_network, wa_message_count, created_at")
      .eq("user_id", userId)
      .like("wa_id", `%${waLast9}`);

    // 3) Candidatos por phone_numbers
    const { data: phoneMatches } = await supabase
      .from("people_contacts")
      .select("id, name, wa_id, is_favorite, in_strategic_network, wa_message_count, created_at")
      .eq("user_id", userId)
      .contains("phone_numbers", [waId]);

    // Unir candidatos sin duplicados
    const candMap = new Map<string, Cand>();
    for (const arr of [exactMatches, last9Matches, phoneMatches]) {
      for (const c of (arr || []) as Cand[]) {
        if (!candMap.has(c.id)) candMap.set(c.id, c);
      }
    }
    const candidates = Array.from(candMap.values());

    function nameQuality(c: Cand): number {
      const n = (c.name || "").trim();
      if (!n) return 0;
      if (/^[0-9+\s-]+$/.test(n)) return 1; // solo números
      if (n === waId) return 1;
      if (n.length <= 4) return 2;          // alias muy corto (AAB)
      if (!/\s/.test(n)) return 3;          // una sola palabra
      return 4;                              // nombre humano completo
    }

    function pickBest(list: Cand[]): Cand | null {
      if (list.length === 0) return null;
      const sorted = [...list].sort((a, b) => {
        // 1. Favoritos
        const fa = a.is_favorite ? 1 : 0, fb = b.is_favorite ? 1 : 0;
        if (fa !== fb) return fb - fa;
        // 2. Red estratégica
        const sa = a.in_strategic_network ? 1 : 0, sb = b.in_strategic_network ? 1 : 0;
        if (sa !== sb) return sb - sa;
        // 3. Más mensajes históricos
        const ca = a.wa_message_count || 0, cb = b.wa_message_count || 0;
        if (ca !== cb) return cb - ca;
        // 4. Mejor calidad de nombre
        const na = nameQuality(a), nb = nameQuality(b);
        if (na !== nb) return nb - na;
        // 5. Más antiguo
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return ta - tb;
      });
      return sorted[0];
    }

    const winner = pickBest(candidates);

    if (winner) {
      contactId = winner.id;
      contactIsFavorite = !!winner.is_favorite;
      // Normaliza wa_id si no era el canónico
      if (winner.wa_id !== waId) {
        await supabase.from("people_contacts").update({ wa_id: waId }).eq("id", winner.id);
      }
      if (candidates.length > 1) {
        console.warn(
          `[contact] DUP for wa_id ${waId}: chose ${winner.id} (${winner.name}) among ${candidates.length} candidates`,
        );
      }
    } else {
      // Sin match por teléfono → crear nuevo
      const cleanPush = (pushName && pushName.trim()) || waId;
      const { data: newContact, error: createErr } = await supabase
        .from("people_contacts")
        .insert({
          user_id: userId,
          name: cleanPush,
          wa_id: waId,
          category: "pendiente",
          phone_numbers: [waId],
        })
        .select("id")
        .single();
      if (createErr) {
        console.error("create contact failed:", createErr);
      } else {
        contactId = newContact.id;
        console.log(`[contact] Created new contact "${cleanPush}" (${contactId}) for wa_id ${waId}`);
      }
    }

    // ============================
    // AUTO-CORRECT GARBAGE NAMES
    // If contact name looks like junk (= waId, numeric, or = owner name "Agustín"),
    // and incoming pushName is a real human name, fix it.
    // ============================
    if (contactId && direction === "incoming" && pushName && pushName.trim()) {
      const cleanPush = pushName.trim();
      const hasLetters = /\p{L}/u.test(cleanPush);
      const isPushNumeric = /^[0-9+\s-]+$/.test(cleanPush);
      if (hasLetters && !isPushNumeric && cleanPush !== waId) {
        const { data: cur } = await supabase
          .from("people_contacts")
          .select("name")
          .eq("id", contactId)
          .maybeSingle();
        const curName = (cur?.name || "").trim();
        const isGarbage =
          !curName ||
          curName === waId ||
          /^[0-9+\s-]+$/.test(curName) ||
          ["agustín", "agustin"].includes(curName.toLowerCase());
        if (isGarbage && curName !== cleanPush) {
          await supabase
            .from("people_contacts")
            .update({ name: cleanPush })
            .eq("id", contactId);
          console.log(`[contact] Auto-renamed ${contactId}: "${curName}" -> "${cleanPush}"`);
        }
      }
    }

    // ============================
    // PERSIST MESSAGE (with external_id)
    // ============================
    const insertPayload: Record<string, unknown> = {
      contact_id: contactId,
      user_id: userId,
      content: textContent,
      direction,
      sender: senderName,
      source: "whatsapp",
      message_date: messageDate,
    };
    if (externalId) insertPayload.external_id = externalId;

    const { data: insertedMessage, error: msgErr } = await supabase
      .from("contact_messages")
      .insert(insertPayload)
      .select("id")
      .single();

    if (msgErr) {
      // If race condition hit unique index, return success
      if (msgErr.code === "23505") {
        console.log(`[idempotency] Race conflict on ${externalId}, treating as deduped`);
        return new Response(JSON.stringify({ ok: true, deduped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("insert message failed:", msgErr);
      return new Response(JSON.stringify({ ok: false, error: "insert_message_failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Message persisted: ${insertedMessage.id} (${direction}) from ${senderName}${contactId ? "" : " [UNLINKED]"}`);

    // ============================
    // BUMP last_contact on people_contacts (handles NULL correctly)
    // ============================
    if (contactId) {
      const { data: cur } = await supabase
        .from("people_contacts")
        .select("last_contact")
        .eq("id", contactId)
        .maybeSingle();
      const curMs = cur?.last_contact ? new Date(cur.last_contact).getTime() : 0;
      const newMs = new Date(messageDate).getTime();
      if (!cur?.last_contact || newMs > curMs) {
        await supabase
          .from("people_contacts")
          .update({ last_contact: messageDate })
          .eq("id", contactId);
      }
    }

    // ============================
    // FIRE MEDIA PROCESSOR (audio/image/document) in background
    // ============================
    if (mediaKind === "audio" || mediaKind === "image" || mediaKind === "document") {
      const mediaJob = fetch(`${supabaseUrl}/functions/v1/process-whatsapp-media`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messageId: insertedMessage.id,
          contactId,
          userId,
          instance: instanceName,
          messageKey: key,
          mediaKind,
          mimeType: mediaMimeType,
          fileName: mediaFileName,
          caption: mediaCaption,
        }),
      }).catch((err) => console.error("[process-whatsapp-media] fire error:", err));
      // @ts-ignore EdgeRuntime is provided by Supabase runtime
      if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any)?.waitUntil) {
        // @ts-ignore
        (EdgeRuntime as any).waitUntil(mediaJob);
      }
    }

    // ============================
    // FIRE INTELLIGENCE (only if contact known)
    // ============================
    if (direction === "incoming" && contactId) {
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
        fetch(`${supabaseUrl}/functions/v1/contact-analysis`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ contactId, userId, scope: "profesional" }),
        }).catch((err) => console.error("contact-analysis fire error:", err));
      }

      // ============================
      // VOLUME TRIGGER ≥30 NEW MESSAGES SINCE LAST PROFILE UPDATE
      // Independent of the 100-msg bio refresh below; this one fires
      // whenever ≥30 messages accumulated since people_contacts.updated_at.
      // Only for contacts in the strategic network or favorites.
      // ============================
      try {
        const { data: contactRow } = await supabase
          .from("people_contacts")
          .select("updated_at, is_favorite, in_strategic_network")
          .eq("id", contactId)
          .maybeSingle();

        const isTracked = contactRow?.is_favorite || contactRow?.in_strategic_network;
        if (isTracked && contactRow?.updated_at) {
          const { count: newSince } = await supabase
            .from("contact_messages")
            .select("id", { count: "exact", head: true })
            .eq("contact_id", contactId)
            .eq("user_id", userId)
            .gt("created_at", contactRow.updated_at);

          if ((newSince || 0) >= 30) {
            // Throttle: avoid double-firing within 30 minutes
            const updatedAtMs = new Date(contactRow.updated_at).getTime();
            const sinceUpdate = Date.now() - updatedAtMs;
            if (sinceUpdate > 30 * 60 * 1000) {
              console.log(`[volume-trigger] Firing contact-analysis for ${contactId} (${newSince} new msgs since ${contactRow.updated_at})`);
              await supabase
                .from("people_contacts")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", contactId);
              fetch(`${supabaseUrl}/functions/v1/contact-analysis`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${supabaseKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  contact_id: contactId,
                  user_id: userId,
                  scopes: ["profesional", "personal", "familiar"],
                  include_historical: false,
                }),
              }).catch((err) => console.error("[volume-trigger] error:", err));
            }
          }
        }
      } catch (e) {
        console.error("[volume-trigger] error:", e);
      }

      if (contactIsFavorite) {
        fetch(`${supabaseUrl}/functions/v1/generate-response-draft`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contact_id: contactId,
            user_id: userId,
            message_id: insertedMessage.id,
            message_content: textContent,
          }),
        }).catch((err) => console.error("generate-response-draft fire error:", err));
      }

      // ============================
      // BIO AUTO-REFRESH
      // Every 100 messages exchanged with a contact (and >5 min since the
      // previous message, and >1h since last bio refresh) → re-run
      // contact-analysis to refresh the bio + invalidate headlines cache.
      // ============================
      try {
        const { count: totalMsgs } = await supabase
          .from("contact_messages")
          .select("id", { count: "exact", head: true })
          .eq("contact_id", contactId)
          .eq("user_id", userId);

        const total = totalMsgs || 0;
        if (total > 0 && total % 100 === 0) {
          const { data: prevMsg } = await supabase
            .from("contact_messages")
            .select("message_date")
            .eq("contact_id", contactId)
            .eq("user_id", userId)
            .neq("id", insertedMessage.id)
            .order("message_date", { ascending: false })
            .limit(1)
            .maybeSingle();

          const prevDate = prevMsg?.message_date ? new Date(prevMsg.message_date).getTime() : 0;
          const ageMs = Date.now() - prevDate;
          if (ageMs > 5 * 60 * 1000) {
            // Throttle: only refresh if last refresh was >1h ago (or never)
            const { data: contactRow } = await supabase
              .from("people_contacts")
              .select("last_bio_refresh_at")
              .eq("id", contactId)
              .maybeSingle();

            const lastRefresh = contactRow?.last_bio_refresh_at
              ? new Date(contactRow.last_bio_refresh_at).getTime()
              : 0;
            const sinceRefresh = Date.now() - lastRefresh;
            if (sinceRefresh > 60 * 60 * 1000) {
              console.log(`[bio-refresh] Triggering for contact ${contactId} at ${total} msgs`);
              await supabase
                .from("people_contacts")
                .update({ last_bio_refresh_at: new Date().toISOString() })
                .eq("id", contactId);
              // Fire contact-analysis (refreshes bio)
              fetch(`${supabaseUrl}/functions/v1/contact-analysis`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${supabaseKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ contactId, userId, scope: "profesional" }),
              }).catch((err) => console.error("[bio-refresh] contact-analysis error:", err));
              // Invalidate headlines cache (delete row → next view regenerates)
              await supabase
                .from("contact_headlines")
                .delete()
                .eq("contact_id", contactId)
                .eq("user_id", userId);
            }
          }
        }
      } catch (e) {
        console.error("[bio-refresh] error:", e);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, contact_id: contactId, message_id: insertedMessage.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Evolution webhook error:", err);
    return new Response(JSON.stringify({ ok: true, error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
