import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chat } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contact_id, user_id, message_id, message_content } = await req.json();

    if (!contact_id || !user_id) {
      return new Response(JSON.stringify({ error: "contact_id and user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get contact info + personality profile + favorite check
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

    // Gather context: last 10 messages (both directions)
    const { data: recentMessages } = await supabase
      .from("contact_messages")
      .select("content, direction, sender, message_date")
      .eq("contact_id", contact_id)
      .order("message_date", { ascending: false })
      .limit(10);

    // Voice Sampling: last 40 OUTGOING messages to this contact
    const { data: outgoingMessages } = await supabase
      .from("contact_messages")
      .select("content")
      .eq("contact_id", contact_id)
      .eq("direction", "outgoing")
      .order("message_date", { ascending: false })
      .limit(40);

    const voiceSample = (outgoingMessages || [])
      .map((m) => m.content)
      .filter(Boolean)
      .join("\n");

    // Build conversation history string
    const conversationHistory = (recentMessages || [])
      .reverse()
      .map((m) => `[${m.direction === "incoming" ? m.sender || "Contacto" : "Yo"}]: ${m.content}`)
      .join("\n");

    // Extract relevant profile info
    const profile = contact.personality_profile as Record<string, any> | null;
    const profileSummary = profile
      ? JSON.stringify({
          tipo_personalidad: profile.tipo_personalidad,
          estilo_comunicacion: profile.estilo_comunicacion,
          intereses: profile.intereses_detectados,
          alertas: profile.alertas,
          proxima_accion: profile.proxima_accion,
        })
      : "Sin perfil psicológico disponible";

    // Detect stress patterns in profile
    const profileStr = JSON.stringify(profile || {}).toLowerCase();
    const hasStressPattern = /ansiedad|fiebre|agotamiento|enferm|cansancio|estr[eé]s|hospital|dolor/.test(profileStr);
    const hasBusinessMilestone = /arabia|saud[ií]|aicox|contrato|licitaci[oó]n|propuesta|deadline|entrega/.test(profileStr);

    // ===== PHASE 1: Style Analysis =====
    let styleAnalysis = {
      estilo: "directo",
      patrones: "Sin datos suficientes",
      vocabulario_clave: [] as string[],
      longitud_media: "media",
      usa_emojis: false,
      nivel_formalidad: 5,
    };

    if (voiceSample.length > 50) {
      console.log(`Phase 1: Analyzing voice style from ${outgoingMessages?.length || 0} outgoing messages`);

      const stylePrompt = `Analiza el estilo de escritura de estos mensajes de WhatsApp enviados por un consultor. Identifica patrones reales, no inventes.

MENSAJES DEL USUARIO:
${voiceSample.substring(0, 3000)}

Responde SOLO con JSON válido:
{
  "estilo": "directo|sarcastico|tecnico|formal|coloquial",
  "patrones": "descripcion breve de patrones detectados",
  "vocabulario_clave": ["palabras", "recurrentes", "max 8"],
  "longitud_media": "corta|media|larga",
  "usa_emojis": true/false,
  "nivel_formalidad": 1-10
}`;

      try {
        const styleResult = await chat(
          [{ role: "user", content: stylePrompt }],
          { model: "gemini-flash", temperature: 0.3, responseFormat: "json" }
        );
        const parsed = JSON.parse(styleResult);
        styleAnalysis = { ...styleAnalysis, ...parsed };
        console.log(`Style detected: ${styleAnalysis.estilo} (formality: ${styleAnalysis.nivel_formalidad})`);
      } catch (e) {
        console.error("Style analysis failed, using defaults:", e);
      }
    }

    // ===== PHASE 2: Draft Generation with Voice Mirror =====
    const stressDirective = hasStressPattern
      ? `\n⚠️ ALERTA DE ESTRÉS DETECTADA: El contacto muestra señales de estrés/salud. La opción Relacional debe usar el MISMO tono brusco/directo del usuario. Ejemplo: "Deja de quejarte de la fiebre y descansa, ya me encargo yo". NO seas diplomático.`
      : "";

    const businessDirective = hasBusinessMilestone
      ? `\n📊 HITO DE NEGOCIO ACTIVO: Hay un hito de negocio en curso. La opción Estratégica debe ir DIRECTO al siguiente paso técnico, sin formalismos ni contexto innecesario.`
      : "";

    const systemPrompt = `Eres el asistente personal de un consultor. Tu trabajo es redactar 3 opciones de respuesta en español para un mensaje de WhatsApp.

🔑 REGLA PRINCIPAL: IMITA EXACTAMENTE el estilo de escritura del usuario. No intentes ser diplomático ni amable si el usuario no lo es. Sé auténtico, directo y utiliza el mismo nivel de confianza que se observa en sus mensajes previos.

ANÁLISIS DE ESTILO DEL USUARIO:
- Estilo dominante: ${styleAnalysis.estilo}
- Patrones: ${styleAnalysis.patrones}
- Vocabulario clave: ${styleAnalysis.vocabulario_clave.join(", ")}
- Longitud media de mensajes: ${styleAnalysis.longitud_media}
- Usa emojis: ${styleAnalysis.usa_emojis ? "Sí" : "No"}
- Nivel de formalidad: ${styleAnalysis.nivel_formalidad}/10

CONTACTO: ${contact.name}
ROL: ${contact.role || "No especificado"}
EMPRESA: ${contact.company || "No especificada"}
CATEGORÍA: ${contact.category || "pendiente"}

PERFIL PSICOLÓGICO:
${profileSummary}
${stressDirective}
${businessDirective}

HISTORIAL RECIENTE:
${conversationHistory}

REGLAS:
- Responde SIEMPRE en español
- Las respuestas deben sonar como si las escribiera el consultor desde WhatsApp
- Si el usuario no usa emojis, NO uses emojis
- Si el usuario es sarcástico, SÉ sarcástico
- Si el usuario es directo y cortante, SÉ directo y cortante
- Usa el mismo vocabulario y jerga que el usuario

Genera exactamente 3 opciones en formato JSON:

suggestion_1 (Estratégica/Negocios): Enfocada en mover el pipeline, cerrar hitos, avanzar objetivos profesionales.
suggestion_2 (Relacional/Empática): Enfocada en el bienestar personal, usando el MISMO tono que el usuario usaría naturalmente.
suggestion_3 (Ejecutiva/Concisa): Respuesta corta y directa para ganar tiempo o confirmar recepción.

Responde SOLO con JSON válido: { "suggestion_1": "...", "suggestion_2": "...", "suggestion_3": "..." }`;

    const userPrompt = `Mensaje recibido de ${contact.name}: "${message_content}"

Genera las 3 opciones de respuesta imitando el estilo del usuario.`;

    console.log(`Phase 2: Generating drafts for ${contact.name} (style: ${styleAnalysis.estilo})`);

    const result = await chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { model: "gemini-pro", temperature: 0.8, responseFormat: "json" }
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

    // Build context summary
    const contextSummary = `Último mensaje de ${contact.name}: "${message_content.substring(0, 100)}". Perfil: ${contact.category}. ${profile?.tipo_personalidad || ""}`;

    // Insert into suggested_responses with detected_style
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
        detected_style: styleAnalysis.estilo,
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

    console.log(`Response drafts generated (style: ${styleAnalysis.estilo}): ${inserted.id}`);

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
