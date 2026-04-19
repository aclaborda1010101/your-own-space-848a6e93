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

    const textContent =
      message?.conversation ||
      message?.extendedTextMessage?.text ||
      null;

    if (!textContent) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_text" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    // Resolve user_id from instance owner
    const instanceName = body.instance || "jarvis-whatsapp";
    const { data: owner } = await supabase
      .from("whatsapp_instance_owners")
      .select("user_id")
      .eq("instance_name", instanceName)
      .maybeSingle();

    const userId = owner?.user_id || Deno.env.get("EVOLUTION_DEFAULT_USER_ID");
    if (!userId) {
      console.error("No instance owner / EVOLUTION_DEFAULT_USER_ID");
      return new Response(JSON.stringify({ ok: false, error: "no_user_id" }), {
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
    // CONTACT RESOLUTION (improved)
    // ============================
    let contactId: string | null = null;
    let contactIsFavorite = false;

    // 1. Exact match by wa_id
    const { data: byWaId } = await supabase
      .from("people_contacts")
      .select("id, is_favorite")
      .eq("user_id", userId)
      .eq("wa_id", waId)
      .maybeSingle();

    if (byWaId) {
      contactId = byWaId.id;
      contactIsFavorite = !!byWaId.is_favorite;
    } else {
      // 2. Match by last 9 digits in wa_id (ES numbers ±34 prefix)
      const { data: byLast9 } = await supabase
        .from("people_contacts")
        .select("id, is_favorite, wa_id")
        .eq("user_id", userId)
        .like("wa_id", `%${waLast9}`)
        .limit(1)
        .maybeSingle();

      if (byLast9) {
        contactId = byLast9.id;
        contactIsFavorite = !!byLast9.is_favorite;
        // Normalize wa_id to canonical form
        await supabase.from("people_contacts").update({ wa_id: waId }).eq("id", contactId);
      } else {
        // 3. Match by phone_numbers array
        const { data: byPhone } = await supabase
          .from("people_contacts")
          .select("id, is_favorite")
          .eq("user_id", userId)
          .contains("phone_numbers", [waId])
          .maybeSingle();

        if (byPhone) {
          contactId = byPhone.id;
          contactIsFavorite = !!byPhone.is_favorite;
          await supabase.from("people_contacts").update({ wa_id: waId }).eq("id", contactId);
        } else if (pushName && pushName.trim() && pushName !== waId) {
          // 4. Match by name (manual contacts without wa_id)
          const { data: byName } = await supabase
            .from("people_contacts")
            .select("id, is_favorite")
            .eq("user_id", userId)
            .ilike("name", pushName)
            .is("wa_id", null)
            .maybeSingle();

          if (byName) {
            contactId = byName.id;
            contactIsFavorite = !!byName.is_favorite;
            await supabase
              .from("people_contacts")
              .update({ wa_id: waId, phone_numbers: [waId] })
              .eq("id", contactId);
            console.log(`[contact] Linked "${pushName}" with wa_id ${waId}`);
          } else {
            // 5. Create new contact ONLY when we have a real pushName
            const { data: newContact, error: createErr } = await supabase
              .from("people_contacts")
              .insert({
                user_id: userId,
                name: pushName,
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
              console.log(`[contact] Created ${pushName} (${contactId})`);
            }
          }
        } else {
          // No pushName + no match → leave unlinked, will reconcile later
          console.log(`[contact] Unlinked message from ${waId} (no pushName, no match)`);
        }
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
