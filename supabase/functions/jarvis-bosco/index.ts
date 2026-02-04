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

interface BoscoContext {
  childAge?: number;
  childName?: string;
  recentActivities?: string[];
  currentMood?: string;
  energyLevel?: string;
  languageFocus?: "spanish" | "english" | "both";
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
      context?: BoscoContext;
      queryType?: "chat" | "activity" | "vocabulary" | "advice";
    };

    // Build context-specific additional instructions
    const additionalContext = `🎯 PROPÓSITO:
Acompañar el desarrollo de Bosco (${context?.childAge || 4.5} años) con actividades, vocabulario y consejos de crianza consciente.

👶 CONTEXTO DEL NIÑO:
- Nombre: ${context?.childName || "Bosco"}
- Edad: ${context?.childAge || 4.5} años
- Idioma objetivo: ${context?.languageFocus === "english" ? "Inglés" : context?.languageFocus === "both" ? "Bilingüe ES/EN" : "Español"}
- Estado de ánimo: ${context?.currentMood || "Normal"}
- Nivel de energía: ${context?.energyLevel || "Medio"}
${context?.recentActivities?.length ? `- Actividades recientes: ${context.recentActivities.join(", ")}` : ""}

📋 TIPO DE CONSULTA: ${queryType.toUpperCase()}

${queryType === "activity" ? `
🎨 GENERACIÓN DE ACTIVIDADES:
- Propón actividades apropiadas para su edad
- Incluye instrucciones paso a paso simples
- Sugiere materiales necesarios
- Estima duración realista
- Adapta al nivel de energía actual
- Incluye variaciones si es posible
` : ""}

${queryType === "vocabulary" ? `
📚 VOCABULARIO BILINGÜE:
- Palabras apropiadas para su edad
- Contexto de uso cotidiano
- Pronunciación simple (si aplica)
- Juegos para practicar
- Categorías: animales, colores, números, familia, acciones
` : ""}

${queryType === "advice" ? `
💡 CONSEJOS DE CRIANZA:
- Basados en desarrollo infantil
- Enfoque en conexión antes que corrección
- Técnicas de co-regulación emocional
- Límites con amor
- Comunicación positiva
- Evitar castigos y amenazas
` : ""}

💬 ESTILO DE COMUNICACIÓN:
1. Respuestas cálidas y cercanas
2. Lenguaje simple para actividades
3. Consejos prácticos y aplicables
4. Celebrar pequeños logros
5. Enfoque en el proceso, no el resultado
6. Paciencia y comprensión
7. Sin juicios ni culpabilidad

📝 FORMATO:
- Usa emojis con moderación para claridad
- Estructura clara con secciones si es necesario
- Instrucciones paso a paso cuando sea relevante
- Incluye ejemplos concretos`;

    const systemPrompt = await buildAgentPrompt("bosco", additionalContext, 400);

    const allMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
    ];

    console.log("JARVIS Bosco - Query:", { 
      queryType,
      context: {
        childAge: context?.childAge,
        languageFocus: context?.languageFocus,
        energyLevel: context?.energyLevel
      },
      messageCount: messages.length
    });

    let content: string;
    try {
      content = await chat(allMessages, {
        temperature: 0.8,
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

    console.log("JARVIS Bosco - Response generated");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: content,
        queryType
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("JARVIS Bosco error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
