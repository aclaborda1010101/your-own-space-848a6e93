import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Always return 200 — webhook must never fail
  try {
    const body = await req.json();
    console.log("Evolution webhook received:", JSON.stringify(body).substring(0, 500));

    // Extract data from Evolution API payload
    const data = body.data || body;
    const { message, key, messageTimestamp, pushName } = data;

    if (!key || !message) {
      console.log("No key or message in payload, skipping");
      return new Response(JSON.stringify({ ok: true, skipped: "no_data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip group messages
    if (key.remoteJid?.includes("@g.us")) {
      console.log("Group message, skipping");
      return new Response(JSON.stringify({ ok: true, skipped: "group" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract text content
    const textContent =
      message?.conversation ||
      message?.extendedTextMessage?.text ||
      null;

    if (!textContent) {
      console.log("No text content, skipping");
      return new Response(JSON.stringify({ ok: true, skipped: "no_text" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract WhatsApp ID
    const waId = key.remoteJid?.split("@")[0];
    if (!waId) {
      console.log("No waId extracted, skipping");
      return new Response(JSON.stringify({ ok: true, skipped: "no_waid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const direction = key.fromMe ? "outgoing" : "incoming";
    const senderName = key.fromMe ? "Yo" : (pushName || waId);
    const messageDate = messageTimestamp
      ? new Date(Number(messageTimestamp) * 1000).toISOString()
      : new Date().toISOString();

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Resolve user_id
    const userId = Deno.env.get("EVOLUTION_DEFAULT_USER_ID");
    if (!userId) {
      console.error("EVOLUTION_DEFAULT_USER_ID not configured");
      return new Response(JSON.stringify({ ok: false, error: "no_user_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find or create contact
    let contactId: string;

    // Try by wa_id first
    const { data: contactByWaId } = await supabase
      .from("people_contacts")
      .select("id")
      .eq("wa_id", waId)
      .eq("user_id", userId)
      .maybeSingle();

    if (contactByWaId) {
      contactId = contactByWaId.id;
    } else {
      // Try by phone_numbers array
      const { data: contactByPhone } = await supabase
        .from("people_contacts")
        .select("id")
        .eq("user_id", userId)
        .contains("phone_numbers", [waId])
        .maybeSingle();

      if (contactByPhone) {
        contactId = contactByPhone.id;
        // Update wa_id for future lookups
        await supabase
          .from("people_contacts")
          .update({ wa_id: waId })
          .eq("id", contactId);
      } else {
        // Create new contact
        const { data: newContact, error: createErr } = await supabase
          .from("people_contacts")
          .insert({
            user_id: userId,
            name: pushName || waId,
            wa_id: waId,
            category: "pendiente",
            phone_numbers: [waId],
          })
          .select("id")
          .single();

        if (createErr || !newContact) {
          console.error("Error creating contact:", createErr);
          return new Response(JSON.stringify({ ok: false, error: "create_contact_failed" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        contactId = newContact.id;
        console.log(`New contact created: ${pushName || waId} (${contactId})`);
      }
    }

    // Persist message
    const { data: insertedMessage, error: msgErr } = await supabase
      .from("contact_messages")
      .insert({
        contact_id: contactId,
        user_id: userId,
        content: textContent,
        direction,
        sender: senderName,
        source: "whatsapp",
        message_date: messageDate,
      })
      .select("id")
      .single();

    if (msgErr) {
      console.error("Error inserting message:", msgErr);
      return new Response(JSON.stringify({ ok: false, error: "insert_message_failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Message persisted: ${insertedMessage.id} (${direction}) from ${senderName}`);

    // Only trigger intelligence for incoming messages
    if (direction === "incoming") {
      // Check if we should trigger contact-analysis
      let shouldAnalyze = textContent.length > 20;

      if (!shouldAnalyze) {
        // Check if this is the 5th message today
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

      // Fire contact-analysis asynchronously
      if (shouldAnalyze) {
        console.log(`Triggering contact-analysis for ${contactId}`);
        fetch(`${supabaseUrl}/functions/v1/contact-analysis`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contactId,
            userId,
            scope: "profesional",
          }),
        }).catch((err) => console.error("contact-analysis fire error:", err));
      }

      // Fire generate-response-draft asynchronously
      console.log(`Triggering generate-response-draft for ${contactId}`);
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
