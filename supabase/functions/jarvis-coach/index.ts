import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chat, ChatMessage } from "../_shared/ai-client.ts";
import { buildAgentPrompt } from "../_shared/rag-loader.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserContext {
  whoop_today: { recovery: number; hrv: number; strain: number; sleep_hours: number; resting_hr: number } | null;
  recent_memories: Array<{ content: string; memory_type: string; importance: number }>;
  last_session: { summary: string; action_items: string[]; date: string } | null;
  total_sessions: number;
}

async function getUserContext(supabase: ReturnType<typeof createClient>, userId: string): Promise<UserContext> {
  const today = new Date().toISOString().split('T')[0];
  
  // Get WHOOP data
  const { data: whoopData } = await supabase
    .from('whoop_data')
    .select('*')
    .eq('user_id', userId)
    .eq('data_date', today)
    .single();

  // Get coach memories
  const { data: memories } = await supabase
    .from('specialist_memory')
    .select('content, memory_type, importance')
    .eq('user_id', userId)
    .eq('specialist', 'coach')
    .order('importance', { ascending: false })
    .limit(5);

  // Get last session
  const { data: lastSession } = await supabase
    .from('coach_sessions')
    .select('summary, action_items, session_date')
    .eq('user_id', userId)
    .order('session_date', { ascending: false })
    .limit(1)
    .single();

  // Get profile stats
  const { data: profile } = await supabase
    .from('user_profile_extended')
    .select('total_coach_sessions')
    .eq('user_id', userId)
    .single();

  return {
    whoop_today: whoopData ? {
      recovery: whoopData.recovery_score,
      hrv: whoopData.hrv,
      strain: whoopData.strain,
      sleep_hours: whoopData.sleep_hours,
      resting_hr: whoopData.resting_hr
    } : null,
    recent_memories: memories || [],
    last_session: lastSession ? {
      summary: lastSession.summary,
      action_items: lastSession.action_items || [],
      date: lastSession.session_date
    } : null,
    total_sessions: profile?.total_coach_sessions || 0
  };
}

