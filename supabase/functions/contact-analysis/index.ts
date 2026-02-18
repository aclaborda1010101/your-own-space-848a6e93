import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Not authenticated");

    const { contact_id } = await req.json();
    if (!contact_id) throw new Error("contact_id required");

    // 1. Fetch contact info
    const { data: contact, error: contactErr } = await supabase
      .from("people_contacts")
      .select("*")
      .eq("id", contact_id)
      .eq("user_id", user.id)
      .single();

    if (contactErr || !contact) throw new Error("Contact not found");

    // 2. Fetch messages from contact_messages (last 500)
    const { data: messages } = await supabase
      .from("contact_messages")
      .select("sender, content, direction, message_date, chat_name")
      .eq("contact_id", contact_id)
      .eq("user_id", user.id)
      .order("message_date", { ascending: false })
      .limit(500);

    // 3. Fetch transcriptions where this contact appears
    const { data: transcriptions } = await supabase
      .from("conversation_embeddings")
      .select("summary, content, date, brain, people")
      .eq("user_id", user.id)
      .limit(200);

    // Filter transcriptions that mention this contact
    const contactName = contact.name.toLowerCase();
    const contactFirstName = contactName.split(" ")[0];
    const relevantTranscriptions = (transcriptions || []).filter((t: any) => {
      const people = t.people || [];
      return people.some((p: string) => p.toLowerCase().includes(contactFirstName)) ||
        (t.content || "").toLowerCase().includes(contactFirstName) ||
        (t.summary || "").toLowerCase().includes(contactFirstName);
    });

    // 4. Fetch emails if available
    const { data: emails } = await supabase
      .from("jarvis_emails_cache")
      .select("subject, body_preview, from_address, received_at")
      .or(`from_address.ilike.%${contactFirstName}%,subject.ilike.%${contactFirstName}%`)
      .eq("user_id", user.id)
      .order("received_at", { ascending: false })
      .limit(50);

    // 5. Build context for AI
    const messagesSummary = (messages || []).slice(0, 300).map((m: any) =>
      `[${m.direction === 'outgoing' ? 'Yo' : m.sender}] ${m.content}`
    ).join("\n");

    const transcriptionsSummary = relevantTranscriptions.slice(0, 10).map((t: any) =>
      `[${t.date}] ${t.summary || t.content?.substring(0, 500)}`
    ).join("\n\n");

    const emailsSummary = (emails || []).slice(0, 20).map((e: any) =>
      `De: ${e.from_address} | Asunto: ${e.subject} | ${e.body_preview?.substring(0, 200) || ''}`
    ).join("\n");

    const prompt = `Eres un analista experto en relaciones interpersonales, psicología social y estrategia de networking.

Analiza toda la información disponible sobre esta persona y genera un perfil completo.

## DATOS DEL CONTACTO
- Nombre: ${contact.name}
- Rol: ${contact.role || 'No especificado'}
- Empresa: ${contact.company || 'No especificada'}
- Cerebro/Ámbito: ${contact.brain || 'No clasificado'}
- Contexto existente: ${contact.context || 'Sin contexto'}
- Mensajes WhatsApp: ${contact.wa_message_count || 0}
- Metadata: ${JSON.stringify(contact.metadata || {})}

## MENSAJES DE WHATSAPP (últimos)
${messagesSummary || '(Sin mensajes disponibles)'}

## TRANSCRIPCIONES DE CONVERSACIONES (PLAUD)
${transcriptionsSummary || '(Sin transcripciones)'}

## EMAILS
${emailsSummary || '(Sin emails)'}

## INSTRUCCIONES
Genera un análisis en formato JSON con la siguiente estructura exacta:

{
  "sinopsis": "Párrafo narrativo de 3-5 frases describiendo quién es esta persona y el contexto de la relación",
  "temas_frecuentes": ["tema1", "tema2", "tema3", "tema4", "tema5"],
  "perfil_psicologico": {
    "rasgos": ["rasgo1", "rasgo2", "rasgo3"],
    "estilo_comunicacion": "formal|informal|mixto",
    "patron_comunicacion": "directo|indirecto|diplomatico",
    "registro_emocional": "racional|emocional|equilibrado",
    "descripcion": "Párrafo describiendo su personalidad y cómo se comunica"
  },
  "analisis_estrategico": {
    "como_nos_percibe": "Descripción de cómo esta persona nos ve",
    "nivel_confianza": 7,
    "oportunidades": ["oportunidad1", "oportunidad2"],
    "nivel_atencion": "alto|medio|bajo",
    "valor_relacional": "Descripción del valor que aporta esta relación"
  },
  "temas_sensibles": ["tema sensible 1", "tema sensible 2"],
  "recomendaciones": {
    "consejos": ["consejo1", "consejo2", "consejo3"],
    "frecuencia_contacto": "semanal|quincenal|mensual|trimestral",
    "mejor_canal": "whatsapp|email|presencial|llamada",
    "proxima_accion": "Sugerencia concreta de próxima acción"
  }
}

IMPORTANTE:
- Si no hay suficiente información para un campo, pon valores razonables basados en lo disponible.
- Sé honesto pero constructivo en el análisis.
- El nivel_confianza es de 1 a 10.
- Responde SOLO con el JSON, sin markdown ni explicaciones.`;

    // 6. Call Claude API
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        temperature: 0.7,
        system: "Eres un analista experto en relaciones interpersonales y psicología. Responde siempre en JSON válido.",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Claude error:", aiResponse.status, errText);
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const textContent = aiData.content?.find((b: any) => b.type === "text");
    let profileText = textContent?.text || "";

    // Clean markdown if present
    if (profileText.startsWith("```json")) profileText = profileText.slice(7);
    if (profileText.startsWith("```")) profileText = profileText.slice(3);
    if (profileText.endsWith("```")) profileText = profileText.slice(0, -3);

    const profile = JSON.parse(profileText.trim());

    // 7. Save to people_contacts
    const { error: updateErr } = await supabase
      .from("people_contacts")
      .update({ personality_profile: profile })
      .eq("id", contact_id)
      .eq("user_id", user.id);

    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ success: true, profile }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("contact-analysis error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
