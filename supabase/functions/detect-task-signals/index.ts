// detect-task-signals
// Extrae candidatos (tarea, reunión, follow-up, outreach) desde contact_messages
// (WhatsApp, email, notas) en lotes por contacto. Solo dispara cuando hay
// suficientes mensajes nuevos o cuando el cliente lo fuerza. Las sugerencias
// resultantes entran en la cola `suggestions` con status='pending' para que
// el usuario las valide. NO crea tareas/eventos automáticamente.
//
// MEMORIA: antes de llamar al LLM cargamos lo ya aceptado/rechazado/snoozed
// para ese contacto y lo inyectamos al prompt como "YA DECIDIDO — NO PROPONER".
// Además, antes de insertar comprobamos firma contra CUALQUIER status para
// evitar que se reinserten variantes ya decididas (el índice unique parcial
// sólo cubre pending y dejaba escapar duplicados tras aceptar/rechazar).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_THRESHOLD = 30;
const MAX_MESSAGES_PER_BATCH = 60; // ventana de contexto razonable
const MAX_HISTORY_PER_CONTACT = 30; // sugerencias previas que mostramos al LLM
const MODEL = "google/gemini-2.5-flash"; // barato y suficiente

type Suggestion = {
  type:
    | "task_from_signal"
    | "meeting_from_signal"
    | "followup_from_signal"
    | "outreach_from_signal";
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  date?: string;
  confidence: number;
  reasoning: string;
  source_message_ids?: string[];
};

