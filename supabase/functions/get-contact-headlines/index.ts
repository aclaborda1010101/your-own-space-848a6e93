// get-contact-headlines
// Returns 3 cached headlines for a contact. Regenerates via Lovable AI if cache
// is missing or invalidated (>=20 new messages since last generation).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateSignature, normalizeHeadlineTitle } from "../_shared/headline-signature.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const INVALIDATION_DELTA = 20;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const MADRID_TZ = "Europe/Madrid";
const AMBIGUOUS_RELATIVE_RE = /\b(hoy|ayer|mañana|anoche|esta mañana|esta tarde|esta noche|este finde|este fin de semana|la semana pasada|este sábado|este domingo|este lunes|este martes|este miércoles|este jueves|este viernes|el sábado pasado|el domingo pasado|el lunes pasado|el martes pasado|el miércoles pasado|el jueves pasado|el viernes pasado|el sábado|el domingo|el lunes|el martes|el miércoles|el jueves|el viernes)\b/i;
// Palabras que delatan un evento puntual fechable (si pasa → caduca)
const EVENT_KEYWORDS_RE = /\b(partido|partidazo|final|semifinal|cuartos|concierto|festival|reuni[oó]n|meeting|cita|cena|comida|almuerzo|brunch|desayuno|copas?|caf[eé]|vuelo|tren|viaje|escapada|reserva|entradas?|tickets?|boda|cumple(?:años)?|aniversario|evento|charla|webinar|presentaci[oó]n|entrevista|llamada programada|videollamada|visita|quedada|finde|fin de semana|partida|torneo|carrera|maratón)\b/i;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contactId, force = false } = await req.json();
    if (!contactId) return jsonResp({ error: "contactId required" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const auth = req.headers.get("Authorization") || "";
    let userId: string | undefined;
    if (auth.startsWith("Bearer ")) {
      const { data } = await supabase.auth.getUser(auth.slice(7));
      userId = data.user?.id;
    }
    if (!userId) {
      const { data: c } = await supabase
        .from("people_contacts")
        .select("user_id")
        .eq("id", contactId)
        .maybeSingle();
      userId = c?.user_id;
    }
    if (!userId) return jsonResp({ error: "no user" }, 400);

    const { count: totalMessages } = await supabase
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("contact_id", contactId)
      .eq("user_id", userId);
    const total = totalMessages || 0;

    const { data: cached } = await supabase
      .from("contact_headlines")
      .select("*")
      .eq("contact_id", contactId)
      .eq("user_id", userId)
      .maybeSingle();

    const cachedExpired = isCachedPayloadExpired(cached?.payload);
    // Si la cache está obsoleta (stale/expired) regenerar SIEMPRE, aunque no haya
    // delta de mensajes nuevos. Era el motivo por el que contactos sin actividad
    // reciente quedaban eternamente con "Sin asunto vivo".
    const needsRegen =
      force ||
      !cached ||
      cachedExpired ||
      total - (cached.message_count_at_generation || 0) >= INVALIDATION_DELTA;

    if (!needsRegen && cached) {
      return jsonResp({
        ok: true,
        cached: true,
        payload: sanitizePayload(cached.payload, parseDate(cached.generated_at)),
      });
    }

    if (total === 0) {
      const empty = emptyPayload();
      await upsertHeadlines(supabase, contactId, userId, empty, 0);
      return jsonResp({ ok: true, cached: false, payload: empty });
    }

    const { data: contact } = await supabase
      .from("people_contacts")
      .select("name, category, last_contact")
      .eq("id", contactId)
      .maybeSingle();

    const { data: msgs } = await supabase
      .from("contact_messages")
      .select("direction, sender, content, message_date")
      .eq("contact_id", contactId)
      .eq("user_id", userId)
      .order("message_date", { ascending: false })
      .limit(200);

    const orderedMsgs = [...(msgs || [])].reverse();
    const messagesText = orderedMsgs
      .map((m) => formatMessageForModel(m))
      .join("\n")
      .slice(0, 25000);

    const latestMessageDate = [...(msgs || [])]
      .map((m) => parseDate(m.message_date))
      .find((d): d is Date => !!d) || null;

    // Cargar últimas decisiones del usuario sobre asuntos previos para este contacto
    const { data: dismissalsData } = await supabase
      .from("contact_headline_dismissals")
      .select("signature, original_title, decision, decided_at")
      .eq("user_id", userId)
      .eq("contact_id", contactId)
      .order("decided_at", { ascending: false })
      .limit(15);
    const dismissals = (dismissalsData || []) as Array<{
      signature: string;
      original_title: string;
      decision: string;
    }>;
    const dismissedSignatures = new Set(dismissals.map((d) => d.signature));

    let payload = await generateHeadlines(
      contact?.name || "el contacto",
      contact?.category || "otro",
      messagesText,
      latestMessageDate,
      dismissals,
    );

    // Si el LLM repite un asunto ya descartado/hecho, forzar fallback
    const candidateTitle = payload?.pending?.title || "";
    if (candidateTitle && candidateTitle !== "Sin asunto vivo") {
      const candidateSig = await generateSignature(candidateTitle);
      if (dismissedSignatures.has(candidateSig)) {
        console.log(`[headlines] LLM repitió asunto descartado: "${candidateTitle}" — forzando fallback`);
        payload = {
          ...payload,
          pending: {
            ...payload.pending,
            title: "Sin asunto vivo",
            who_owes: "nadie",
            is_event: false,
            event_date: null,
            expires_at: null,
            freshness_status: "stale",
          },
        };
      }
    }

    await upsertHeadlines(supabase, contactId, userId, payload, total);
    return jsonResp({ ok: true, cached: false, payload });
  } catch (err) {
    console.error("get-contact-headlines error:", err);
    return jsonResp({ error: String(err) }, 500);
  }
});

