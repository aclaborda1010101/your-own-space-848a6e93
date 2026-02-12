import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// ============================================================
// JARVIS MULTI-AGENT SYSTEM PROMPTS
// ============================================================
const AGENT_PROMPTS: Record<string, string> = {
  jarvis: `Eres JARVIS, el asistente personal de élite del señor. Tu estilo es el de un mayordomo tecnológico de Iron Man: formal, eficiente, discreto y anticipador.

ESTILO DE COMUNICACIÓN:
- Trato siempre de usted: "señor", "si me permite", "muy bien, señor"
- Frases tipo mayordomo elegante: "He tomado la libertad de...", "Me he permitido..."
- Conciso pero sofisticado. NUNCA tutees al usuario.
- Respuestas claras y accionables.

CAPACIDADES:
- Gestión de tareas, calendario y prioridades diarias
- Análisis de estado emocional y energético
- Proactividad: sugiere acciones sin que te las pidan
- Coordinación con otros agentes (coach, english, nutrition, bosco, finance)
- Acceso a la memoria del usuario para dar respuestas personalizadas

REGLAS:
- SIEMPRE recuerda datos personales que el usuario comparta
- Si detectas algo importante (logro, problema, cambio), guárdalo en memoria
- Responde en español de España (castellano)`,

  coach: `Eres JARVIS Coach (POTUS), el coach personal de productividad y bienestar del señor.
Inspirado en Tony Robbins, James Clear y Tim Ferriss.

ESTILO DE COMUNICACIÓN:
- Trato siempre de usted: "señor", "si me permite"
- Directo pero empático. Desafía con respeto.
- NUNCA tutees al usuario.

METODOLOGÍA:
- Atomic Habits: sistemas > objetivos
- Deep Work: bloques de concentración
- Estoicismo práctico: control de lo controlable
- Dual Track: balance trabajo-vida
- Coaching socrático: preguntas poderosas

CAPACIDADES:
- Check-ins emocionales y energéticos
- Revisión semanal de hábitos y objetivos
- Técnicas de productividad (Pomodoro, time-blocking)
- Gestión del estrés y recuperación
- Feedback constructivo sobre patrones

Responde en español de España.`,

  english: `Eres JARVIS English, el tutor de inglés personal del señor.

ESTILO:
- En español: siempre de usted
- En inglés: profesional pero accesible
- Corrige errores de forma constructiva

METODOLOGÍA (CEFR B2-C1):
- Práctica conversacional real con correcciones inline
- Vocabulario business y profesional
- Simulaciones: reuniones, calls, presentaciones, emails
- Gramática en contexto, no aislada
- Pronunciación y expresiones idiomáticas

FORMATO DE CORRECCIÓN:
Cuando corrijas, usa: [ERROR] → [CORRECCIÓN] (explicación breve)

Alterna entre español e inglés según el ejercicio.`,

  nutrition: `Eres JARVIS Nutrition, el asesor de nutrición del señor.

ESTILO: Siempre de usted. Conciso y basado en evidencia.

CAPACIDADES:
- Planificar comidas balanceadas y macros
- Sugerir recetas prácticas y saludables
- Analizar hábitos alimenticios
- Optimizar para: energía, rendimiento cognitivo, composición corporal
- Timing nutricional: pre/post entreno, productividad

PRINCIPIOS:
- Sin extremismos ni dietas milagro
- Alimentos reales > suplementos
- Adaptado a preferencias y alergias del usuario

Responde en español de España.`,

  bosco: `Eres JARVIS Bosco, el asistente de crianza para el hijo del señor, Bosco (4 años).

ESTILO: Siempre de usted con el padre. Cálido y comprensivo.

CAPACIDADES:
- Sugerir actividades educativas por edad (4 años)
- Tracking de emociones y comportamiento
- Análisis de patrones emocionales
- Registro de milestones de desarrollo
- Consejos de crianza basados en evidencia
- Ideas de juegos, manualidades, lectura

PRINCIPIOS (inspirados en Montessori + disciplina positiva):
- Autonomía guiada
- Validación emocional
- Límites con respeto
- Juego como herramienta de aprendizaje
- Observación antes de intervención

Responde en español de España.`,

  finance: `Eres JARVIS Finance, el asesor financiero personal del señor.

ESTILO: Siempre de usted. Profesional y prudente.

CAPACIDADES:
- Análisis de gastos y presupuestos
- Seguimiento de metas de ahorro
- Categorización de transacciones
- Proyecciones financieras básicas
- Educación financiera práctica

PRINCIPIOS:
- Prudencia sobre especulación
- Datos > opiniones
- Automatización del ahorro
- Diversificación

DISCLAIMER: No soy asesor financiero certificado. Para decisiones importantes, consulte un profesional.

Responde en español de España.`,
};

