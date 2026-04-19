// detect-task-signals
// Extrae candidatos (tarea, reunión, follow-up, outreach) desde contact_messages
// (WhatsApp, email, notas) en lotes por contacto. Solo dispara cuando hay
// suficientes mensajes nuevos o cuando el cliente lo fuerza. Las sugerencias
// resultantes entran en la cola `suggestions` con status='pending' para que
// el usuario las valide. NO crea tareas/eventos automáticamente.
//
// POST /detect-task-signals
//   { contact_id?: string, force?: boolean, threshold?: number }
//
// Si no se pasa contact_id, escanea TODOS los contactos del usuario que han
// cruzado el umbral de mensajes nuevos desde el último escaneo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_THRESHOLD = 30;
const MAX_MESSAGES_PER_BATCH = 60; // ventana de contexto razonable
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
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) return j({ error: "unauthorized" }, 401);

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
      return j({ scanned: 0, created: 0, message: "no contacts above threshold" });
    }

    let totalCreated = 0;
    const perContact: Array<{ contact_id: string; created: number; skipped: number }> = [];

    for (const contact_id of contactIds) {
      const result = await scanContact(admin, userId, contact_id);
      totalCreated += result.created;
      perContact.push({ contact_id, created: result.created, skipped: result.skipped });
    }

    return j({ scanned: contactIds.length, created: totalCreated, per_contact: perContact });
  } catch (e) {
    console.error("[detect-task-signals]", e);
    return j({ error: String(e) }, 500);
  }
});

async function pickContactsToScan(
  admin: ReturnType<typeof createClient>,
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
  for (const m of msgs ?? []) {
    if (!m.contact_id) continue;
    counts.set(m.contact_id, (counts.get(m.contact_id) ?? 0) + 1);
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
  admin: ReturnType<typeof createClient>,
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

  const orderedMessages = [...messages].reverse();

  const conversation = orderedMessages
    .map((m) =>
      `[${new Date(m.message_date).toISOString().slice(0, 16)}] ${m.direction === "outbound" ? "YO" : (m.sender || contact.name)} (${m.source}): ${(m.content || "").slice(0, 280)}`,
    )
    .join("\n");

  const suggestions = await extractWithLLM(contact, conversation);

  let created = 0;
  let skipped = 0;
  for (const s of suggestions) {
    const signature = makeSignature(userId, contactId, s);
    const sourceIds = (s.source_message_ids ?? []).filter((id) =>
      orderedMessages.some((m) => m.id === id),
    );
    const { error } = await admin.from("suggestions").insert({
      user_id: userId,
      suggestion_type: s.type,
      content: {
        title: s.title,
        description: s.description ?? null,
        priority: s.priority ?? "medium",
        date: s.date ?? null,
        contact_name: contact.name,
        contact_company: contact.company,
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

async function extractWithLLM(
  contact: { id: string; name: string; company: string | null },
  conversation: string,
): Promise<Suggestion[]> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.warn("[detect-task-signals] LOVABLE_API_KEY missing — skipping extraction");
    return [];
  }

  const systemPrompt = `Eres JARVIS, un asistente que detecta SEÑALES accionables en conversaciones reales.
Tu tarea: analizar la conversación con ${contact.name}${contact.company ? ` (${contact.company})` : ""} y devolver SOLO sugerencias claras.

REGLAS DURAS:
- NO inventes. Si no hay señal clara, devuelve [].
- NO uses frases sueltas fuera de contexto. Mira la conversación entera.
- Si el usuario YO ya respondió que sí/no o cerró el tema, NO lo sugieras.
- Cada sugerencia debe poder justificarse con 1-3 mensajes concretos.
- Confidence honesto: 0.4-0.6 si es ambiguo, 0.7-0.85 si es claro, 0.9+ solo si es explícito.

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

function makeSignature(userId: string, contactId: string, s: Suggestion): string {
  const norm = `${s.type}::${(s.title || "").toLowerCase().trim().slice(0, 80)}::${contactId}`;
  return norm;
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