function jsonResp(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const value = dateStr.trim();
  if (!value) return null;

  const dmy = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    let [, d, m, y] = dmy;
    let yearNum = parseInt(y, 10);
    if (yearNum < 100) yearNum += 2000;
    const dayNum = parseInt(d, 10);
    const monthNum = parseInt(m, 10);
    if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null;
    const result = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));
    if (result.getUTCDate() !== dayNum || result.getUTCMonth() !== monthNum - 1) return null;
    return result;
  }

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const result = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
    if (result.getUTCDate() !== +iso[3] || result.getUTCMonth() !== +iso[2] - 1) return null;
    return result;
  }

  const isoDateTime = value.match(/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+\-]\d{2}:?\d{2})?$/);
  if (isoDateTime) {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : new Date(ms);
  }

  return null;
}

function formatAbsoluteDate(date: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: MADRID_TZ,
  }).format(date);
}

function formatShortAbsoluteDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: MADRID_TZ,
  }).formatToParts(date);
  const day = parts.find((p) => p.type == "day")?.value ?? "";
  const month = parts.find((p) => p.type == "month")?.value ?? "";
  const year = parts.find((p) => p.type == "year")?.value ?? "";
  return `${day} ${month} ${year}`.trim();
}

function formatMessageForModel(message: {
  direction: string | null;
  sender: string | null;
  content: string | null;
  message_date: string | null;
}): string {
  const who = message.direction === "outgoing" ? "tú" : (message.sender || "él/ella");
  const date = parseDate(message.message_date);
  const prefix = date ? `[${formatAbsoluteDate(date)}] ` : "[fecha desconocida] ";
  return `${prefix}${who}: ${message.content || ""}`;
}

function containsAmbiguousRelativeDate(text: string | null | undefined): boolean {
  if (!text) return false;
  return AMBIGUOUS_RELATIVE_RE.test(text);
}