// ============================================================
// MEMORY SYSTEM
// ============================================================

// Extract important facts from conversation to save as memories
function extractMemoryHints(userMessage: string, assistantResponse: string): Array<{
  type: 'core' | 'episodic' | 'semantic';
  content: string;
  importance: number;
}> {
  const memories: Array<{ type: 'core' | 'episodic' | 'semantic'; content: string; importance: number }> = [];
  const msg = userMessage.toLowerCase();

  // Core memories: personal facts
  const corePatterns = [
    /(?:me llamo|mi nombre es|soy)\s+(.+)/i,
    /(?:tengo|cumplo)\s+(\d+)\s+años/i,
    /(?:trabajo en|trabajo como|soy)\s+(.+?)(?:\.|,|$)/i,
    /(?:mi hijo|mi hija|mi mujer|mi pareja|mi esposa)\s+(.+?)(?:\.|,|$)/i,
    /(?:vivo en|estoy en)\s+(.+?)(?:\.|,|$)/i,
    /(?:mi objetivo|mi meta|quiero)\s+(.+?)(?:\.|,|$)/i,
  ];

  for (const pattern of corePatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      memories.push({
        type: 'core',
        content: userMessage.substring(0, 200),
        importance: 8,
      });
      break;
    }
  }

  // Episodic memories: events, achievements, problems
  const episodicPatterns = [
    /(?:hoy|ayer|esta semana|este mes)\s+(?:he|hice|logré|conseguí|pasó|ocurrió)/i,
    /(?:tengo una reunión|tengo cita|voy a|me han dicho|me ascendieron)/i,
    /(?:estoy enfermo|me duele|no dormí|dormí mal|estoy cansado|estoy estresado)/i,
    /(?:bosco|mi hijo)\s+(?:hoy|ayer|esta semana)/i,
  ];

  for (const pattern of episodicPatterns) {
    if (pattern.test(userMessage)) {
      memories.push({
        type: 'episodic',
        content: userMessage.substring(0, 300),
        importance: 6,
      });
      break;
    }
  }

  // Semantic memories: preferences, learnings
  const semanticPatterns = [
    /(?:me gusta|prefiero|no me gusta|odio|me encanta)\s+(.+)/i,
    /(?:descubrí que|aprendí que|me di cuenta|entendí que)/i,
    /(?:mi rutina|suelo|normalmente|siempre)\s+(.+)/i,
  ];

  for (const pattern of semanticPatterns) {
    if (pattern.test(userMessage)) {
      memories.push({
        type: 'semantic',
        content: userMessage.substring(0, 200),
        importance: 5,
      });
      break;
    }
  }

  return memories;
}

// Get user memories for context enrichment
async function getMemoryContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string> {
  try {
    // Use the get_jarvis_context function we created
    const { data, error } = await supabase.rpc('get_jarvis_context', {
      p_user_id: userId,
      p_limit: 10,
    });

    if (error || !data || data.length === 0) {
      return '';
    }

    const memoryLines = data.map((m: { memory_type: string; content: string; importance: number }) =>
      `[${m.memory_type.toUpperCase()}] ${m.content} (importancia: ${m.importance}/10)`
    );

    return `\n--- MEMORIA PERSISTENTE DEL USUARIO ---\n${memoryLines.join('\n')}\n`;
  } catch (error) {
    console.error('Error fetching memory context:', error);
    return '';
  }
}

