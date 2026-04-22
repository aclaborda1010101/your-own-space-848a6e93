import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Same normalisation used by evolution-webhook so wa_ids stay consistent
function normalizeWaId(raw: string): string {
  if (!raw) return "";
  const beforeColon = raw.split(":")[0];
  return beforeColon.replace(/\D/g, "");
}

function last9(num: string): string {
  const n = normalizeWaId(num);
  return n.length >= 9 ? n.slice(-9) : n;
}

interface Body {
  contact_id: string;
  phone: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimData, error: claimErr } = await userClient.auth.getClaims(token);
    if (claimErr || !claimData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimData.claims.sub as string;

    // ── Body validation ──
    let body: Body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const contactId = String(body?.contact_id || "").trim();
    const rawPhone = String(body?.phone || "").trim();
    if (!contactId || !rawPhone) {
      return new Response(
        JSON.stringify({ error: "contact_id and phone are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const waId = normalizeWaId(rawPhone);
    const tail9 = last9(rawPhone);
    if (!waId || waId.length < 7) {
      return new Response(JSON.stringify({ error: "phone too short after normalisation" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // ── 1) Verify the contact belongs to this user and load it ──
    const { data: contact, error: contactErr } = await admin
      .from("people_contacts")
      .select("id, user_id, name, wa_id, phone_numbers")
      .eq("id", contactId)
      .eq("user_id", userId)
      .maybeSingle();

    if (contactErr) throw contactErr;
    if (!contact) {
      return new Response(JSON.stringify({ error: "Contact not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2) Set wa_id + ensure phone_numbers contains canonical & raw forms ──
    const existingPhones = new Set<string>(
      Array.isArray(contact.phone_numbers) ? contact.phone_numbers : [],
    );
    existingPhones.add(rawPhone);
    existingPhones.add(waId);
    existingPhones.add(`+${waId}`);

    const updatePayload: Record<string, unknown> = {
      phone_numbers: Array.from(existingPhones).filter(Boolean),
    };
    if (!contact.wa_id) updatePayload.wa_id = waId;

    const { error: updErr } = await admin
      .from("people_contacts")
      .update(updatePayload)
      .eq("id", contactId);
    if (updErr) throw updErr;

    // ── 3) Re-attach orphan messages (contact_id IS NULL) for this user ──
    // Match on chat_name / sender / external_id using normalised digits.
    // We do it in JS-side batches because chat_name/sender can be formatted
    // ("+34 638 52 49 59"), so we must compare by digits-only suffix.

    const PAGE = 1000;
    let scanned = 0;
    let linked = 0;
    let from = 0;
    const tail9Pad = tail9.padStart(9, "0");

    while (true) {
      const { data: orphans, error: orphErr } = await admin
        .from("contact_messages")
        .select("id, chat_name, sender, external_id")
        .eq("user_id", userId)
        .is("contact_id", null)
        .range(from, from + PAGE - 1);
      if (orphErr) throw orphErr;
      if (!orphans || orphans.length === 0) break;

      const matchedIds: string[] = [];
      for (const m of orphans) {
        scanned++;
        const candidates: string[] = [];
        if (m.chat_name) candidates.push(String(m.chat_name));
        if (m.sender) candidates.push(String(m.sender));
        if (m.external_id) candidates.push(String(m.external_id));
        const hit = candidates.some((c) => {
          const digits = c.replace(/\D/g, "");
          if (!digits) return false;
          if (digits === waId) return true;
          if (digits.endsWith(tail9Pad)) return true;
          if (waId.endsWith(digits) && digits.length >= 7) return true;
          return false;
        });
        if (hit) matchedIds.push(m.id);
      }

      if (matchedIds.length > 0) {
        // Update in chunks of 200 to avoid url/payload bloat
        for (let i = 0; i < matchedIds.length; i += 200) {
          const slice = matchedIds.slice(i, i + 200);
          const { error: linkErr } = await admin
            .from("contact_messages")
            .update({ contact_id: contactId })
            .in("id", slice);
          if (linkErr) throw linkErr;
          linked += slice.length;
        }
      }

      if (orphans.length < PAGE) break;
      from += PAGE;
      // Safety cap so a runaway never blocks the function
      if (scanned > 200_000) break;
    }

    // ── 4) Bump wa_message_count and trigger profile refresh (fire-and-forget) ──
    if (linked > 0) {
      const { count } = await admin
        .from("contact_messages")
        .select("id", { count: "exact", head: true })
        .eq("contact_id", contactId)
        .eq("user_id", userId);

      await admin
        .from("people_contacts")
        .update({
          wa_message_count: count ?? linked,
          last_contact: new Date().toISOString(),
        })
        .eq("id", contactId);
    }

    // Trigger contact-analysis async (don't await — let it run in background)
    const analysisPromise = fetch(`${supabaseUrl}/functions/v1/contact-analysis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        contact_id: contactId,
        user_id: userId,
        scopes: ["profesional", "personal", "familiar"],
        include_historical: true,
      }),
    }).catch((e) => console.error("[link-contact-history] analysis dispatch failed:", e));

    // EdgeRuntime.waitUntil keeps the request alive for the background job
    // without blocking the HTTP response
    try {
      // @ts-ignore — EdgeRuntime is a Deno Deploy global
      EdgeRuntime.waitUntil(analysisPromise);
    } catch {
      // Local/dev fallback: not awaiting is fine
    }

    return new Response(
      JSON.stringify({
        ok: true,
        scanned,
        linked_messages: linked,
        wa_id: waId,
        profile_refresh: "queued",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[link-contact-history] error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
