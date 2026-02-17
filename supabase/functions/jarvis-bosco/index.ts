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
  recentMilestones?: string[];
  currentChallenges?: string[];
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
      queryType?: "chat" | "activity" | "vocabulary" | "advice" | "milestone" | "behavior";
    };

    const childAge = context?.childAge || 4.5;
    const childName = context?.childName || "Bosco";

    // Determine developmental stage
    let stage = "4-5 años: El Preguntón";
    if (childAge < 1) stage = "0-12 meses: El Primer Año";
    else if (childAge < 2) stage = "1-2 años: El Explorador";
    else if (childAge < 3) stage = "2-3 años: El Terrible Two";
    else if (childAge < 4) stage = "3-4 años: El Comunicador";
    else if (childAge < 5) stage = "4-5 años: El Preguntón";
    else stage = "5-6 años: El Pre-escolar Maduro";

    const additionalContext = `CONTEXTO ACTIVO DE LA SESION:

DATOS DEL NINO:
- Nombre: ${childName}
- Edad: ${childAge} años
- Etapa del desarrollo: ${stage}
- Idioma objetivo: ${context?.languageFocus === "english" ? "Inglés" : context?.languageFocus === "both" ? "Bilingüe ES/EN" : "Español"}
- Estado de ánimo actual: ${context?.currentMood || "No especificado"}
- Nivel de energía: ${context?.energyLevel || "No especificado"}
${context?.recentActivities?.length ? `- Actividades recientes: ${context.recentActivities.join(", ")}` : ""}
${context?.recentMilestones?.length ? `- Hitos recientes: ${context.recentMilestones.join(", ")}` : ""}
${context?.currentChallenges?.length ? `- Retos actuales: ${context.currentChallenges.join(", ")}` : ""}

TIPO DE CONSULTA: ${queryType.toUpperCase()}

${queryType === "activity" ? `MODO ACTIVIDADES:
Genera actividades ESPECIFICAS para ${childAge} años (etapa: ${stage}).
Incluye: objetivo de desarrollo, materiales, instrucciones paso a paso, duración, variaciones por energía.
Prioriza actividades que trabajen áreas de desarrollo clave para esta edad.
Adapta al nivel de energía: ${context?.energyLevel || "medio"}.` : ""}

${queryType === "vocabulary" ? `MODO VOCABULARIO BILINGUE:
Genera vocabulario apropiado para ${childAge} años.
Incluye: palabra ES/EN, contexto de uso, juego para practicar.
Categorías: animales, colores, números, familia, acciones, emociones.
Usa la metodología de chunks (frases completas) cuando sea posible.` : ""}

${queryType === "advice" ? `MODO CONSEJO DE CRIANZA:
Basa tus consejos en la etapa ${stage}.
Usa principios de disciplina positiva y crianza respetuosa.
Referencia autores cuando sea relevante (Siegel, Nelsen, González).
Ofrece frases concretas que el padre pueda usar.
Recuerda: conexión antes de corrección.` : ""}

${queryType === "milestone" ? `MODO SEGUIMIENTO DE HITOS:
Evalúa el progreso según los hitos esperados para ${childAge} años.
Sé tranquilizador: cada niño tiene su ritmo.
Indica qué observar sin generar ansiedad.
Solo recomienda consultar profesional si hay señales claras de alerta.` : ""}

${queryType === "behavior" ? `MODO ANALISIS DE COMPORTAMIENTO:
Analiza el comportamiento desde la perspectiva del desarrollo de ${childAge} años.
Explica POR QUE ocurre (neurociencia del cerebro infantil).
Ofrece estrategias basadas en disciplina positiva.
Incluye frases útiles concretas para el padre.
Recuerda: el comportamiento es comunicación.` : ""}

ESTILO DE COMUNICACION:
1. Tono cálido, empático y profesional
2. Basado en evidencia científica pero accesible
3. Estrategias prácticas e inmediatamente aplicables
4. Valida siempre las emociones y esfuerzo del padre
5. Sin juicios sobre decisiones de crianza
6. Frases concretas y ejemplos reales
7. Normaliza las dificultades de la crianza
8. Recuerda: un padre regulado = un niño que aprende a regularse

FORMATO:
- Estructura clara con secciones cuando sea necesario
- Instrucciones paso a paso para actividades
- Ejemplos concretos con diálogos reales
- Sin emojis, usa marcadores claros (-, *, numeración)
- Conciso pero completo`;

    const systemPrompt = await buildAgentPrompt("bosco", additionalContext, 500);

    const allMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
    ];

    console.log("JARVIS Bosco - Query:", { 
      queryType,
      childAge,
      stage,
      energyLevel: context?.energyLevel,
      messageCount: messages.length
    });

    let content: string;
    try {
      content = await chat(allMessages, {
        model: "gemini-flash",
        temperature: 0.75,
        maxTokens: 6000,
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

    console.log("JARVIS Bosco - Response generated, length:", content.length);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: content,
        queryType,
        stage
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