// Save memories extracted from conversation
async function saveMemories(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  memories: Array<{ type: string; content: string; importance: number }>,
): Promise<void> {
  if (memories.length === 0) return;

  try {
    const inserts = memories.map(m => ({
      user_id: userId,
      memory_type: m.type,
      content: m.content,
      importance: m.importance,
      source: 'conversation',
    }));

    await supabase.from('jarvis_memory').insert(inserts);
    console.log(`[jarvis-realtime] Saved ${inserts.length} new memories`);
  } catch (error) {
    console.error('Error saving memories:', error);
  }
}

// ============================================================
// RAG CONTEXT
// ============================================================
async function getRAGContext(
  supabase: ReturnType<typeof createClient>,
  agentType: string,
  userId: string,
): Promise<string> {
  try {
    const sections: string[] = [];

    // User profile
    const { data: profile } = await supabase
      .from('user_profile')
      .select('name, vital_role, current_context, life_goals, professional_goals, family_context')
      .eq('user_id', userId)
      .maybeSingle();

    if (profile?.name) {
      sections.push(`[Perfil: ${profile.name}${profile.vital_role ? `, ${profile.vital_role}` : ''}]`);
      if (profile.current_context) sections.push(`[Contexto: ${profile.current_context}]`);
      if (profile.family_context?.son) sections.push(`[Familia: hijo ${profile.family_context.son}]`);
    }

    // Recent check-ins
    const { data: checkIns } = await supabase
      .from('check_ins')
      .select('energy, mood, focus, notes, date')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(2);

    if (checkIns?.length) {
      const latest = checkIns[0];
      sections.push(`[Estado actual (${latest.date}): Energía ${latest.energy}/10, Ánimo ${latest.mood}/10, Foco ${latest.focus}/10${latest.notes ? `, "${latest.notes}"` : ''}]`);
    }

    // Pending tasks (for jarvis, coach)
    if (['jarvis', 'coach', 'default'].includes(agentType)) {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('title, priority, duration')
        .eq('user_id', userId)
        .eq('completed', false)
        .in('priority', ['P0', 'P1'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (tasks?.length) {
        sections.push(`[Tareas P0-P1: ${tasks.map(t => `"${t.title}" (${t.priority})`).join(', ')}]`);
      }
    }

    // Today's events
    const today = new Date().toISOString().split('T')[0];
    const { data: events } = await supabase
      .from('events')
      .select('title, start_time')
      .eq('user_id', userId)
      .gte('start_time', today)
      .lte('start_time', today + 'T23:59:59')
      .order('start_time', { ascending: true })
      .limit(5);

    if (events?.length) {
      sections.push(`[Hoy: ${events.map(e => `"${e.title}" ${e.start_time?.split('T')[1]?.slice(0, 5) || ''}`).join(', ')}]`);
    }

    return sections.length > 0 ? '\n' + sections.join('\n') : '';
  } catch (error) {
    console.error('Error fetching RAG context:', error);
    return '';
  }
}

// ============================================================
// CONVERSATION HISTORY (using new jarvis_conversations table)
// ============================================================
async function getConversationHistory(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  agentType: string,
  sessionId?: string,
  limit: number = 15,
): Promise<Array<{ role: string; content: string }>> {
  try {
    let query = supabase
      .from('jarvis_conversations')
      .select('role, content')
      .eq('user_id', userId)
      .eq('agent_type', agentType)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching conversation history:', error);
      // Fallback to old table if new one doesn't have data
      const { data: oldData } = await supabase
        .from('conversation_history')
        .select('role, content')
        .eq('user_id', userId)
        .eq('agent_type', agentType)
        .order('created_at', { ascending: false })
        .limit(limit);

      return (oldData || []).reverse();
    }

    return (data || []).reverse();
  } catch (error) {
    console.error('Error in getConversationHistory:', error);
    return [];
  }
}

async function saveConversation(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  agentType: string,
  role: 'user' | 'assistant',
  content: string,
  sessionId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from('jarvis_conversations').insert({
      user_id: userId,
      agent_type: agentType,
      role,
      content,
      session_id: sessionId || null,
      metadata: metadata || null,
    });
  } catch (error) {
    console.error('Error saving conversation:', error);
    // Fallback to old table
    try {
      await supabase.from('conversation_history').insert({
        user_id: userId,
        agent_type: agentType,
        role,
        content,
        metadata: sessionId ? { sessionId } : null,
      });
    } catch (e) {
      console.error('Fallback save also failed:', e);
    }
  }
}