function stripAmbiguousRelativeTail(text: string): string {
  const cleaned = text
    .replace(/\s+(que fue|que era|de|del|para)?\s*(hoy|ayer|mañana|anoche|esta mañana|esta tarde|esta noche|este finde|este fin de semana|la semana pasada|este sábado|este domingo|este lunes|este martes|este miércoles|este jueves|este viernes|el sábado pasado|el domingo pasado|el lunes pasado|el martes pasado|el miércoles pasado|el jueves pasado|el viernes pasado|el sábado|el domingo|el lunes|el martes|el miércoles|el jueves|el viernes)\b.*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned || text.trim();
}

function extractMentionDate(text: string | null | undefined, fallbackDate: Date | null): Date | null {
  if (!text) return fallbackDate;
  const absolute = parseDate(text);
  if (absolute) return absolute;

  const shortMonth = text.toLowerCase().match(/(?:mencionado el\s+)?(\d{1,2})\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic)\s+(\d{4})\b/i);
  if (shortMonth) {
    const monthMap: Record<string, number> = {
      ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
      jul: 6, ago: 7, sep: 8, sept: 8, oct: 9, nov: 10, dic: 11,
    };
    const day = parseInt(shortMonth[1], 10);
    const month = monthMap[shortMonth[2]];
    const year = parseInt(shortMonth[3], 10);
    const parsed = new Date(Date.UTC(year, month, day));
    if (parsed.getUTCDate() === day && parsed.getUTCMonth() === month) return parsed;
  }

  const now = new Date();
  const daysAgo = text.match(/hace\s+(\d+)\s*d[ií]as?/i);
  if (daysAgo) return new Date(now.getTime() - parseInt(daysAgo[1], 10) * 24 * 3600 * 1000);

  const hoursAgo = text.match(/hace\s+(\d+)\s*horas?/i);
  if (hoursAgo) return new Date(now.getTime() - parseInt(hoursAgo[1], 10) * 3600 * 1000);

  if (/\banteayer\b/i.test(text)) return new Date(now.getTime() - 2 * 24 * 3600 * 1000);
  if (/\bayer\b/i.test(text)) return new Date(now.getTime() - 24 * 3600 * 1000);

  return fallbackDate;
}

