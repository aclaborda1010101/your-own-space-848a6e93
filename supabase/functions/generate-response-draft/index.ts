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

    // Gather context: last 10 messages
    const { data: recentMessages } = await supabase
      .from("contact_messages")
      .select("content, direction, sender, message_date")
      .eq("contact_id", contact_id)
      .order("message_date", { ascending: false })
      .limit(10);

    // Get contact info + personality profile
    const { data: contact } = await supabase
      .from("people_contacts")
      .select("name, category, role, company, personality_profile")
      .eq("id", contact_id)
      .single();

    if (!contact) {
      return new Response(JSON.stringify({ error: "Contact not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const systemPrompt = `Eres el asistente personal de un consultor de alto nivel. Tu trabajo es redactar 3 opciones de respuesta en español para un mensaje de WhatsApp, basándote en el perfil psicológico del contacto y el historial de conversación.

CONTACTO: ${contact.name}
ROL: ${contact.role || "No especificado"}
EMPRESA: ${contact.company || "No especificada"}
CATEGORÍA: ${contact.category || "pendiente"}

PERFIL PSICOLÓGICO:
${profileSummary}

HISTORIAL RECIENTE:
${conversationHistory}

REGLAS:
- Responde SIEMPRE en español
- Las respuestas deben sonar naturales, como si las escribiera el consultor desde WhatsApp
- NO uses emojis excesivos, máximo 1-2 por respuesta
- Adapta el tono al perfil psicológico del contacto

Genera exactamente 3 opciones en formato JSON:

suggestion_1 (Estratégica/Negocios): Enfocada en mover el pipeline, cerrar hitos, avanzar objetivos profesionales.
suggestion_2 (Relacional/Empática): Enfocada en el bienestar personal, usar pretextos del perfil (salud, familia, intereses).
suggestion_3 (Ejecutiva/Concisa): Respuesta corta y directa para ganar tiempo o confirmar recepción.

Responde SOLO con JSON válido: { "suggestion_1": "...", "suggestion_2": "...", "suggestion_3": "..." }`;

    const userPrompt = `Mensaje recibido de ${contact.name}: "${message_content}"

Genera las 3 opciones de respuesta.`;

    console.log(`Generating response drafts for contact ${contact.name} (${contact_id})`);

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

    // Insert into suggested_responses
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

    console.log(`Response drafts generated and saved: ${inserted.id}`);

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
