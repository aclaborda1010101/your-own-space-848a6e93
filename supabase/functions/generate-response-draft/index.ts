import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chat } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Filter out filler messages that skew length calculations
const isSubstantiveMessage = (msg: string) => msg.length >= 15;

function buildProfileSummary(profile: any, category: string): string {
  if (!profile) return "Sin perfil disponible";
  const parts: string[] = [];
  if (profile.observacion) parts.push(`OBSERVACIÓN: ${profile.observacion}`);
  if (profile.salud_terceros) parts.push(`SALUD DE TERCEROS: ${JSON.stringify(profile.salud_terceros)}`);
  if (profile.red_contactos_mencionados?.length) {
    const people = profile.red_contactos_mencionados
      .map((p: any) => `${p.nombre} (${p.relacion}): ${p.contexto || ''}`)
      .join("; ");
    parts.push(`PERSONAS MENCIONADAS: ${people}`);
  }
  if (profile.alertas?.length) parts.push(`Alertas: ${JSON.stringify(profile.alertas)}`);
  if (profile.bienestar) parts.push(`Bienestar: ${JSON.stringify(profile.bienestar)}`);
  if (profile.coordinacion) parts.push(`Coordinación: ${JSON.stringify(profile.coordinacion)}`);
  if (profile.tipo_personalidad) parts.push(`Personalidad: ${profile.tipo_personalidad}`);
  if (profile.estilo_comunicacion) parts.push(`Comunicación: ${profile.estilo_comunicacion}`);
  return parts.join("\n") || "Sin perfil disponible";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contact_id, user_id, message_id, message_content, proactive_context } = await req.json();

    if (!contact_id || !user_id) {
      return new Response(JSON.stringify({ error: "contact_id and user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isProactive = !!proactive_context;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get contact info
    const { data: contact } = await supabase
      .from("people_contacts")
      .select("name, category, role, company, personality_profile, is_favorite")
      .eq("id", contact_id)
      .single();

    if (!contact) {
      return new Response(JSON.stringify({ error: "Contact not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GATE: Only generate for favorites
    if (!contact.is_favorite) {
      console.log(`Skipping draft generation for non-favorite contact: ${contact.name}`);
      return new Response(JSON.stringify({ ok: true, skipped: "not_favorite" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== DATA GATHERING (parallel) =====
    const [recentRes, contactOutgoingRes, globalOutgoingRes] = await Promise.all([
      // Last 50 messages in conversation (both directions) for better context
      supabase
        .from("contact_messages")
        .select("content, direction, sender, message_date")
        .eq("contact_id", contact_id)
        .order("message_date", { ascending: false })
        .limit(50),
      // Last 40 outgoing to THIS contact
      supabase
        .from("contact_messages")
        .select("content")
        .eq("contact_id", contact_id)
        .eq("direction", "outgoing")
        .order("message_date", { ascending: false })
        .limit(40),
      // Last 100 outgoing GLOBAL (to any contact) for general voice
      supabase
        .from("contact_messages")
        .select("content")
        .eq("user_id", user_id)
        .eq("direction", "outgoing")
        .order("message_date", { ascending: false })
        .limit(100),
    ]);

    const recentMessages = recentRes.data || [];
    const contactOutgoing = (contactOutgoingRes.data || []).map(m => m.content).filter(Boolean);
    const globalOutgoing = (globalOutgoingRes.data || []).map(m => m.content).filter(Boolean);

    // ===== BUILD FEW-SHOT VOICE EXAMPLES =====
    // Filter out filler messages (ok, jajaja, vale, sí, etc.) for examples
    const contactExamples = contactOutgoing.filter(isSubstantiveMessage).slice(0, 15);
    const globalExamples = globalOutgoing
      .filter(msg => isSubstantiveMessage(msg) && !contactExamples.includes(msg))
      .slice(0, 25);
    const allExamples = [...contactExamples, ...globalExamples];

    // Pick best 12 examples (varied lengths, real voice) — min 15 chars
    const fewShotExamples = allExamples
      .filter(msg => msg.length > 15 && msg.length < 500)
      .slice(0, 12);

    // Calculate average message length ONLY from substantive messages
    const substantiveMessages = [...contactOutgoing, ...globalOutgoing].filter(isSubstantiveMessage);
    const avgLength = substantiveMessages.length > 0
      ? Math.round(substantiveMessages.reduce((sum, m) => sum + m.length, 0) / substantiveMessages.length)
      : 120;
    const lengthBucket = avgLength < 60 ? "corta (1-2 líneas)"
      : avgLength < 150 ? "media (2-3 líneas)"
      : avgLength < 300 ? "larga (3-5 líneas)"
      : "muy larga (5+ líneas)";

    // Detect patterns from real messages
    const usesEmojis = allExamples.some(m => /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}]/u.test(m));
    const usesUppercase = allExamples.filter(m => m === m.toUpperCase() && m.length > 3).length > allExamples.length * 0.1;

    console.log(`Voice data: ${contactExamples.length} contact + ${globalExamples.length} global examples, avg length: ${avgLength}chars (substantive only)`);

    // Build conversation history with more context
    const conversationHistory = recentMessages
      .reverse()
      .map(m => `[${m.direction === "incoming" ? m.sender || contact.name : "Yo"}]: ${m.content}`)
      .join("\n");

    // Extract profile info
    const profile = contact.personality_profile as Record<string, any> | null;
    const profileStr = JSON.stringify(profile || {}).toLowerCase();
    const hasStressPattern = /ansiedad|fiebre|agotamiento|enferm|cansancio|estr[eé]s|hospital|dolor/.test(profileStr);
    const hasBusinessMilestone = /arabia|saud[ií]|aicox|contrato|licitaci[oó]n|propuesta|deadline|entrega/.test(profileStr);

    // ===== SINGLE-PASS GENERATION WITH VOICE MIRRORING =====
    const fewShotBlock = fewShotExamples.length > 0
      ? `
EJEMPLOS REALES DE CÓMO ESCRIBE EL USUARIO (imita esto EXACTAMENTE):
${fewShotExamples.map((msg, i) => `  ${i + 1}. "${msg}"`).join("\n")}
`
      : "";

    const stressDirective = hasStressPattern
      ? `\n⚠️ ALERTA: El contacto muestra señales de estrés/salud. Usa el MISMO tono brusco/directo del usuario. NO seas diplomático.`
      : "";

    const businessDirective = hasBusinessMilestone
      ? `\n📊 HITO DE NEGOCIO ACTIVO: Ve DIRECTO al siguiente paso técnico, sin formalismos.`
      : "";

    const familiarDirective = contact.category === 'familiar'
      ? `\n❤️ CONTACTO FAMILIAR: "${contact.name}" es un familiar cercano. El tono DEBE ser cariñoso, cercano y natural. Usa el mismo afecto que se ve en los mensajes de ejemplo. NO seas clínico ni formal. Escribe como le hablarías a tu familia de verdad.`
      : contact.category === 'personal'
        ? `\n👋 CONTACTO PERSONAL: "${contact.name}" es un amigo/conocido cercano. El tono debe ser natural y relajado, como hablarías con un amigo.`
        : '';

    const profileSummary = buildProfileSummary(profile, contact.category || '');

    const systemPrompt = `Eres un clon de escritura. Tu ÚNICO trabajo es generar 3 respuestas de WhatsApp que suenen IDÉNTICAS a como escribe el usuario real. NO eres un asistente amable. Eres una copia exacta de su voz.

🔑 REGLAS ABSOLUTAS:
1. LONGITUD: El usuario escribe mensajes de longitud ${lengthBucket} (media ~${avgLength} caracteres). Tus respuestas DEBEN tener longitud similar. Cada sugerencia debe tener al MENOS 2-3 frases que aporten valor y contexto real sobre la conversación. NUNCA respondas con menos de 20 palabras por sugerencia.
2. EMOJIS: ${usesEmojis ? "El usuario USA emojis. Puedes usarlos." : "El usuario NO usa emojis. NO pongas ningún emoji."}
3. MAYÚSCULAS: ${usesUppercase ? "El usuario a veces escribe en mayúsculas para enfatizar." : "El usuario no abusa de mayúsculas."}
4. VOCABULARIO: Usa EXACTAMENTE las mismas palabras, jerga y muletillas que ves en los ejemplos. No inventes vocabulario que no aparece en sus mensajes.
5. TONO: Si el usuario es brusco, sé brusco. Si es sarcástico, sé sarcástico. Si es directo y cortante, sé directo y cortante. NUNCA suavices su estilo.
6. FORMATO: Sin bullet points, sin listas, sin formalismos. Escribe como en WhatsApp real.
7. IDIOMA: Siempre en español.
8. CONTEXTO DE TERCEROS — LEE EL PERFIL OBLIGATORIAMENTE:
   El PERFIL del contacto contiene información sobre QUIÉN es cada persona mencionada (hermana, madre, hijo, etc.) y QUÉ situación tiene cada uno.
   ANTES de generar, identifica en el perfil:
   - ¿Quién tiene el problema de salud? (puede ser hermana, madre, padre — NO necesariamente el contacto)
   - ¿Quién tiene la medicación? ¿Quién fue al médico?
   Si el perfil dice "hermana Raquel - medicación cardiológica", pregunta "qué tal Raquel con la medicación".
   NUNCA digas "tu madre" o "tu padre" si el perfil indica que es "tu hermana" o viceversa.
   USA EL NOMBRE PROPIO de la persona afectada cuando esté disponible en el perfil.

${fewShotBlock}
${familiarDirective}
CONTACTO: ${contact.name} (${contact.role || "?"} en ${contact.company || "?"})
CATEGORÍA: ${contact.category || "pendiente"}
PERFIL: ${profileSummary}
${stressDirective}
${businessDirective}

HISTORIAL RECIENTE (${recentMessages.length} mensajes):
${conversationHistory}

Genera EXACTAMENTE 3 opciones en JSON:
${isProactive
  ? `- suggestion_1 (Natural): Abre conversación de forma natural con el objetivo indicado. Como si le escribieras de la nada. Mínimo 2-3 frases.
- suggestion_2 (Directa): Ve al grano, pregunta directamente lo que necesitas saber. Mínimo 2-3 frases con contexto.
- suggestion_3 (Casual): Empieza con algo ligero antes de ir al tema. Mínimo 2-3 frases.`
  : `- suggestion_1 (Estratégica): Mueve el pipeline/negocio hacia adelante. Directa pero con sustancia y contexto de la conversación. Mínimo 2-3 frases.
- suggestion_2 (Relacional): Conecta emocionalmente pero con el tono REAL del usuario, no con diplomacia artificial. Responde al contenido real del mensaje. Mínimo 2-3 frases.
- suggestion_3 (Concisa): Respuesta más breve pero con contenido relevante. Mínimo 1-2 frases con sentido.`}

IMPORTANTE: Cada sugerencia debe REFERIRSE DIRECTAMENTE al contenido del último mensaje o la conversación reciente. NO generes respuestas genéricas.

Responde SOLO con JSON válido: { "suggestion_1": "...", "suggestion_2": "...", "suggestion_3": "..." }`;

    const userPrompt = isProactive
      ? `Quiero INICIAR una conversación con ${contact.name} (${contact.category || 'contacto'}).
NO estoy respondiendo a ningún mensaje.

Lo que quiero conseguir: ${proactive_context}

Genera 3 opciones para ABRIR la conversación.
Que suenen naturales, como si realmente le estuvieras escribiendo a esta persona.
NO copies literalmente el objetivo — transfórmalo en un mensaje de WhatsApp real.
${contact.category === 'familiar' ? 'Recuerda: es un familiar, el tono debe ser cariñoso y cercano.' : ''}`
      : `Mensaje recibido de ${contact.name}: "${message_content}"

Contexto de la conversación completa (últimos ${recentMessages.length} mensajes arriba).

Genera las 3 opciones. Recuerda:
- Debes sonar EXACTAMENTE como los ejemplos de arriba, no como un asistente.
- Cada respuesta debe REFERIRSE al contenido del mensaje y la conversación.
- Mínimo 20 palabras por sugerencia.`;

    console.log(`Generating drafts for ${contact.name} with ${fewShotExamples.length} few-shot examples, ${recentMessages.length} context messages`);

    const result = await chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { model: "gemini-pro", temperature: 0.45, responseFormat: "json" }
    );

    let suggestions: { suggestion_1: string; suggestion_2: string; suggestion_3: string };
    try {
      suggestions = JSON.parse(result);
    } catch {
      console.error("Failed to parse AI response:", result);
      return new Response(JSON.stringify({ error: "Invalid AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Detect style label from examples
    const detectedStyle = avgLength < 60 ? "cortante"
      : usesEmojis ? "coloquial"
      : "directo";

    const contextSummary = isProactive
      ? `Proactivo: ${proactive_context.substring(0, 150)}. Perfil: ${contact.category}. ${profile?.tipo_personalidad || ""}`
      : `Último mensaje de ${contact.name}: "${(message_content || "").substring(0, 100)}". Perfil: ${contact.category}. ${profile?.tipo_personalidad || ""}`;

    const { data: inserted, error: insertErr } = await supabase
      .from("suggested_responses")
      .insert({
        user_id,
        contact_id,
        original_message_id: message_id || null,
        suggestion_1: suggestions.suggestion_1,
        suggestion_2: suggestions.suggestion_2,
        suggestion_3: suggestions.suggestion_3,
        context_summary: contextSummary,
        detected_style: detectedStyle,
        status: "pending",
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Error inserting suggested response:", insertErr);
      return new Response(JSON.stringify({ error: "insert_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Drafts generated (style: ${detectedStyle}, examples: ${fewShotExamples.length}): ${inserted.id}`);

    return new Response(JSON.stringify({ ok: true, data: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-response-draft error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