type PriorDecision = {
  status: "accepted" | "rejected" | "snoozed";
  title: string;
  type: string;
  signature: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return j({ error: "unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const userId = userData?.user?.id;
    if (userErr || !userId) return j({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const threshold: number = body.threshold ?? DEFAULT_THRESHOLD;
    const force: boolean = !!body.force;
    const onlyContact: string | undefined = body.contact_id;

    // Service client to bypass RLS for cross-table aggregations
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Determine which contacts to scan
    const contactIds = await pickContactsToScan(admin, userId, { onlyContact, force, threshold });
    if (contactIds.length === 0) {
      return j({ scanned: 0, created: 0, skipped: 0, message: "no contacts above threshold" });
    }

    let totalCreated = 0;
    let totalSkipped = 0;
    const perContact: Array<{ contact_id: string; created: number; skipped: number }> = [];

    for (const contact_id of contactIds) {
      const result = await scanContact(admin, userId, contact_id);
      totalCreated += result.created;
      totalSkipped += result.skipped;
      perContact.push({ contact_id, created: result.created, skipped: result.skipped });
    }

    return j({ scanned: contactIds.length, created: totalCreated, skipped: totalSkipped, per_contact: perContact });
  } catch (e) {
    console.error("[detect-task-signals]", e);
    return j({ error: String(e) }, 500);
  }
});

async function pickContactsToScan(
  admin: any,
  userId: string,
  opts: { onlyContact?: string; force: boolean; threshold: number },
): Promise<string[]> {
  if (opts.onlyContact) return [opts.onlyContact];

  // count messages per contact in last 30 days
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: msgs } = await admin
    .from("contact_messages")
    .select("contact_id, message_date")
    .eq("user_id", userId)
    .gte("message_date", since)
    .limit(5000);

  const counts = new Map<string, number>();
  for (const m of (msgs ?? []) as any[]) {
    const cid = m.contact_id as string;
    if (!cid) continue;
    counts.set(cid, (counts.get(cid) ?? 0) + 1);
  }
  if (counts.size === 0) return [];

  const { data: states } = await admin
    .from("contact_refresh_state")
    .select("contact_id, last_scan_message_count")
    .eq("user_id", userId);

  const stateMap = new Map((states ?? []).map((s: any) => [s.contact_id, s.last_scan_message_count ?? 0]));

  const toScan: string[] = [];
  for (const [cid, total] of counts.entries()) {
    const last = stateMap.get(cid) ?? 0;
    const delta = total - last;
    if (opts.force || delta >= opts.threshold) toScan.push(cid);
  }
  return toScan.slice(0, 10); // safety cap per run
}

async function scanContact(
  admin: any,
  userId: string,
  contactId: string,
): Promise<{ created: number; skipped: number }> {
  const { data: contact } = await admin
    .from("people_contacts")
    .select("id, name, company")
    .eq("id", contactId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!contact) return { created: 0, skipped: 0 };

  const { data: messages } = await admin
    .from("contact_messages")
    .select("id, source, sender, content, message_date, direction")
    .eq("user_id", userId)
    .eq("contact_id", contactId)
    .order("message_date", { ascending: false })
    .limit(MAX_MESSAGES_PER_BATCH);

  if (!messages || messages.length === 0) return { created: 0, skipped: 0 };

  const orderedMessages = [...messages].reverse() as any[];

  const conversation = orderedMessages
    .map((m: any) =>
      `[${new Date(m.message_date as string).toISOString().slice(0, 16)}] ${m.direction === "outbound" ? "YO" : (m.sender || (contact as any).name)} (${m.source}): ${((m.content as string) || "").slice(0, 280)}`,
    )
    .join("\n");

  // Cargar memoria: lo ya decidido para este contacto
  const priorDecisions = await loadPriorDecisions(admin, userId, contactId);
  const priorSignatures = new Set(
    priorDecisions
      .map((p) => p.signature)
      .filter((s): s is string => !!s),
  );

  const suggestions = await extractWithLLM(contact as { id: string; name: string; company: string | null }, conversation, priorDecisions);

  let created = 0;
  let skipped = 0;
  for (const s of suggestions) {
    const signature = makeSignature(userId, contactId, s);

    // Pre-check: si la firma ya existe con CUALQUIER status, saltar.
    // Esto cierra el agujero del índice parcial (que sólo cubre pending).
    if (priorSignatures.has(signature)) {
      skipped++;
      continue;
    }
    const { data: existing } = await admin
      .from("suggestions")
      .select("id")
      .eq("user_id", userId)
      .eq("signature", signature)
      .limit(1)
      .maybeSingle();
    if (existing) {
      skipped++;
      priorSignatures.add(signature);
      continue;
    }

    const sourceIds = (s.source_message_ids ?? []).filter((id) =>
      orderedMessages.some((m: any) => m.id === id),
    );
    const { error } = await admin.from("suggestions").insert({
      user_id: userId,
      suggestion_type: s.type,
      content: {
        title: s.title,
        description: s.description ?? null,
        priority: s.priority ?? "medium",
        date: s.date ?? null,
        contact_name: (contact as any).name,
        contact_company: (contact as any).company,
      },
      status: "pending",
      source: orderedMessages[0]?.source ?? "whatsapp",
      confidence: clamp01(s.confidence),
      reasoning: s.reasoning,
      contact_id: contactId,
      source_message_ids: sourceIds,
      signature,
    });
    if (error) {
      // unique violation = duplicate pending suggestion → skip silently
      if (!String(error.message).includes("duplicate")) {
        console.error("[detect-task-signals] insert error", error.message);
      }
      skipped++;
    } else {
      created++;
      priorSignatures.add(signature);
    }
  }

  // Update refresh state
  const totalCount = orderedMessages.length;
  await admin.from("contact_refresh_state").upsert(
    {
      user_id: userId,
      contact_id: contactId,
      last_scan_at: new Date().toISOString(),
      last_scan_message_count: totalCount,
      total_messages_seen: totalCount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,contact_id" },
  );

  return { created, skipped };
}

async function loadPriorDecisions(
  admin: any,
  userId: string,
  contactId: string,
): Promise<PriorDecision[]> {
  const { data, error } = await admin
    .from("suggestions")
    .select("status, content, suggestion_type, signature")
    .eq("user_id", userId)
    .eq("contact_id", contactId)
    .in("status", ["accepted", "rejected", "snoozed"])
    .order("created_at", { ascending: false })
    .limit(MAX_HISTORY_PER_CONTACT);
  if (error) {
    console.warn("[detect-task-signals] loadPriorDecisions error", error.message);
    return [];
  }
  return (data ?? []).map((r: any) => ({
    status: r.status,
    title: (r.content?.title as string) || "(sin título)",
    type: r.suggestion_type,
    signature: r.signature ?? null,
  }));
}

async function extractWithLLM(
  contact: { id: string; name: string; company: string | null },
  conversation: string,
  priorDecisions: PriorDecision[],
): Promise<Suggestion[]> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.warn("[detect-task-signals] LOVABLE_API_KEY missing — skipping extraction");
    return [];
  }

  const accepted = priorDecisions.filter((p) => p.status === "accepted");
  const rejected = priorDecisions.filter((p) => p.status === "rejected");
  const snoozed = priorDecisions.filter((p) => p.status === "snoozed");

  const memoryBlock = priorDecisions.length === 0
    ? "(sin historial previo)"
    : [
        accepted.length > 0
          ? `ACEPTADAS (ya están como tarea, NO las repitas):\n${accepted.map((p) => `- ${p.title}`).join("\n")}`
          : "",
        rejected.length > 0
          ? `RECHAZADAS (el usuario las descartó, NO las propongas otra vez):\n${rejected.map((p) => `- ${p.title}`).join("\n")}`
          : "",
        snoozed.length > 0
          ? `POSPUESTAS (ya las verá más tarde, NO insistas):\n${snoozed.map((p) => `- ${p.title}`).join("\n")}`
          : "",
      ].filter(Boolean).join("\n\n");

  const systemPrompt = `Eres JARVIS, un asistente que detecta SEÑALES accionables en conversaciones reales.
Tu tarea: analizar la conversación con ${contact.name}${contact.company ? ` (${contact.company})` : ""} y devolver SOLO sugerencias claras.

REGLAS DURAS:
- NO inventes. Si no hay señal clara, devuelve [].
- NO uses frases sueltas fuera de contexto. Mira la conversación entera.
- Si el usuario YO ya respondió que sí/no o cerró el tema, NO lo sugieras.
- Cada sugerencia debe poder justificarse con 1-3 mensajes concretos.
- Confidence honesto: 0.4-0.6 si es ambiguo, 0.7-0.85 si es claro, 0.9+ solo si es explícito.

MEMORIA — YA DECIDIDO POR EL USUARIO:
${memoryBlock}

REGLA CRÍTICA SOBRE LA MEMORIA:
- Si una sugerencia es semánticamente equivalente a algo en YA DECIDIDO, NO la incluyas.
- Equivalencia = mismo objetivo aunque cambien las palabras (ej: "Crear usuarios Lexintel" ≡ "Crear 3 usuarios para Lexintel").
- Sólo propón algo si es claramente un asunto NUEVO, distinto, o un seguimiento posterior con información nueva.

Tipos válidos:
- task_from_signal: el usuario debería hacer algo concreto
- meeting_from_signal: hay propuesta o necesidad de cita/llamada
- followup_from_signal: hay algo pendiente que requiere recordatorio o seguimiento
- outreach_from_signal: hay razón para contactar proactivamente al contacto (ej: hace mucho que no se habla, asunto sin cerrar)

Devuelve JSON estricto: {"suggestions":[{type,title,description,priority,date,confidence,reasoning,source_message_ids}]}
- date opcional ISO si la conversación lo menciona
- reasoning: 1 frase breve explicando por qué (en español)
- source_message_ids: vacío por ahora (no tienes IDs)
Máximo 5 sugerencias.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Conversación (más reciente al final):\n\n${conversation}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("[detect-task-signals] LLM error", res.status, txt.slice(0, 200));
      return [];
    }
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    return arr.filter((s: any) => s && s.type && s.title && typeof s.confidence === "number");
  } catch (e) {
    console.error("[detect-task-signals] LLM exception", e);
    return [];
  }
}

// Normalización agresiva del título para que variantes léxicas produzcan
// la misma firma. Quita tildes, números, palabras de relleno y colapsa espacios.
const FILLER_WORDS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas",
  "de", "del", "al", "a", "ante", "con", "para", "por", "en", "sobre", "y", "o",
  "que", "se", "le", "lo", "les",
  "crear", "hacer", "realizar", "preparar", "enviar", "mandar", "poner",
  "tema", "asunto", "cosa", "tarea",
]);

function normalizeTitle(title: string): string {
  return (title || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // tildes
    .replace(/[0-9]+/g, " ")         // números
    .replace(/[^\p{L}\s]/gu, " ")    // puntuación
    .split(/\s+/)
    .filter((w) => w.length > 2 && !FILLER_WORDS.has(w))
    .sort()                          // mismo conjunto de palabras → misma firma
    .join(" ")
    .slice(0, 120);
}

function makeSignature(_userId: string, contactId: string, s: Suggestion): string {
  const norm = normalizeTitle(s.title);
  return `${s.type}::${norm}::${contactId}`;
}

function clamp01(n: number): number {
  if (typeof n !== "number" || isNaN(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
