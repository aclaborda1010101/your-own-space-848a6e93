import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── CSV Parsing (ported from frontend) ───────────────────────────────────────

function splitCSVLines(csvText: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    if (inQuotes) {
      if (ch === '"') {
        if (csvText[i + 1] === '"') { current += '""'; i++; }
        else { inQuotes = false; current += ch; }
      } else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; current += ch; }
      else if (ch === "\n") { lines.push(current); current = ""; }
      else if (ch === "\r") { if (csvText[i + 1] === "\n") i++; lines.push(current); current = ""; }
      else { current += ch; }
    }
  }
  if (current) lines.push(current);
  return lines;
}

function parseCSVFields(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === "," || ch === ";" || ch === "\t") { result.push(current.trim()); current = ""; }
      else { current += ch; }
    }
  }
  result.push(current.trim());
  return result;
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

interface BackupColumnMap {
  chatName: number;
  date: number;
  direction: number;
  phone: number;
  contactName: number;
  message: number;
  mediaType: number;
  hasHeaders: boolean;
}

const COLUMN_ALIASES: Record<string, string[]> = {
  chatName: ["sesion", "chat", "nombre del chat", "chat name", "session", "conversacion", "grupo"],
  date: ["fecha", "date", "fecha de envio", "timestamp", "datetime", "send date", "fecha envio", "fecha del mensaje"],
  direction: ["tipo", "direction", "direccion", "type", "sentido"],
  phone: ["telefono", "phone", "numero", "number", "tel", "movil", "mobile", "numero de telefono"],
  contactName: ["contacto", "contact", "nombre", "name", "remitente", "sender", "from", "contact name", "nombre contacto", "nombre del remitente"],
  message: ["mensaje", "message", "texto", "text", "content", "body", "contenido"],
  mediaType: ["tipo de medio", "media type", "media", "tipo medio", "archivo", "attachment", "adjunto"],
};

const DIRECTION_INCOMING = ["entrante", "incoming", "recibido", "received", "in"];
const DIRECTION_OUTGOING = ["saliente", "outgoing", "enviado", "sent", "out"];
const DIRECTION_NOTIFICATION = ["notificacion", "notification", "sistema", "system"];

function classifyDirection(raw: string): "incoming" | "outgoing" | "notification" | null {
  const v = stripAccents(raw.trim().toLowerCase());
  if (DIRECTION_INCOMING.includes(v)) return "incoming";
  if (DIRECTION_OUTGOING.includes(v)) return "outgoing";
  if (DIRECTION_NOTIFICATION.includes(v)) return "notification";
  return null;
}

function looksLikeDate(val: string): boolean {
  if (!val || val.length < 6) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) return true;
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(val)) return true;
  return false;
}