async function saveMemory(
  supabase: ReturnType<typeof createClient>, 
  userId: string, 
  content: string, 
  memoryType: string,
  importance: number = 5
) {
  await supabase.from('specialist_memory').insert({
    user_id: userId,
    specialist: 'coach',
    memory_type: memoryType,
    content: content.substring(0, 500),
    importance
  });
}

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
- Celebra peque�os avances
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
- Evita soluciones r�pidas
- Mantén presencia y calma
- Propón peque�os gestos de autocuidado
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let userContext: UserContext | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        userContext = await getUserContext(supabase, userId);
      }
    }

    const body = await req.json();
    
    // Support both formats: { messages } or { message, history }
    let messages: Message[] = [];
    if (body.messages && Array.isArray(body.messages)) {
      messages = body.messages;
    } else {
      // Build messages from history + current message
      const history = (body.history || []).map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      if (body.message) {
        messages = [...history, { role: "user" as const, content: body.message }];
      } else {
        messages = history;
      }
    }
    
    const rawEmotional = body.emotionalState || {};
    const emotionalState: EmotionalState = {
      energy: rawEmotional.energy ?? 5,
      mood: rawEmotional.mood ?? 5,
      stress: rawEmotional.stress ?? 5,
      anxiety: rawEmotional.anxiety ?? 3,
      motivation: rawEmotional.motivation ?? 5,
    };
    const context: SessionContext = body.context || {};
    const sessionType: string = body.sessionType || "daily";

    // Determine protocol based on emotional state
    const { protocol, reason: protocolReason } = determineProtocol(emotionalState);
    const protocolPrompt = getProtocolPrompt(protocol);

    // Build WHOOP and memory context
    let whoopContext = "";
    let memoryContext = "";
    let sessionHistory = "";

    if (userContext) {
      if (userContext.whoop_today) {
        const w = userContext.whoop_today;
        whoopContext = `
📊 DATOS WHOOP HOY:
- Recovery: ${w.recovery}% ${w.recovery < 50 ? '(BAJO - ajustar intensidad)' : w.recovery >= 80 ? '(EXCELENTE)' : '(NORMAL)'}
- HRV: ${w.hrv}ms
- Sueño: ${w.sleep_hours?.toFixed(1) || '?'}h
- Frecuencia cardíaca en reposo: ${w.resting_hr} bpm
${w.recovery < 50 ? '⚠️ Recovery bajo: prioriza descanso y reduce demandas cognitivas.' : ''}`;
      }

      if (userContext.recent_memories?.length > 0) {
        memoryContext = `
🧠 RECUERDOS IMPORTANTES DEL USUARIO:
${userContext.recent_memories.map(m => `- [${m.memory_type}] ${m.content}`).join('\n')}`;
      }

      if (userContext.last_session) {
        sessionHistory = `
📝 ÚLTIMA SESIÓN (${userContext.last_session.date}):
- Resumen: ${userContext.last_session.summary || 'No disponible'}
- Action items pendientes: ${userContext.last_session.action_items?.join(', ') || 'Ninguno'}
- Total sesiones con este usuario: ${userContext.total_sessions}`;
      }
    }

    // Build agent prompt with RAG knowledge base
    const additionalContext = `${whoopContext}${memoryContext}${sessionHistory}

🎯 PROPÓSITO:
Acompa�ar procesos diarios de mejora personal con continuidad, profundidad y humanidad.
NO motivas de forma vacía. Sostienes, ordenas y ayudas a decidir mejor.

� FUNCIONES:
- Guiar sesiones de coaching (5-20 min)
- Mantener continuidad entre sesiones
- Aplicar protocolos según estado emocional
- Cerrar cada sesión con reflexión y próximo paso
- Detectar patrones emocionales y cognitivos
- Usar frameworks como GROW, Co-Active, y técnicas de psicología del alto rendimiento

 ESTADO EMOCIONAL ACTUAL:
- Energía: ${emotionalState.energy}/10
- Ánimo: ${emotionalState.mood}/10
- Estrés: ${emotionalState.stress}/10
- Ansiedad: ${emotionalState.anxiety}/10
- Motivación: ${emotionalState.motivation}/10

 PROTOCOLO ACTIVO: ${protocol.toUpperCase()}
Razón: ${protocolReason}

${protocolPrompt}

 CONTEXTO DE SESIÓN:
- Tipo: ${sessionType}
- Modo del día: ${context?.dayMode || "balanced"}
- Temas recientes: ${context?.recentTopics?.join(", ") || "Ninguno"}
${context?.checkInData ? `- Check-in: E${context.checkInData.energy} A${context.checkInData.mood} F${context.checkInData.focus}` : ""}

� REGLAS DE COMUNICACI�N:
1. Respuestas cortas (2-4 frases m�x por turno)
2. Una pregunta por mensaje
3. Tono cercano, firme y humano
4. Sin frases hechas ni clichés motivacionales
5. Sin promesas irreales
6. Valida antes de proponer
7. Termina con pregunta o próximo paso claro

� FORMATO:
Responde de forma natural, como un coach real. No uses emojis excesivos.
Si detectas cambio de protocolo necesario, menciónalo sutilmente.`;

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

    // Save important user statements as memories
    if (userId && messages.length > 0) {
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      if (lastUserMessage && lastUserMessage.content.length > 30) {
        // Detect if it contains important info (goals, concerns, facts)
        const importantKeywords = ['quiero', 'mi objetivo', 'me preocupa', 'siempre', 'nunca', 'importante', 'problema'];
        const isImportant = importantKeywords.some(k => lastUserMessage.content.toLowerCase().includes(k));
        
        if (isImportant) {
          await saveMemory(supabase, userId, lastUserMessage.content, 'user_statement', 6);
        }
      }
      
      // Update session count
      await supabase.from('user_profile_extended').upsert({
        user_id: userId,
        total_coach_sessions: (userContext?.total_sessions || 0) + (messages.length === 1 ? 1 : 0),
        last_coach_session: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: content,
        protocol,
        protocolReason,
        hasWhoopData: !!userContext?.whoop_today,
        sessionNumber: (userContext?.total_sessions || 0) + 1
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
