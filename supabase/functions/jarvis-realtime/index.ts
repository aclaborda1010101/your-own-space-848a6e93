import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Claude API configuration
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// Agent system prompts with RAG context
const AGENT_PROMPTS: Record<string, string> = {
  coach: `Eres JARVIS Coach, el coach personal de productividad y bienestar del señor.

ESTILO DE COMUNICACIÓN:
- Trato siempre de usted: "señor", "si me permite", "muy bien, señor"
- Frases tipo mayordomo: "Permítame sugerir...", "He preparado...", "Me he permitido..."
- Conciso pero elegante. Respuestas breves y eficientes.
- NUNCA tutees al usuario. Siempre de usted.

CAPACIDADES COMO COACH:
- Ayudar con gestión del tiempo y tareas
- Proporcionar apoyo emocional y motivacional
- Sugerir técnicas de productividad (Pomodoro, time-blocking, etc.)
- Hacer check-ins del estado emocional
- Dar feedback constructivo sobre hábitos

CONTEXTO DEL USUARIO:
El usuario utiliza la app JARVIS como su sistema operativo de vida. Tiene tareas, calendario, hábitos y métricas de bienestar. Usa metodología de deep work y pomodoros.

Responde siempre en español de España (castellano).`,

  english: `Eres JARVIS English, el tutor de inglés personal del señor.

ESTILO DE COMUNICACIÓN:
- Trato siempre de usted cuando hablas en español
- Cuando practiquen inglés, mantén un tono profesional pero accesible
- Corrige errores de forma constructiva
- NUNCA tutees al usuario en español

METODOLOGÍA DE ENSEÑANZA:
- Práctica conversacional real
- Corrección de errores en contexto
- Vocabulario business y profesional
- Pronunciación y expresiones idiomáticas
- Simulaciones de reuniones, calls, presentaciones

NIVEL DEL USUARIO: Intermedio-Avanzado (B2-C1)
El usuario necesita inglés para reuniones de trabajo y comunicación profesional.

Alterna entre español e inglés según el ejercicio. Proporciona feedback detallado.`,

  nutrition: `Eres JARVIS Nutrition, el asesor de nutrición personal del señor.

ESTILO DE COMUNICACIÓN:
- Trato siempre de usted
- Conciso y basado en evidencia científica
- Sin extremismos ni dietas milagro

CAPACIDADES:
- Planificar comidas y macros
- Sugerir recetas saludables
- Analizar hábitos alimenticios
- Adaptar a objetivos (rendimiento, energía, composición corporal)

El usuario sigue una alimentación equilibrada, entrena regularmente y busca optimizar energía y rendimiento cognitivo.

Responde en español de España.`,

  default: `Eres JARVIS, el asistente personal de élite del señor. Tu estilo es el de un mayordomo tecnológico: formal, eficiente, discreto y anticipador.

ESTILO DE COMUNICACIÓN:
- Trato siempre de usted: "señor", "si me permite", "muy bien, señor"
- Frases tipo mayordomo elegante
- Conciso pero sofisticado
- NUNCA tutees al usuario

CAPACIDADES:
- Gestión de tareas y calendario
- Consultas generales
- Asistencia con cualquier tema
- Proactividad y anticipación

Responde en español de España (castellano).`,
};