function detectBackupColumns(firstRowCols: string[], sampleDataRows?: string[][]): BackupColumnMap | null {
  const normalized = firstRowCols.map((c) => stripAccents(c.trim().toLowerCase()));

  const findCol = (aliases: string[]): number => {
    for (const alias of aliases) {
      const idx = normalized.findIndex((h) => h === alias || h.includes(alias));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const detected: Record<string, number> = {};
  let matchCount = 0;
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    const idx = findCol(aliases);
    if (idx >= 0) { detected[key] = idx; matchCount++; }
  }

  let colMap: BackupColumnMap | null = null;

  if (matchCount >= 3) {
    colMap = {
      chatName: detected.chatName ?? 0,
      date: detected.date ?? 1,
      direction: detected.direction ?? -1,
      phone: detected.phone ?? -1,
      contactName: detected.contactName ?? -1,
      message: detected.message ?? -1,
      mediaType: detected.mediaType ?? -1,
      hasHeaders: true,
    };
  } else if (firstRowCols.length >= 10) {
    colMap = {
      chatName: 0, date: 1, direction: 3, phone: 4,
      contactName: 5, message: 8, mediaType: 10, hasHeaders: false,
    };
  }

  if (!colMap || colMap.message < 0) return colMap;

  // Validate message column
  if (sampleDataRows && sampleDataRows.length > 0) {
    let dateCount = 0;
    const samplesToCheck = Math.min(5, sampleDataRows.length);
    for (let i = 0; i < samplesToCheck; i++) {
      const msgVal = (sampleDataRows[i][colMap.message] || "").trim();
      if (looksLikeDate(msgVal)) dateCount++;
    }
    if (dateCount > samplesToCheck * 0.6) {
      const usedCols = new Set([colMap.chatName, colMap.date, colMap.direction, colMap.phone, colMap.contactName, colMap.mediaType].filter((c) => c >= 0));
      const numCols = Math.max(...sampleDataRows.map((r) => r.length));
      let bestCol = -1, bestScore = 0;
      for (let c = 0; c < numCols; c++) {
        if (usedCols.has(c) || c === colMap.message) continue;
        let textCount = 0, totalLen = 0;
        for (const row of sampleDataRows) {
          const val = (row[c] || "").trim();
          if (val && !looksLikeDate(val) && val.length > 1) { textCount++; totalLen += val.length; }
        }
        const score = textCount * 10 + totalLen;
        if (score > bestScore) { bestScore = score; bestCol = c; }
      }
      if (bestCol >= 0) colMap.message = bestCol;
    }
  }

  return colMap;
}

function isBackupHeaderRow(cols: string[]): boolean {
  if (cols.length < 5) return false;
  const normalized = cols.map((c) => stripAccents(c.trim().toLowerCase()));
  let matchCount = 0;
  for (const aliases of Object.values(COLUMN_ALIASES)) {
    if (aliases.some((a) => normalized.some((h) => h === a || h.includes(a)))) matchCount++;
  }
  return matchCount >= 3;
}

// ── Valid contact name check ─────────────────────────────────────────────────

function isValidContactName(name: string): boolean {
  if (!name || name.length < 2) return false;
  if (/^\+?\d[\d\s\-()]+$/.test(name)) return false;
  if (/^[^\w\s]+$/.test(name)) return false;
  if (name.length > 100) return false;
  return true;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ChatMessages {
  speakers: Map<string, number>;
  myMessages: number;
  isGroup: boolean;
  messages: Array<{
    sender: string;
    content: string;
    messageDate: string | null;
    direction: "incoming" | "outgoing";
  }>;
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
    // Auth check
    const authHeader = req.headers.get("Authorization");
    let userId: string;

    const body = await req.json();
    const { job_id, start_index = 0 } = body;

    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
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

    userId = job.user_id;

    // If auth header provided, validate it
    if (authHeader?.startsWith("Bearer ")) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims, error: claimsErr } = await authClient.auth.getClaims(
        authHeader.replace("Bearer ", "")
      );
      if (!claimsErr && claims?.claims?.sub) {
        // Verify ownership
        if (claims.claims.sub !== userId) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Mark as processing
    if (start_index === 0) {
      await supabase
        .from("import_jobs")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", job_id);
    }

    // Download CSV from storage
    const filePath = job.file_path;
    if (!filePath) {
      await supabase.from("import_jobs").update({
        status: "error",
        error_message: "No file_path in job",
        updated_at: new Date().toISOString(),
      }).eq("id", job_id);
      return new Response(JSON.stringify({ error: "No file path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: fileData, error: dlErr } = await supabase.storage
      .from("import-files")
      .download(filePath);

    if (dlErr || !fileData) {
      await supabase.from("import_jobs").update({
        status: "error",
        error_message: `File download failed: ${dlErr?.message}`,
        updated_at: new Date().toISOString(),
      }).eq("id", job_id);
      return new Response(JSON.stringify({ error: "File download failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const csvText = await fileData.text();
    console.log(`[import-whatsapp-backup] CSV loaded: ${csvText.length} chars`);

    // ── Parse CSV once, group by chat ──────────────────────────────────────
    const lines = splitCSVLines(csvText).filter((l) => l.trim());
    if (lines.length < 2) {
      await supabase.from("import_jobs").update({
        status: "error",
        error_message: "CSV has no data rows",
        updated_at: new Date().toISOString(),
      }).eq("id", job_id);
      return new Response(JSON.stringify({ error: "Empty CSV" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstCols = parseCSVFields(lines[0]);
    const tentativeStart = isBackupHeaderRow(firstCols) ? 1 : 0;
    const sampleDataRows = lines.slice(tentativeStart, tentativeStart + 10).map((l) => parseCSVFields(l));
    const colMap = detectBackupColumns(firstCols, sampleDataRows);

    if (!colMap) {
      await supabase.from("import_jobs").update({
        status: "error",
        error_message: "Could not detect CSV column mapping",
        updated_at: new Date().toISOString(),
      }).eq("id", job_id);
      return new Response(JSON.stringify({ error: "Column detection failed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startIdx = colMap.hasHeaders || isBackupHeaderRow(firstCols) ? 1 : 0;

    // Get my identifiers from user profile
    const { data: profileData } = await supabase
      .from("user_profiles")
      .select("my_identifiers")
      .eq("id", userId)
      .maybeSingle();

    const myIds: string[] = ["yo"];
    if (profileData?.my_identifiers && typeof profileData.my_identifiers === "object") {
      const ids = profileData.my_identifiers as Record<string, unknown>;
      if (Array.isArray(ids.whatsapp_names)) myIds.push(...(ids.whatsapp_names as string[]));
      if (Array.isArray(ids.whatsapp_numbers)) myIds.push(...(ids.whatsapp_numbers as string[]));
    }
    const myIdsLower = myIds.map((id) => id.toLowerCase().trim());

    // ── Group all messages by chatName in ONE pass ─────────────────────────
    const chatMap = new Map<string, ChatMessages>();

    for (let i = startIdx; i < lines.length; i++) {
      const cols = parseCSVFields(lines[i]);
      if (cols.length < 3) continue;

      const chatName = cols[colMap.chatName]?.trim() || "(sin nombre)";
      const dirClass = colMap.direction >= 0 ? classifyDirection(cols[colMap.direction] || "") : null;
      if (dirClass === "notification") continue;

      const dateStr = cols[colMap.date]?.trim() || null;
      const contactName = colMap.contactName >= 0 ? cols[colMap.contactName]?.trim() : "";
      const phone = colMap.phone >= 0 ? cols[colMap.phone]?.trim() : "";
      const message = colMap.message >= 0 ? cols[colMap.message]?.trim() : "";
      const mediaType = colMap.mediaType >= 0 ? cols[colMap.mediaType]?.trim() : "";

      let content = message;
      if (!content && mediaType) content = `[${mediaType}]`;
      if (!content) continue;

      if (!chatMap.has(chatName)) {
        chatMap.set(chatName, { speakers: new Map(), myMessages: 0, isGroup: false, messages: [] });
      }
      const chat = chatMap.get(chatName)!;

      const isOutgoing = dirClass === "outgoing";
      let sender: string;
      if (isOutgoing) {
        sender = "Yo";
        chat.myMessages++;
      } else {
        sender = contactName || phone || "Desconocido";
        if (myIdsLower.includes(sender.toLowerCase().trim())) {
          sender = "Yo";
          chat.myMessages++;
        } else {
          chat.speakers.set(sender, (chat.speakers.get(sender) || 0) + 1);
        }
      }

      chat.messages.push({
        sender,
        content,
        messageDate: dateStr,
        direction: sender === "Yo" ? "outgoing" : "incoming",
      });
    }

    // Detect groups
    for (const chat of chatMap.values()) {
      chat.isGroup = chat.speakers.size >= 2;
    }

    const chatNames = Array.from(chatMap.keys());
    const totalChats = chatNames.length;

    // Update total
    if (start_index === 0) {
      await supabase.from("import_jobs").update({
        total_chats: totalChats,
        updated_at: new Date().toISOString(),
      }).eq("id", job_id);
    }

    console.log(`[import-whatsapp-backup] ${totalChats} chats detected, starting from index ${start_index}`);

    // ── Load existing contacts ────────────────────────────────────────────
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

    // ── Check existing chat_names to skip already imported ────────────────
    const existingChatNames = new Set<string>();
    const checkBatchSize = 50;
    for (let i = 0; i < chatNames.length; i += checkBatchSize) {
      const batch = chatNames.slice(i, i + checkBatchSize);
      const { data } = await supabase
        .from("contact_messages")
        .select("chat_name")
        .eq("user_id", userId)
        .in("chat_name", batch)
        .limit(batch.length);
      if (data) {
        for (const row of data) {
          if (row.chat_name) existingChatNames.add(row.chat_name);
        }
      }
    }

    // ── Process chats ─────────────────────────────────────────────────────
    const startTime = Date.now();
    const TIMEOUT_MS = 50_000; // leave 10s margin before 60s limit
    let processedChats = job.processed_chats || 0;
    let messagesStored = job.messages_stored || 0;
    let messagesFailed = job.messages_failed || 0;
    let contactsCreated = job.contacts_created || 0;

    function matchContact(name: string): { id: string; name: string } | null {
      const lower = name.toLowerCase().trim().replace(/\s+/g, " ");
      if (contactsMap.has(lower)) return contactsMap.get(lower)!;
      for (const [key, contact] of contactsMap.entries()) {
        if (key.includes(lower) || lower.includes(key)) return contact;
      }
      return null;
    }

    async function findOrCreate(name: string, context: string, metadata?: Record<string, unknown>): Promise<{ id: string; name: string; isNew: boolean }> {
      const existing = matchContact(name);
      if (existing) return { ...existing, isNew: false };
      if (!isValidContactName(name)) return { id: "", name, isNew: false };

      const insertData: Record<string, unknown> = {
        user_id: userId,
        name: name.trim().replace(/\s+/g, " "),
        context,
        brain: "personal",
      };
      if (metadata) insertData.metadata = metadata;

      const { data: newContact, error } = await supabase
        .from("people_contacts")
        .insert(insertData)
        .select("id, name")
        .single();

      if (error) {
        console.warn(`[import] Failed to create contact "${name}":`, error.message);
        return { id: "", name, isNew: false };
      }

      contactsMap.set(newContact.name.toLowerCase().trim().replace(/\s+/g, " "), {
        id: newContact.id,
        name: newContact.name,
      });
      return { id: newContact.id, name: newContact.name, isNew: true };
    }

    async function insertMessages(
      contactId: string,
      chatName: string,
      msgs: Array<{ sender: string; content: string; messageDate: string | null; direction: string }>
    ): Promise<{ ok: number; fail: number }> {
      let ok = 0, fail = 0;
      const batchSize = 500;
      for (let i = 0; i < msgs.length; i += batchSize) {
        const batch = msgs.slice(i, i + batchSize).map((m) => ({
          user_id: userId,
          contact_id: contactId,
          source: "whatsapp",
          sender: m.sender,
          content: m.content,
          message_date: (() => {
            if (!m.messageDate) return null;
            try {
              const normalized = String(m.messageDate).replace(" ", "T");
              const d = new Date(normalized);
              return isNaN(d.getTime()) ? null : d.toISOString();
            } catch {
              return null;
            }
          })(),
          chat_name: chatName,
          direction: m.direction,
        }));

        const { error: insertError } = await supabase.from("contact_messages").insert(batch);
        if (insertError) {
          // Retry in smaller chunks
          const smallBatch = 50;
          for (let j = 0; j < batch.length; j += smallBatch) {
            const mini = batch.slice(j, j + smallBatch);
            const { error: retryErr } = await supabase.from("contact_messages").insert(mini);
            if (retryErr) {
              fail += mini.length;
            } else {
              ok += mini.length;
            }
          }
        } else {
          ok += batch.length;
        }
      }
      return { ok, fail };
    }

    for (let ci = start_index; ci < chatNames.length; ci++) {
      // Check timeout
      if (Date.now() - startTime > TIMEOUT_MS) {
        console.log(`[import-whatsapp-backup] Timeout approaching at chat ${ci}/${totalChats}, self-invoking...`);
        // Persist progress
        await supabase.from("import_jobs").update({
          processed_chats: processedChats,
          messages_stored: messagesStored,
          messages_failed: messagesFailed,
          contacts_created: contactsCreated,
          metadata: { ...(job.metadata || {}), last_chat_index: ci },
          updated_at: new Date().toISOString(),
        }).eq("id", job_id);

        // Self-invoke to continue
        const selfUrl = `${supabaseUrl}/functions/v1/import-whatsapp-backup`;
        fetch(selfUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ job_id, start_index: ci }),
        }).catch((err) => console.error("[import] Self-invoke failed:", err));

        return new Response(
          JSON.stringify({ status: "continuing", processed: processedChats, next_index: ci }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const chatName = chatNames[ci];
      const chat = chatMap.get(chatName)!;

      // Skip already imported
      if (existingChatNames.has(chatName)) {
        processedChats++;
        continue;
      }

      if (chat.isGroup) {
        // Process each speaker in the group
        for (const [speakerName, msgCount] of chat.speakers.entries()) {
          const result = await findOrCreate(
            speakerName,
            `Importado desde grupo WhatsApp: ${chatName}`,
            { groups: [chatName] }
          );
          if (result.isNew) contactsCreated++;

          if (result.id) {
            // Store only this speaker's messages (+ Yo)
            const speakerMsgs = chat.messages.filter(
              (m) => m.sender === speakerName || m.sender === "Yo"
            );
            const { ok, fail } = await insertMessages(result.id, chatName, speakerMsgs);
            messagesStored += ok;
            messagesFailed += fail;

            // Update contact metadata
            const { data: existingContact } = await supabase
              .from("people_contacts")
              .select("wa_message_count, metadata")
              .eq("id", result.id)
              .single();

            const currentMeta = existingContact?.metadata && typeof existingContact.metadata === "object"
              ? existingContact.metadata as Record<string, unknown>
              : {};
            const currentGroups: string[] = Array.isArray(currentMeta.groups) ? currentMeta.groups as string[] : [];
            if (!currentGroups.includes(chatName)) currentGroups.push(chatName);

            await supabase
              .from("people_contacts")
              .update({
                wa_message_count: (existingContact?.wa_message_count || 0) + msgCount,
                metadata: { ...currentMeta, groups: currentGroups },
              })
              .eq("id", result.id);
          }
        }
      } else {
        // Individual chat
        let dominantSpeaker = "";
        let maxCount = 0;
        chat.speakers.forEach((count, name) => {
          if (count > maxCount) { maxCount = count; dominantSpeaker = name; }
        });
        if (!dominantSpeaker) dominantSpeaker = chatName;

        const result = await findOrCreate(dominantSpeaker, "Importado desde WhatsApp (backup CSV)");
        if (result.isNew) contactsCreated++;

        if (result.id) {
          const { ok, fail } = await insertMessages(result.id, chatName, chat.messages);
          messagesStored += ok;
          messagesFailed += fail;

          // Update wa_message_count + last_contact
          const lastMsg = chat.messages.reduce((latest: string | null, m) => {
            const d = m.messageDate;
            if (!d) return latest;
            return !latest || d > latest ? d : latest;
          }, null);

          await supabase
            .from("people_contacts")
            .update({
              wa_message_count: (maxCount || chat.messages.length),
              ...(lastMsg ? { last_contact: lastMsg } : {}),
            })
            .eq("id", result.id);
        }
      }

      processedChats++;

      // Update progress every 10 chats
      if (processedChats % 10 === 0 || ci === chatNames.length - 1) {
        await supabase.from("import_jobs").update({
          processed_chats: processedChats,
          messages_stored: messagesStored,
          messages_failed: messagesFailed,
          contacts_created: contactsCreated,
          updated_at: new Date().toISOString(),
        }).eq("id", job_id);
      }
    }

    // ── Done ──────────────────────────────────────────────────────────────
    await supabase.from("import_jobs").update({
      status: "done",
      processed_chats: processedChats,
      messages_stored: messagesStored,
      messages_failed: messagesFailed,
      contacts_created: contactsCreated,
      updated_at: new Date().toISOString(),
    }).eq("id", job_id);

    // Clean up storage file
    await supabase.storage.from("import-files").remove([filePath]);

    console.log(`[import-whatsapp-backup] DONE: ${processedChats} chats, ${messagesStored} msgs stored, ${messagesFailed} failed, ${contactsCreated} new contacts`);

    return new Response(
      JSON.stringify({
        status: "done",
        processed_chats: processedChats,
        messages_stored: messagesStored,
        messages_failed: messagesFailed,
        contacts_created: contactsCreated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[import-whatsapp-backup] Fatal error:", err);
    // Try to update job status
    try {
      const body2 = { job_id: "" };
      try { Object.assign(body2, await req.clone().json()); } catch { /* ignore */ }
      if (body2.job_id) {
        await supabase.from("import_jobs").update({
          status: "error",
          error_message: String(err),
          updated_at: new Date().toISOString(),
        }).eq("id", body2.job_id);
      }
    } catch { /* best effort */ }

    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
