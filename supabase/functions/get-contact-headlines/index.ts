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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contactId, force = false } = await req.json();
    if (!contactId) return jsonResp({ error: "contactId required" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Resolve user from auth header
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

    // Check cache
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

    // Fetch contact + last 200 messages
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

    const messagesText = (msgs || [])
      .reverse()
      .map((m) => {
        const who = m.direction === "outgoing" ? "tú" : (m.sender || "él/ella");
        return `${who}: ${m.content}`;
      })
      .join("\n")
      .slice(0, 25000);

    const payload = await generateHeadlines(
      contact?.name || "el contacto",
      contact?.category || "otro",
      messagesText,
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
  supabase: ReturnType<typeof createClient>,
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
) {
  const systemPrompt = `Eres un analista experto en relaciones interpersonales. Analiza los mensajes y devuelve EXACTAMENTE el JSON pedido. Responde en español. Sé conciso, observador y útil.`;

  const userPrompt = `Contacto: ${contactName} (categoría: ${category})

Conversación reciente (últimos ~200 mensajes):
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
                        description: "Asunto pendiente concreto",
                      },
                      who_owes: {
                        type: "string",
                        description: '"tú", "él/ella" o "nadie"',
                      },
                      last_mentioned: {
                        type: "string",
                        description: 'Cuándo se mencionó: "hace 3 días"',
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
  return JSON.parse(tc.function.arguments);
}
