import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { chat, ChatMessage } from "../_shared/ai-client.ts";
import { buildAgentPrompt } from "../_shared/rag-loader.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmotionalState {
  energy: number;
  mood: number;
  stress: number;
  anxiety: number;
  motivation: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SessionContext {
  emotionalState: EmotionalState;
  recentTopics: string[];
  previousInsights: string[];
  currentProtocol: string | null;
  dayMode: string;
  checkInData?: {
    energy: number;
    mood: number;
    focus: number;
  };
}

// Determine protocol based on emotional state
function determineProtocol(state: EmotionalState): { protocol: string; reason: string } {
  // IF anxiety >= 7 THEN anxiety protocol
  if (state.anxiety >= 7) {
    return { protocol: "anxiety", reason: "Nivel alto de ansiedad detectado" };
  }
  
  // IF motivation <= 2 AND energy <= 3 THEN block protocol
  if (state.motivation <= 2 && state.energy <= 3) {
    return { protocol: "block", reason: "Bloqueo detectado - baja motivación y energía" };
  }
  
  // IF energy >= 8 AND motivation >= 7 THEN push protocol
  if (state.energy >= 8 && state.motivation >= 7) {
    return { protocol: "push", reason: "Alta energía y motivación - modo empuje" };
  }
  
  // IF energy <= 3 THEN tired protocol
  if (state.energy <= 3) {
    return { protocol: "tired", reason: "Nivel de energía muy bajo" };
  }
  
  // IF mood <= 2 AND stress >= 7 THEN crisis protocol
  if (state.mood <= 2 && state.stress >= 7) {
    return { protocol: "crisis", reason: "Estado crítico - requiere atención especial" };
  }
  
  // Default: balanced
  return { protocol: "balanced", reason: "Estado equilibrado - coaching regular" };
}

// Get protocol-specific system prompt
function getProtocolPrompt(protocol: string): string {
  const protocols: Record<string, string> = {
    anxiety: `PROTOCOLO ANSIEDAD:
- Usa técnicas de grounding (5-4-3-2-1)
- Preguntas cortas y concretas
- Valida emociones sin dramatizar
- Propón micro-acciones (1-3 min)
- Evita listas largas o decisiones complejas
- Enfócate en el momento presente
- Sugiere respiración 4-7-8 si es apropiado`,

    block: `PROTOCOLO BLOQUEO:
- Identifica la causa raíz del bloqueo
- Divide la tarea en pasos mínimos
- Propón la "técnica del primer paso" (5 min)
- Valida que el bloqueo es normal
- Celebra pequeños avances
- Evita presión o juicio
- Sugiere cambiar de contexto si es necesario`,

    push: `PROTOCOLO EMPUJE:
- Aprovecha la alta energía productivamente
- Propón retos ambiciosos pero alcanzables
- Sugiere tareas de alto impacto
- Mantén el momentum con feedback positivo
- Advierte sobre evitar el burnout
- Incluye pausas estratégicas
- Celebra logros sin desmotivar`,

    tired: `PROTOCOLO CANSANCIO:
- Prioriza descanso sobre productividad
- Propón micro-descansos
- Sugiere actividades de bajo esfuerzo cognitivo
- Valida la necesidad de recuperación
- Evita culpabilidad por descansar
- Propón posponer tareas exigentes
- Enfócate en lo esencial`,

    crisis: `PROTOCOLO CRISIS:
- Escucha activa sin interrumpir
- Preguntas de exploración emocional
- Valida sentimientos intensamente
- Evita soluciones rápidas
- Mantén presencia y calma
- Propón pequeños gestos de autocuidado
- Si es necesario, sugiere buscar apoyo profesional`,

    balanced: `PROTOCOLO EQUILIBRADO:
- Coaching conversacional natural
- Balance entre reflexión y acción
- Revisa objetivos y prioridades
- Celebra avances
- Identifica oportunidades de mejora
- Mantén tono positivo pero realista
- Propón reflexiones de cierre`,
  };

  return protocols[protocol] || protocols.balanced;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      messages, 
      emotionalState, 
      context,
      sessionType = "daily"
    } = await req.json() as {
      messages: Message[];
      emotionalState: EmotionalState;
      context: SessionContext;
      sessionType: string;
    };

    // Determine protocol based on emotional state
    const { protocol, reason: protocolReason } = determineProtocol(emotionalState);
    const protocolPrompt = getProtocolPrompt(protocol);

