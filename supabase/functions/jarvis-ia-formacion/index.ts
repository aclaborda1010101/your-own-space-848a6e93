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

interface IAContext {
  userLevel?: "beginner" | "intermediate" | "advanced";
  focusArea?: string;
  currentProject?: string;
  preferredLanguage?: "python" | "javascript" | "both";
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
      context?: IAContext;
      queryType?: "chat" | "explain" | "code" | "architecture" | "debug";
    };

    // Build context-specific additional instructions
    const additionalContext = `🎯 PROPÓSITO:
Enseñar y resolver dudas sobre IA/ML de forma práctica y accesible.

👤 PERFIL DEL USUARIO:
- Nivel: ${context?.userLevel || "intermediate"}
- Área de enfoque: ${context?.focusArea || "General"}
- Lenguaje preferido: ${context?.preferredLanguage || "python"}
${context?.currentProject ? `- Proyecto actual: ${context.currentProject}` : ""}

📋 TIPO DE CONSULTA: ${queryType.toUpperCase()}

${queryType === "explain" ? `
📖 MODO EXPLICACIÓN:
- Conceptos claros con analogías simples
- De lo básico a lo avanzado progresivamente
- Ejemplos del mundo real
- Visualizaciones mentales cuando ayude
- Resumen de puntos clave al final
` : ""}

${queryType === "code" ? `
💻 MODO CÓDIGO:
- Código funcional y comentado
- Explicación línea por línea si es complejo
- Mejores prácticas incluidas
- Alternativas si las hay
- Consideraciones de producción
` : ""}

${queryType === "architecture" ? `
🏗️ MODO ARQUITECTURA:
- Diagramas en texto/ASCII si ayuda
- Componentes y sus interacciones
- Trade-offs de cada decisión
- Escalabilidad y mantenibilidad
- Recomendaciones de herramientas
` : ""}

${queryType === "debug" ? `
🐛 MODO DEBUG:
- Análisis del problema paso a paso
- Posibles causas ordenadas por probabilidad
- Soluciones específicas
- Cómo prevenir en el futuro
- Herramientas de debugging relevantes
` : ""}

💬 ESTILO DE COMUNICACIÓN:
1. Adapta el nivel técnico al usuario
2. Usa analogías para conceptos complejos
3. Proporciona ejemplos prácticos
4. Recomienda recursos para profundizar
5. Sé honesto sobre limitaciones
6. Menciona trade-offs y alternativas
7. Fomenta la experimentación práctica

📝 FORMATO:
- Código en bloques con sintaxis correcta
- Estructura clara con secciones
- Bullet points para listas
- Resumen al final si es largo
- Links a recursos cuando sea útil (menciona el recurso, no el link real)`;

    const systemPrompt = await buildAgentPrompt("ia-formacion", additionalContext, 500);

    const allMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
    ];

    console.log("JARVIS IA Formación - Query:", { 
      queryType,
      userLevel: context?.userLevel,
      focusArea: context?.focusArea,
      messageCount: messages.length
    });

    let content: string;
    try {
      content = await chat(allMessages, {
        temperature: 0.7,
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

    console.log("JARVIS IA Formación - Response generated");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: content,
        queryType
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("JARVIS IA Formación error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
