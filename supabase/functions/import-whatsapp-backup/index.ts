import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Types ────────────────────────────────────────────────────────────────────

interface ChatBatch {
  chatName: string;
  isGroup: boolean;
  speakers: Record<string, number>; // speaker name → count
  messages: Array<{
    sender: string;
    content: string;
    messageDate: string | null;
    direction: "incoming" | "outgoing";
  }>;
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isValidContactName(name: string): boolean {
  if (!name || name.length < 2) return false;
  if (/^\+?\d[\d\s\-()]+$/.test(name)) return false;
  if (/^[^\w\s]+$/.test(name)) return false;
  if (name.length > 100) return false;
  return true;
}

// ── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { job_id, chats, batch_index = 0, total_batches = 1 } = body as {
      job_id: string;
      chats: ChatBatch[];
      batch_index: number;
      total_batches: number;
    };

    if (!job_id || !chats || !Array.isArray(chats)) {
      return new Response(JSON.stringify({ error: "job_id and chats[] required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get job info
    const { data: job, error: jobErr } = await supabase
      .from("import_jobs")
      .select("*")
      .eq("id", job_id)
      .single();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = job.user_id;

    // Mark as processing on first batch
    if (batch_index === 0) {
      await supabase.from("import_jobs").update({
        status: "processing",
        updated_at: new Date().toISOString(),
      }).eq("id", job_id);
    }

    // Load existing contacts
    const contactsMap = new Map<string, { id: string; name: string }>();
    const { data: existingContacts } = await supabase
      .from("people_contacts")
      .select("id, name")
      .eq("user_id", userId)
      .order("name")
      .limit(5000);

    if (existingContacts) {
      for (const c of existingContacts) {
        contactsMap.set(c.name.toLowerCase().trim().replace(/\s+/g, " "), { id: c.id, name: c.name });
      }
    }

    function matchContact(name: string): { id: string; name: string } | null {
      const lower = name.toLowerCase().trim().replace(/\s+/g, " ");
      if (contactsMap.has(lower)) return contactsMap.get(lower)!;
      const noAccent = stripAccents(lower);
      for (const [key, val] of contactsMap.entries()) {
        if (stripAccents(key) === noAccent) return val;
      }
      return null;
    }

    let messagesStored = job.messages_stored || 0;
    let messagesFailed = job.messages_failed || 0;
    let contactsCreated = job.contacts_created || 0;
    let processedChats = job.processed_chats || 0;

    // Process each chat in this batch
    for (const chat of chats) {
      try {
        const { chatName, isGroup, speakers, messages } = chat;
        if (!messages || messages.length === 0) {
          processedChats++;
          continue;
        }

        // Find or create contact(s)
        const speakerNames = Object.keys(speakers);
        let primaryContactId: string | null = null;

        if (isGroup) {
          // For groups, create/find each speaker
          for (const speaker of speakerNames) {
            if (!isValidContactName(speaker)) continue;
            let match = matchContact(speaker);
            if (!match) {
              const { data: newContact, error: createErr } = await supabase
                .from("people_contacts")
                .insert({
                  user_id: userId,
                  name: speaker,
                  source: "whatsapp_backup",
                  wa_message_count: speakers[speaker] || 0,
                  metadata: { groups: [chatName] },
                })
                .select("id, name")
                .single();
              if (!createErr && newContact) {
                match = { id: newContact.id, name: newContact.name };
                contactsMap.set(speaker.toLowerCase().trim().replace(/\s+/g, " "), match);
                contactsCreated++;
              }
            } else {
              // Update wa_message_count
              await supabase.from("people_contacts").update({
                wa_message_count: (speakers[speaker] || 0),
                last_contact: new Date().toISOString(),
              }).eq("id", match.id);
            }
            if (!primaryContactId && match) primaryContactId = match.id;
          }
        } else {
          // 1-to-1 chat: use the main speaker or chatName
          const mainSpeaker = speakerNames.length > 0 ? speakerNames[0] : chatName;
          const contactName = isValidContactName(mainSpeaker) ? mainSpeaker : chatName;
          let match = matchContact(contactName);
          if (!match && isValidContactName(contactName)) {
            const totalIncoming = Object.values(speakers).reduce((a, b) => a + b, 0);
            const { data: newContact, error: createErr } = await supabase
              .from("people_contacts")
              .insert({
                user_id: userId,
                name: contactName,
                source: "whatsapp_backup",
                wa_message_count: totalIncoming,
              })
              .select("id, name")
              .single();
            if (!createErr && newContact) {
              match = { id: newContact.id, name: newContact.name };
              contactsMap.set(contactName.toLowerCase().trim().replace(/\s+/g, " "), match);
              contactsCreated++;
            }
          } else if (match) {
            const totalIncoming = Object.values(speakers).reduce((a, b) => a + b, 0);
            await supabase.from("people_contacts").update({
              wa_message_count: totalIncoming,
              last_contact: new Date().toISOString(),
            }).eq("id", match.id);
          }
          primaryContactId = match?.id || null;
        }

        // Insert messages in batches of 500
        const BATCH_SIZE = 500;
        for (let i = 0; i < messages.length; i += BATCH_SIZE) {
          const batch = messages.slice(i, i + BATCH_SIZE).map((m) => ({
            user_id: userId,
            contact_id: primaryContactId,
            chat_name: chatName,
            sender: m.sender,
            content: m.content,
            message_date: m.messageDate,
            direction: m.direction,
            source: "whatsapp_backup",
          }));

          const { error: insertErr, count } = await supabase
            .from("contact_messages")
            .insert(batch);

          if (insertErr) {
            // Retry in smaller batches
            let smallFailed = 0;
            for (let j = 0; j < batch.length; j += 50) {
              const smallBatch = batch.slice(j, j + 50);
              const { error: retryErr } = await supabase
                .from("contact_messages")
                .insert(smallBatch);
              if (retryErr) {
                smallFailed += smallBatch.length;
              } else {
                messagesStored += smallBatch.length;
              }
            }
            messagesFailed += smallFailed;
          } else {
            messagesStored += batch.length;
          }
        }

        processedChats++;
      } catch (chatErr) {
        console.error(`[import-whatsapp-backup] Error processing chat:`, chatErr);
        messagesFailed += chat.messages?.length || 0;
        processedChats++;
      }
    }

    // Determine if this is the last batch
    const isLastBatch = batch_index >= total_batches - 1;
    const newStatus = isLastBatch ? "done" : "processing";

    await supabase.from("import_jobs").update({
      status: newStatus,
      processed_chats: processedChats,
      messages_stored: messagesStored,
      messages_failed: messagesFailed,
      contacts_created: contactsCreated,
      updated_at: new Date().toISOString(),
    }).eq("id", job_id);

    console.log(`[import-whatsapp-backup] Batch ${batch_index + 1}/${total_batches}: ${chats.length} chats, ${messagesStored} msgs stored, status=${newStatus}`);

    // ── Auto-trigger contact-analysis for top contacts after last batch ──
    if (isLastBatch && messagesStored > 0) {
      try {
        const { data: topContacts } = await supabase
          .from("people_contacts")
          .select("id, name, categories")
          .eq("user_id", userId)
          .eq("source", "whatsapp_backup")
          .order("wa_message_count", { ascending: false })
          .limit(10);

        if (topContacts && topContacts.length > 0) {
          const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;
          for (const c of topContacts) {
            const scopes = (c as any).categories || ["profesional"];
            console.log(`[import-whatsapp-backup] Triggering contact-analysis for ${c.name}`);
            fetch(`${supabaseUrl}/functions/v1/contact-analysis`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${supabaseKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ contact_id: c.id, scopes }),
            }).catch((err) => console.error(`[import-whatsapp-backup] contact-analysis fire error:`, err));
          }
        }
      } catch (triggerErr) {
        console.error("[import-whatsapp-backup] Error triggering contact-analysis:", triggerErr);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      batch_index,
      processed_chats: processedChats,
      messages_stored: messagesStored,
      status: newStatus,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[import-whatsapp-backup] Fatal error:", err);
    // Try to mark job as error
    try {
      const body2 = JSON.parse(await req.clone().text());
      if (body2.job_id) {
        await supabase.from("import_jobs").update({
          status: "error",
          error_message: err?.message || "Unknown error",
          updated_at: new Date().toISOString(),
        }).eq("id", body2.job_id);
      }
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