function sanitizePayload(payload: any, fallbackMentionDate: Date | null) {
  const safe = payload && typeof payload === "object" ? payload : emptyPayload();
  const rawTitle = typeof safe.pending?.title === "string" ? safe.pending.title.trim() : "Nada pendiente";
  const safeMention = typeof safe.pending?.last_mentioned === "string" ? safe.pending.last_mentioned.trim() : "—";
  const mentionDate = extractMentionDate(safeMention, fallbackMentionDate);

  // Detect explicit event_date from model, else infer from title text
  const modelEventDate = parseDate(safe.pending?.event_date);
  const inferredEventDate = modelEventDate ?? extractDateFromText(rawTitle);
  const looksLikeEvent =
    Boolean(safe.pending?.is_event) ||
    EVENT_KEYWORDS_RE.test(rawTitle) ||
    !!inferredEventDate;

  const now = new Date();
  let freshness: "active" | "expiring" | "expired" | "stale" = "active";
  let expiresAtIso: string | null = null;

  if (inferredEventDate) {
    // Event lasts the day; expires at end of that local day
    const endOfDay = new Date(inferredEventDate);
    endOfDay.setUTCHours(23, 59, 59, 999);
    expiresAtIso = endOfDay.toISOString();
    if (endOfDay.getTime() < now.getTime()) freshness = "expired";
    else if (endOfDay.getTime() - now.getTime() < 24 * 3600 * 1000) freshness = "expiring";
  } else if (looksLikeEvent) {
    // Event-shaped title without exact date: decay aggressively if no fresh evidence
    if (mentionDate) {
      const ageHours = (now.getTime() - mentionDate.getTime()) / (3600 * 1000);
      expiresAtIso = new Date(mentionDate.getTime() + 72 * 3600 * 1000).toISOString();
      if (ageHours > 72) freshness = "stale";
      else if (ageHours > 48) freshness = "expiring";
    } else {
      expiresAtIso = new Date(now.getTime() + 48 * 3600 * 1000).toISOString();
      freshness = "expiring";
    }
  } else if (mentionDate) {
    // Conversational decay: stale after 14 days without new evidence
    const ageDays = (now.getTime() - mentionDate.getTime()) / (24 * 3600 * 1000);
    if (ageDays > 14) freshness = "stale";
  }

  // Rewrite title if expired: turn into past-tense memory and demote
  let finalTitle = containsAmbiguousRelativeDate(rawTitle) ? stripAmbiguousRelativeTail(rawTitle) : rawTitle;
  if (freshness === "expired") {
    const dateLabel = inferredEventDate ? formatShortAbsoluteDate(inferredEventDate) : "ya pasó";
    finalTitle = `Sin asunto vivo · evento del ${dateLabel} ya cerrado`;
  }

  return {
    health: {
      score: Number.isFinite(safe.health?.score) ? Math.max(0, Math.min(10, Math.round(safe.health.score))) : 5,
      label: typeof safe.health?.label === "string" ? safe.health.label : "Sin datos",
      relationship_type: typeof safe.health?.relationship_type === "string" ? safe.health.relationship_type : "Por definir",
      trend: typeof safe.health?.trend === "string" ? safe.health.trend : "Sin tendencia detectable",
    },
    pending: {
      title: finalTitle,
      who_owes: typeof safe.pending?.who_owes === "string" ? safe.pending.who_owes : "—",
      last_mentioned:
        containsAmbiguousRelativeDate(safeMention) && fallbackMentionDate
          ? `mencionado el ${formatShortAbsoluteDate(fallbackMentionDate)}`
          : safeMention || (fallbackMentionDate ? `mencionado el ${formatShortAbsoluteDate(fallbackMentionDate)}` : "—"),
      is_event: looksLikeEvent,
      event_date: inferredEventDate ? inferredEventDate.toISOString() : null,
      expires_at: expiresAtIso,
      freshness_status: freshness,
    },
    topics: {
      tone_emoji: typeof safe.topics?.tone_emoji === "string" ? safe.topics.tone_emoji : "🤔",
      tone_label: typeof safe.topics?.tone_label === "string" ? safe.topics.tone_label : "Sin tono claro",
      top_topics: Array.isArray(safe.topics?.top_topics) ? safe.topics.top_topics.slice(0, 3) : [],
      tone_evolution: typeof safe.topics?.tone_evolution === "string" ? safe.topics.tone_evolution : "Sin evolución detectable",
    },
  };
}

function isCachedPayloadExpired(payload: any): boolean {
  if (!payload || typeof payload !== "object") return true;
  const pending = payload?.pending;
  if (!pending || typeof pending !== "object") return true;
  if (!pending.freshness_status) return true;
  const title = typeof pending.title === "string" ? pending.title : "";
  const lastMentioned = typeof pending.last_mentioned === "string" ? pending.last_mentioned : "";
  if (containsAmbiguousRelativeDate(title) || containsAmbiguousRelativeDate(lastMentioned)) return true;
  if (EVENT_KEYWORDS_RE.test(title) && !pending.expires_at && !pending.event_date) return true;
  if (pending.freshness_status === "expired" || pending.freshness_status === "stale") return true;
  const exp = payload?.pending?.expires_at;
  if (!exp || typeof exp !== "string") return false;
  const ms = Date.parse(exp);
  if (Number.isNaN(ms)) return false;
  return ms < Date.now();
}

// Heuristic date extractor for Spanish: "20 de abril", "domingo 20 de abril", "20/04", "20-04-2026"
const MONTHS_ES: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};
function extractDateFromText(text: string): Date | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // dd de <mes> [de yyyy]
  const m1 = lower.match(/\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{4}))?\b/);
  if (m1) {
    const day = parseInt(m1[1], 10);
    const month = MONTHS_ES[m1[2]];
    const year = m1[3] ? parseInt(m1[3], 10) : new Date().getUTCFullYear();
    const d = new Date(Date.UTC(year, month, day));
    if (d.getUTCDate() === day) return d;
  }
  // dd/mm[/yyyy] or dd-mm[-yyyy]
  const m2 = lower.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (m2) {
    const day = parseInt(m2[1], 10);
    const month = parseInt(m2[2], 10) - 1;
    let year = m2[3] ? parseInt(m2[3], 10) : new Date().getUTCFullYear();
    if (year < 100) year += 2000;
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month, day));
      if (d.getUTCDate() === day && d.getUTCMonth() === month) return d;
    }
  }
  return null;
}