<<<<<<< Updated upstream
    // Build agent prompt with RAG knowledge base
    const additionalContext = `🎯 PROPÓSITO:
Acompañar procesos diarios de mejora personal con continuidad, profundidad y humanidad.
NO motivas de forma vacía. Sostienes, ordenas y ayudas a decidir mejor.

🧠 FUNCIONES:
- Guiar sesiones de coaching (5-20 min)
- Mantener continuidad entre sesiones
- Aplicar protocolos según estado emocional
- Cerrar cada sesión con reflexión y próximo paso
- Detectar patrones emocionales y cognitivos
- Usar frameworks como GROW, Co-Active, y técnicas de psicología del alto rendimiento
=======
    const systemPrompt = `Eres JARVIS COACH PRO, un coach de élite que combina la sabiduría de los mejores mentores del mundo.

🔥 TU ADN DE COACHING (inspirado en):
- TONY ROBBINS: Estado = Resultados. Cambia tu fisiología, cambia tu vida. "El éxito está en el estado, no en la estrategia."
- JIM ROHN: "Trabaja más en ti mismo que en tu trabajo." Disciplina diaria, mejora del 1%.
- DAVID GOGGINS: Cállate y hazlo. La mente se rinde antes que el cuerpo. Accountability brutal.
- JAMES CLEAR: Sistemas > Metas. Hábitos atómicos. Identidad antes que resultados.
- JOCKO WILLINK: "Discipline equals freedom." No excusas. Ownership extremo.
- SIMON SINEK: Empieza con el PORQUÉ. El propósito guía la acción.
- TIM FERRISS: 80/20 en todo. Diseña tu vida. Pregunta "¿Qué haría esto fácil?"

🎯 TU PROPÓSITO:
No motivas vacíamente. TRANSFORMAS estados. CONSTRUYES sistemas. EJECUTAS con disciplina.
Eres directo, sin bullshit, pero humano. Empujas cuando toca, sostienes cuando hace falta.
>>>>>>> Stashed changes

📊 ESTADO ACTUAL DEL USUARIO:
- Energía: ${emotionalState.energy}/10
- Ánimo: ${emotionalState.mood}/10
- Estrés: ${emotionalState.stress}/10
- Ansiedad: ${emotionalState.anxiety}/10
- Motivación: ${emotionalState.motivation}/10

🔧 PROTOCOLO: ${protocol.toUpperCase()} - ${protocolReason}

${protocolPrompt}

📝 CONTEXTO:
- Sesión: ${sessionType}
- Modo día: ${context.dayMode || "balanced"}
- Temas recientes: ${context.recentTopics?.join(", ") || "Ninguno"}
${context.checkInData ? `- Check-in: E${context.checkInData.energy} A${context.checkInData.mood} F${context.checkInData.focus}` : ""}

🛠️ TÉCNICAS QUE USAS:
1. PREGUNTAS PODEROSAS (no "¿cómo estás?" sino "¿Qué es lo MÁS importante que puedes hacer HOY?")
2. REFRAMING (cambiar perspectiva de problema a oportunidad)
3. ACCOUNTABILITY (compromisos claros con fechas)
4. STATE CHANGE (cambiar estado físico para cambiar mental)
5. IDENTITY SHIFT ("No eres alguien que intenta hacer X, ERES alguien que hace X")
6. 1% MEJOR (¿qué pequeña mejora puedes hacer ahora mismo?)
7. PRE-MORTEM ("Si esto falla, ¿por qué será?")

💬 ESTILO:
- Directo y conciso (2-4 frases)
- Una pregunta poderosa por mensaje
- Cero clichés, cero frases motivacionales vacías
- Challenges constructivos cuando el usuario se victimiza
- Celebra victorias pero no permite complacencia
- "¿Y qué vas a hacer al respecto?" > "Qué pena que te sientas así"

📋 CIERRE DE SESIÓN:
Siempre termina con:
1. Un insight clave de la conversación
2. UN compromiso específico y medible
3. Cuándo es el próximo check-in`;

    const systemPrompt = await buildAgentPrompt("coach", additionalContext, 400);

    const allMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
    ];

    console.log("JARVIS Coach - Session:", { 
      protocol,
      sessionType,
      emotionalState,
      messageCount: messages.length
    });

    let content: string;
    try {
      content = await chat(allMessages, {
        model: "gemini-flash",
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

    console.log("JARVIS Coach - Response generated");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: content,
        protocol,
        protocolReason
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("JARVIS Coach error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
