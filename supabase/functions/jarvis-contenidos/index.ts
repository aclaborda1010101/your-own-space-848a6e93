import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { chat, ChatMessage } from "../_shared/ai-client.ts";
import { buildAgentPrompt } from "../_shared/rag-loader.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ContentContext {
  platform?: "linkedin" | "instagram" | "twitter" | "newsletter" | "general";
  contentType?: "post" | "carousel" | "thread" | "story" | "phrase";
  topic?: string;
  tone?: "professional" | "casual" | "inspirational" | "educational";
  targetAudience?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      messages, 
      context,
      queryType = "chat"
    } = await req.json() as {
      messages: Message[];
      context?: ContentContext;
      queryType?: "chat" | "generate" | "improve" | "phrases" | "hooks";
    };

    // Build context-specific additional instructions
    const additionalContext = `🎯 PROPÓSITO:
Crear contenido auténtico, cercano y que conecte emocionalmente. Evitar clichés motivacionales vacíos.

📱 CONTEXTO DE CONTENIDO:
- Plataforma: ${context?.platform || "General"}
- Tipo: ${context?.contentType || "Post"}
- Tema: ${context?.topic || "A definir"}
- Tono: ${context?.tone || "casual"}
- Audiencia: ${context?.targetAudience || "General"}

📋 TIPO DE CONSULTA: ${queryType.toUpperCase()}

${queryType === "generate" ? `
✍️ MODO GENERACIÓN:
- Crea contenido original y auténtico
- Adapta al formato de la plataforma
- Incluye hook potente
- CTA apropiado al objetivo
- Evita frases hechas y clichés
- Busca conexión emocional real
` : ""}

${queryType === "improve" ? `
🔄 MODO MEJORA:
- Analiza el contenido proporcionado
- Identifica puntos débiles
- Sugiere mejoras específicas
- Mantén la esencia del mensaje
- Fortalece el hook y CTA
- Simplifica si es necesario
` : ""}

${queryType === "phrases" ? `
💬 MODO FRASES:
- Frases reflexivas, no imperativas
- Preguntas que invitan a pensar
- Observaciones honestas sobre la vida
- Humor sutil cuando encaja
- Evita frases motivacionales genéricas
- Busca originalidad y autenticidad
` : ""}

${queryType === "hooks" ? `
🎣 MODO HOOKS:
- Hooks que detienen el scroll
- Específicos con números/detalles
- Inesperados (rompen patrones)
- Personales (experiencia real)
- Útiles (prometen valor)
- Breves (menos de 10 palabras ideal)
` : ""}

💬 ESTILO DE COMUNICACIÓN:
1. Cercano y conversacional
2. Honesto sin ser duro
3. Reflexivo, invita a pensar
4. Cálido pero directo
5. Vulnerable cuando aporta
6. Sin jerga corporativa
7. Como hablar con un amigo

📝 FORMATO:
- Estructura clara según plataforma
- Espacios para respirar (saltos de línea)
- Emojis con moderación
- Hook siempre primero
- CTA al final
- Hashtags solo si aplica`;

    const systemPrompt = await buildAgentPrompt("contenidos", additionalContext, 500);

    const allMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
    ];

    console.log("JARVIS Contenidos - Query:", { 
      queryType,
      platform: context?.platform,
      contentType: context?.contentType,
      messageCount: messages.length
    });

    let content: string;
    try {
      content = await chat(allMessages, {
        temperature: 0.9, // Higher creativity for content generation
      });
    } catch (err) {
      console.error("AI generation error:", err);
      const errorMessage = err instanceof Error ? err.message : "Error generating response";
      
      if (errorMessage.includes("429") || errorMessage.includes("quota")) {
        return new Response(
          JSON.stringify({ error: "Límite de uso alcanzado. Intenta de nuevo en unos minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw err;
    }

    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log("JARVIS Contenidos - Response generated");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: content,
        queryType
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("JARVIS Contenidos error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