// ============================================================
// MAIN SERVER
// ============================================================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_AI_KEY');
  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { transcript, agentType = 'jarvis', sessionId, userId } = await req.json();

    if (!transcript || typeof transcript !== 'string') {
      return new Response(JSON.stringify({ error: 'transcript is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const effectiveAgent = AGENT_PROMPTS[agentType] ? agentType : 'jarvis';
    console.log(`[jarvis-realtime] Agent: ${effectiveAgent} | User: ${userId.substring(0, 8)}... | Msg: "${transcript.substring(0, 60)}..."`);

    // 1. Get system prompt
    const systemPrompt = AGENT_PROMPTS[effectiveAgent];

    // 2. Get RAG context (tasks, events, check-ins, profile)
    const ragContext = await getRAGContext(supabase, effectiveAgent, userId);

    // 3. Get persistent memory
    const memoryContext = await getMemoryContext(supabase, userId);

    // 4. Get conversation history
    const history = await getConversationHistory(supabase, userId, effectiveAgent, sessionId, 15);

    // 5. Build full system prompt
    const fullSystemPrompt = [
      systemPrompt,
      memoryContext ? `\n--- MEMORIA PERSISTENTE ---${memoryContext}` : '',
      ragContext ? `\n--- CONTEXTO ACTUAL ---${ragContext}` : '',
      '\nIMPORTANTE: Si el usuario comparte información personal relevante (nombre, familia, trabajo, objetivos, preferencias), recuérdalo para futuras conversaciones.',
    ].filter(Boolean).join('\n');

    // 6. Build messages
    const messages = [
      ...history.map(h => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user' as const, content: transcript },
    ];

    console.log(`[jarvis-realtime] Context: ${history.length} history msgs, memory: ${memoryContext ? 'yes' : 'no'}, RAG: ${ragContext ? 'yes' : 'no'}`);

    // 7. Call Gemini API
    const geminiMessages = [
      { role: 'user', parts: [{ text: fullSystemPrompt }] },
      { role: 'model', parts: [{ text: 'Entendido, señor. Estoy a su disposición.' }] },
      ...messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    ];

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: geminiMessages,
        generationConfig: {
          maxOutputTokens: 1500,
          temperature: 0.7,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[jarvis-realtime] Gemini API error ${response.status}:`, errorText);
      return new Response(JSON.stringify({
        error: `Gemini error: ${response.status}`,
        details: errorText,
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const assistantMessage = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Lo siento señor, no he podido procesar su solicitud.';

    console.log(`[jarvis-realtime] Response: "${assistantMessage.substring(0, 80)}..."`);

    // 8. Save conversation (both messages)
    await saveConversation(supabase, userId, effectiveAgent, 'user', transcript, sessionId);
    await saveConversation(supabase, userId, effectiveAgent, 'assistant', assistantMessage, sessionId, {
      model: 'gemini-2.0-flash',
      tokens: data.usageMetadata,
    });

    // 9. Extract and save memories (async, non-blocking)
    const memories = extractMemoryHints(transcript, assistantMessage);
    if (memories.length > 0) {
      saveMemories(supabase, userId, memories).catch(e =>
        console.error('[jarvis-realtime] Memory save error:', e)
      );
    }

    // 10. Broadcast via Realtime
    try {
      await supabase.channel('jarvis-state').send({
        type: 'broadcast',
        event: 'jarvis_response',
        payload: { userId, agentType: effectiveAgent, sessionId, state: 'response_ready' },
      });
    } catch (e) {
      console.warn('[jarvis-realtime] Broadcast error (non-critical):', e);
    }

    return new Response(JSON.stringify({
      response: assistantMessage,
      agentType: effectiveAgent,
      sessionId,
      usage: data.usageMetadata,
      memoriesSaved: memories.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[jarvis-realtime] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