// Get RAG context for agent (can be expanded with vector search)
async function getAgentRAGContext(
  supabase: ReturnType<typeof createClient>,
  agentType: string,
  userId: string
): Promise<string> {
  try {
    // Get user's recent check-ins for context
    const { data: checkIns } = await supabase
      .from('check_ins')
      .select('energy, mood, focus, notes, date')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(3);

    // Get pending tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('title, type, priority, duration')
      .eq('user_id', userId)
      .eq('completed', false)
      .order('created_at', { ascending: false })
      .limit(5);

    // Get today's events
    const today = new Date().toISOString().split('T')[0];
    const { data: events } = await supabase
      .from('events')
      .select('title, start_time, end_time')
      .eq('user_id', userId)
      .gte('start_time', today)
      .lte('start_time', today + 'T23:59:59')
      .order('start_time', { ascending: true })
      .limit(5);

    // Build context string
    let context = '';
    
    if (checkIns?.length) {
      const latest = checkIns[0];
      context += `\n[Estado actual del usuario - Check-in más reciente (${latest.date}): Energía ${latest.energy}/10, Ánimo ${latest.mood}/10, Enfoque ${latest.focus}/10${latest.notes ? `, Notas: "${latest.notes}"` : ''}]\n`;
    }

    if (tasks?.length) {
      context += `\n[Tareas pendientes: ${tasks.map(t => `"${t.title}" (${t.priority}, ${t.duration}min)`).join(', ')}]\n`;
    }

    if (events?.length) {
      context += `\n[Eventos de hoy: ${events.map(e => `"${e.title}" a las ${e.start_time?.split('T')[1]?.slice(0,5) || 'TBD'}`).join(', ')}]\n`;
    }

    return context;
  } catch (error) {
    console.error('Error fetching RAG context:', error);
    return '';
  }
}

// Get conversation history
async function getConversationHistory(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  agentType: string,
  sessionId?: string,
  limit: number = 10
): Promise<Array<{ role: string; content: string }>> {
  try {
    let query = supabase
      .from('conversation_history')
      .select('role, content')
      .eq('user_id', userId)
      .eq('agent_type', agentType)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (sessionId) {
      query = query.eq('metadata->sessionId', sessionId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching history:', error);
      return [];
    }

    // Reverse to get chronological order
    return (data || []).reverse();
  } catch (error) {
    console.error('Error in getConversationHistory:', error);
    return [];
  }
}

// Save message to history
async function saveMessage(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  agentType: string,
  role: 'user' | 'assistant',
  content: string,
  sessionId?: string
): Promise<void> {
  try {
    await supabase.from('conversation_history').insert({
      user_id: userId,
      agent_type: agentType,
      role,
      content,
      metadata: sessionId ? { sessionId } : null,
    });
  } catch (error) {
    console.error('Error saving message:', error);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Get API keys
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not configured');
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Initialize Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { transcript, agentType = 'default', sessionId, userId } = await req.json();

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

    console.log(`[jarvis-realtime] Processing transcript for ${agentType}: "${transcript.substring(0, 50)}..."`);

    // Get system prompt for agent
    const systemPrompt = AGENT_PROMPTS[agentType] || AGENT_PROMPTS.default;

    // Get RAG context
    const ragContext = await getAgentRAGContext(supabase, agentType, userId);

    // Get conversation history
    const history = await getConversationHistory(supabase, userId, agentType, sessionId, 10);

    // Build messages array for Claude
    const messages = [
      ...history.map(h => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      {
        role: 'user' as const,
        content: transcript,
      },
    ];

    // Full system prompt with RAG context
    const fullSystemPrompt = ragContext 
      ? `${systemPrompt}\n\n--- CONTEXTO ACTUAL ---${ragContext}`
      : systemPrompt;

    console.log(`[jarvis-realtime] Calling Claude with ${messages.length} messages`);

    // Call Claude API
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: fullSystemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', response.status, errorText);
      return new Response(JSON.stringify({ 
        error: `Claude error: ${response.status}`,
        details: errorText 
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const assistantMessage = data.content?.[0]?.text || 'Lo siento, no he podido procesar su solicitud.';

    console.log(`[jarvis-realtime] Claude response: "${assistantMessage.substring(0, 50)}..."`);

    // Save both messages to history
    await saveMessage(supabase, userId, agentType, 'user', transcript, sessionId);
    await saveMessage(supabase, userId, agentType, 'assistant', assistantMessage, sessionId);

    // Broadcast state update via Realtime (optional - for UI sync)
    await supabase.channel('jarvis-state').send({
      type: 'broadcast',
      event: 'jarvis_response',
      payload: {
        userId,
        agentType,
        sessionId,
        state: 'response_ready',
      },
    });

    return new Response(JSON.stringify({ 
      response: assistantMessage,
      agentType,
      sessionId,
      usage: data.usage,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in jarvis-realtime:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
