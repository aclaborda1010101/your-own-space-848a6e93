// get-contact-headlines
// Returns 3 cached headlines for a contact. Regenerates via Lovable AI if cache
// is missing or invalidated (>=20 new messages since last generation).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const needsRegen =
      force ||
      !cached ||
      total - (cached.message_count_at_generation || 0) >= INVALIDATION_DELTA;

    if (!needsRegen && cached) {
      return jsonResp({ ok: true, cached: true, payload: cached.payload });
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

    const payload = await generateHeadlines(
      contact?.name || "el contacto",
      contact?.category || "otro",
      messagesText,
      latestMessageDate,
    );

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

function sanitizePayload(payload: any, fallbackMentionDate: Date | null) {
  const safe = payload && typeof payload === "object" ? payload : emptyPayload();
  const safeTitle = typeof safe.pending?.title === "string" ? safe.pending.title.trim() : "Nada pendiente";
  const safeMention = typeof safe.pending?.last_mentioned === "string" ? safe.pending.last_mentioned.trim() : "—";

  return {
    health: {
      score: Number.isFinite(safe.health?.score) ? Math.max(0, Math.min(10, Math.round(safe.health.score))) : 5,
      label: typeof safe.health?.label === "string" ? safe.health.label : "Sin datos",
      relationship_type: typeof safe.health?.relationship_type === "string" ? safe.health.relationship_type : "Por definir",
      trend: typeof safe.health?.trend === "string" ? safe.health.trend : "Sin tendencia detectable",
    },
    pending: {
      title: containsAmbiguousRelativeDate(safeTitle) ? stripAmbiguousRelativeTail(safeTitle) : safeTitle,
      who_owes: typeof safe.pending?.who_owes === "string" ? safe.pending.who_owes : "—",
      last_mentioned:
        containsAmbiguousRelativeDate(safeMention) && fallbackMentionDate
          ? `mencionado el ${formatShortAbsoluteDate(fallbackMentionDate)}`
          : safeMention || (fallbackMentionDate ? `mencionado el ${formatShortAbsoluteDate(fallbackMentionDate)}` : "—"),
    },
    topics: {
      tone_emoji: typeof safe.topics?.tone_emoji === "string" ? safe.topics.tone_emoji : "🤔",
      tone_label: typeof safe.topics?.tone_label === "string" ? safe.topics.tone_label : "Sin tono claro",
      top_topics: Array.isArray(safe.topics?.top_topics) ? safe.topics.top_topics.slice(0, 3) : [],
      tone_evolution: typeof safe.topics?.tone_evolution === "string" ? safe.topics.tone_evolution : "Sin evolución detectable",
    },
  };
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
) {
  const todayLabel = formatAbsoluteDate(new Date());
  const systemPrompt = `Eres un analista experto en relaciones interpersonales. Analiza los mensajes y devuelve EXACTAMENTE el JSON pedido. Responde en español. Sé conciso, observador y útil.

REGLA CRÍTICA DE FECHAS:
- Cada mensaje viene precedido por una fecha absoluta entre corchetes.
- Si dentro de un mensaje aparece una referencia relativa como "mañana", "ayer", "el sábado" o "el domingo", interprétala SIEMPRE respecto a la fecha absoluta de esa línea, no respecto al día actual.
- NO devuelvas en el título ni en last_mentioned expresiones ambiguas como "ayer", "mañana", "el sábado", "el pasado domingo".
- Reescribe siempre con fecha absoluta o con una formulación neutra y atemporal.
- Ejemplos correctos: "entradas para el partido del domingo 20 de abril", "comida con Min", "mencionado el 12 abr 2026".`;

  const userPrompt = `Hoy real del sistema: ${todayLabel}
Contacto: ${contactName} (categoría: ${category})

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
                        description: "Asunto pendiente concreto, sin fechas relativas ambiguas; si hay fecha, usar fecha absoluta o frase neutra.",
                      },
                      who_owes: {
                        type: "string",
                        description: '"tú", "él/ella" o "nadie"',
                      },
                      last_mentioned: {
                        type: "string",
                        description: 'Fecha breve absoluta, ej: "mencionado el 12 abr 2026". Nunca usar "ayer", "mañana" o "el sábado".',
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