function emptyPayload() {
  return {
    health: {
      score: 5,
      label: "Sin datos",
      relationship_type: "Por definir",
      trend: "Sin tendencia detectable",
    },
    pending: {
      title: "Nada pendiente",
      who_owes: "—",
      last_mentioned: "—",
      is_event: false,
      event_date: null,
      expires_at: null,
      freshness_status: "active",
    },
    topics: {
      tone_emoji: "🤔",
      tone_label: "Sin tono claro",
      top_topics: [],
      tone_evolution: "Sin evolución detectable",
    },
  };
}

async function upsertHeadlines(
  supabase: any,
  contactId: string,
  userId: string,
  payload: unknown,
  msgCount: number,
) {
  await supabase.from("contact_headlines").upsert(
    {
      contact_id: contactId,
      user_id: userId,
      payload,
      message_count_at_generation: msgCount,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "contact_id,user_id" },
  );
}

async function generateHeadlines(
  contactName: string,
  category: string,
  messagesText: string,
  latestMessageDate: Date | null,
  dismissals: Array<{ original_title: string; decision: string }> = [],
) {
  const todayLabel = formatAbsoluteDate(new Date());
  const systemPrompt = `Eres un analista experto en relaciones interpersonales. Analiza los mensajes y devuelve EXACTAMENTE el JSON pedido. Responde en español. Sé conciso, observador y útil.

REGLA CRÍTICA DE FECHAS:
- Cada mensaje viene precedido por una fecha absoluta entre corchetes.
- Si dentro de un mensaje aparece una referencia relativa como "mañana", "ayer", "el sábado" o "el domingo", interprétala SIEMPRE respecto a la fecha absoluta de esa línea, no respecto al día actual.
- NO devuelvas en el título ni en last_mentioned expresiones ambiguas como "ayer", "mañana", "el sábado", "el pasado domingo".
- Reescribe siempre con fecha absoluta o con una formulación neutra y atemporal.
- Ejemplos correctos: "entradas para el partido del domingo 20 de abril", "comida con Min", "mencionado el 12 abr 2026".

REGLA CRÍTICA DE EVENTOS PASADOS:
- Si el asunto pendiente se refiere a un evento puntual (partido, concierto, vuelo, cita, reserva, cena, reunión, viaje, entrega) cuya fecha YA ES ANTERIOR a "Hoy real del sistema", ese evento ESTÁ CERRADO. NUNCA lo devuelvas como acción a hacer ni como CTA.
- En ese caso devuelve title = "Sin asunto vivo" (o un asunto NUEVO posterior si existe), who_owes = "nadie", is_event = false.
- Solo marca is_event = true cuando el evento esté en el futuro o sin fecha cerrada. Si pones is_event = true rellena event_date en formato ISO (YYYY-MM-DD) con la fecha real del evento.

REGLA CRÍTICA DE MEMORIA — NO REPETIR ASUNTOS YA DECIDIDOS:
- Más abajo recibes un bloque "YA RESUELTO / DESCARTADO POR EL USUARIO".
- Cualquier asunto en ese bloque YA NO ES PENDIENTE. Aunque la conversación lo siga mencionando, NO lo devuelvas como title del pending.
- Esto incluye SUS VARIANTES: si "Añadir música a vídeo de casting" está marcado como hecho, tampoco propongas "Poner música al casting", "Música del vídeo", "Añadir audio al casting" ni similares. Equivalencia = mismo objetivo aunque cambien las palabras.
- Si el ÚNICO asunto detectable está en esa lista, devuelve title = "Sin asunto vivo", who_owes = "nadie".`;

  const dismissalsBlock = dismissals.length > 0
    ? `\n\nYA RESUELTO / DESCARTADO POR EL USUARIO — NO PROPONGAS ESTO NI SUS VARIANTES:\n${
        dismissals
          .map((d) => `- "${d.original_title}" (${d.decision === "done" ? "ya hecho" : d.decision === "dismissed" ? "no aplica" : "pospuesto"})`)
          .join("\n")
      }`
    : "";

  const userPrompt = `Hoy real del sistema: ${todayLabel}
Contacto: ${contactName} (categoría: ${category})${dismissalsBlock}

Conversación reciente (últimos ~200 mensajes), cada línea con fecha absoluta:
${messagesText || "(sin mensajes)"}

Devuelve análisis con esta forma exacta llamando a la función emit_headlines.`;

  const resp = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "emit_headlines",
              description: "Devuelve los 3 titulares analíticos del contacto",
              parameters: {
                type: "object",
                properties: {
                  health: {
                    type: "object",
                    properties: {
                      score: {
                        type: "integer",
                        minimum: 0,
                        maximum: 10,
                        description: "Salud del vínculo 0-10",
                      },
                      label: {
                        type: "string",
                        description:
                          "Etiqueta corta: Crítica, Atención, Sana, Fuerte",
                      },
                      relationship_type: {
                        type: "string",
                        description:
                          'Tipo concreto, ej: "Amistad cercana", "Cliente clave", "Familia", "Mentor"',
                      },
                      trend: {
                        type: "string",
                        description:
                          'Tendencia 30d en una frase, ej: "Estable", "Enfriándose"',
                      },
                    },
                    required: ["score", "label", "relationship_type", "trend"],
                    additionalProperties: false,
                  },
                  pending: {
                    type: "object",
                    properties: {
                      title: {
                        type: "string",
                        description: "Asunto pendiente VIVO (futuro o sin cerrar). Si el único asunto es un evento ya pasado, devuelve 'Sin asunto vivo'. Sin fechas relativas ambiguas; si hay fecha, fecha absoluta.",
                      },
                      who_owes: {
                        type: "string",
                        description: '"tú", "él/ella" o "nadie". Si no hay asunto vivo, "nadie".',
                      },
                      last_mentioned: {
                        type: "string",
                        description: 'Fecha breve absoluta, ej: "mencionado el 12 abr 2026". Nunca usar "ayer", "mañana" o "el sábado".',
                      },
                      is_event: {
                        type: "boolean",
                        description: "true SOLO si el asunto es un evento puntual con fecha futura o sin fecha cerrada. false si el evento ya pasó o no es un evento.",
                      },
                      event_date: {
                        type: "string",
                        description: "Si is_event=true y conoces la fecha, formato ISO YYYY-MM-DD. Si no aplica, cadena vacía.",
                      },
                    },
                    required: ["title", "who_owes", "last_mentioned"],
                    additionalProperties: false,
                  },
                  topics: {
                    type: "object",
                    properties: {
                      tone_emoji: { type: "string" },
                      tone_label: {
                        type: "string",
                        description: 'Tono dominante, ej: "Cálido", "Tenso"',
                      },
                      top_topics: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            name: { type: "string" },
                            percentage: {
                              type: "integer",
                              minimum: 0,
                              maximum: 100,
                            },
                          },
                          required: ["name", "percentage"],
                          additionalProperties: false,
                        },
                        maxItems: 3,
                      },
                      tone_evolution: {
                        type: "string",
                        description:
                          "Evolución del tono en una frase corta",
                      },
                    },
                    required: [
                      "tone_emoji",
                      "tone_label",
                      "top_topics",
                      "tone_evolution",
                    ],
                    additionalProperties: false,
                  },
                },
                required: ["health", "pending", "topics"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: "emit_headlines" },
        },
      }),
    },
  );

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI gateway error ${resp.status}: ${t.slice(0, 200)}`);
  }
  const data = await resp.json();
  const tc = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc?.function?.arguments) {
    throw new Error("AI returned no tool call");
  }
  return sanitizePayload(JSON.parse(tc.function.arguments), latestMessageDate);
}
