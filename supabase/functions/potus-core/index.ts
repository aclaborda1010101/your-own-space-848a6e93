import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chat, ChatMessage } from "../_shared/ai-client.ts";
import { buildPotusMessageMetadata, resolvePotusConversationContext } from "../_shared/potus-conversation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PotusRequest {
  action: "chat" | "analyze" | "route" | "daily_summary" | "get_context";
  message?: string;
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  context?: Record<string, unknown>;
  user_id?: string;
  platform?: "app" | "telegram";
  transport?: Record<string, unknown>;
}

interface Specialist {
  name: string;
  triggers: string[];
  description: string;
}

const SPECIALISTS: Specialist[] = [
  {
    name: "coach",
    triggers: ["productividad", "motivación", "bloqueo", "energía", "estrés", "ansiedad", "objetivos", "foco", "procrastinar", "hábitos"],
    description: "Coach de alto rendimiento - productividad, emociones, decisiones"
  },
  {
    name: "nutrition",
    triggers: ["comida", "dieta", "proteína", "calorías", "receta", "nutrición", "hambre", "peso", "alimentación", "comer"],
    description: "Nutricionista - alimentación, recetas, macros"
  },
  {
    name: "english",
    triggers: ["inglés", "english", "vocabulario", "gramática", "pronunciación", "speaking", "idioma", "traducir"],
    description: "Profesor de inglés - práctica y aprendizaje"
  },
  {
    name: "bosco",
    triggers: ["bosco", "hijo", "niño", "actividad", "juego", "padre", "paternidad"],
    description: "Actividades y cuidado de Bosco"
  }
];

const WHATSAPP_TRIGGERS = ["whatsapp", "mensaje", "conversación", "conversacion", "le dije", "me dijo", "chat con", "le escribí", "me escribió", "le mandé", "me mandó", "hablé con", "hablar con"];

function detectsWhatsAppIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return WHATSAPP_TRIGGERS.some(t => lower.includes(t));
}

function extractContactNames(message: string): string[] {
  const lower = message.toLowerCase();
  const names: string[] = [];
  
  // Pattern: "con [Name]", "de [Name]", "a [Name]"
  const patterns = [
    /(?:con|de|a|sobre)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/g,
    /(?:chat|conversaci[oó]n|mensajes?)\s+(?:con|de)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(message)) !== null) {
      const name = match[1].trim();
      if (name.length > 2 && !["que", "los", "las", "una", "por", "para"].includes(name.toLowerCase())) {
        names.push(name);
      }
    }
  }
  
  return [...new Set(names)];
}

async function getWhatsAppContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  userMessage: string
): Promise<string> {
  if (!detectsWhatsAppIntent(userMessage)) return "";
  
  const contactNames = extractContactNames(userMessage);
  if (contactNames.length === 0) {
    // Generic: get last 10 messages across all contacts
    const { data: recentMsgs } = await supabase
      .from('contact_messages')
      .select('content, sender, direction, message_date')
      .eq('user_id', userId)
      .eq('source', 'whatsapp')
      .order('message_date', { ascending: false })
      .limit(10);
    
    if (!recentMsgs || recentMsgs.length === 0) return "";
    
    const formatted = recentMsgs.reverse().map((m: any) => {
      const dir = m.direction === 'outgoing' ? 'Tú' : (m.sender || 'Contacto');
      return `[${m.message_date?.substring(0, 16) || '?'}] ${dir}: ${(m.content || '').substring(0, 200)}`;
    }).join('\n');
    
    return `\nÚLTIMOS MENSAJES WHATSAPP:\n${formatted}`;
  }
  
  const sections: string[] = [];
  
  for (const name of contactNames.slice(0, 3)) {
    // Try exact ilike first, then fuzzy
    let contacts: any[] = [];
    const { data: exactMatch } = await supabase
      .from('people_contacts')
      .select('id, name')
      .eq('user_id', userId)
      .ilike('name', `%${name}%`)
      .limit(3);
    
    if (exactMatch && exactMatch.length > 0) {
      contacts = exactMatch;
    } else {
      // Fuzzy search
      const { data: fuzzyMatch } = await supabase.rpc('search_contacts_fuzzy', {
        p_user_id: userId,
        p_search_term: name,
        p_limit: 3
      });
      if (fuzzyMatch) contacts = fuzzyMatch;
    }
    
    if (contacts.length === 0) continue;
    
    for (const contact of contacts.slice(0, 1)) {
      const { data: msgs } = await supabase
        .from('contact_messages')
        .select('content, sender, direction, message_date')
        .eq('contact_id', contact.id)
        .order('message_date', { ascending: false })
        .limit(25);
      
      if (!msgs || msgs.length === 0) continue;
      
      const formatted = msgs.reverse().map((m: any) => {
        const dir = m.direction === 'outgoing' ? 'Tú' : (m.sender || contact.name);
        return `[${m.message_date?.substring(0, 16) || '?'}] ${dir}: ${(m.content || '').substring(0, 200)}`;
      }).join('\n');
      
      sections.push(`Conversación con ${contact.name}:\n${formatted}`);
    }
  }
  
  if (sections.length === 0) return "";
  return `\nCONVERSACIONES WHATSAPP RELEVANTES:\n${sections.join('\n\n')}`;
}

function detectSpecialist(message: string): { specialist: string | null; confidence: number } {
  const lowerMessage = message.toLowerCase();
  
  for (const spec of SPECIALISTS) {
    const matches = spec.triggers.filter(t => lowerMessage.includes(t));
    if (matches.length > 0) {
      return { specialist: spec.name, confidence: Math.min(matches.length * 0.3, 1) };
    }
  }
  
  return { specialist: null, confidence: 0 };
}

async function getFullContext(supabase: ReturnType<typeof createClient>, userId: string) {
  const [contextResult, tasksResult, whoopTrendResult] = await Promise.all([
    supabase.rpc('get_potus_context', { p_user_id: userId }),
    supabase
      .from('todos')
      .select('title, priority, due_date, is_completed')
      .eq('user_id', userId)
      .eq('is_completed', false)
      .order('priority', { ascending: false })
      .limit(5),
    supabase.rpc('get_recent_whoop_data', {
      p_user_id: userId,
      p_days: 7
    }),
  ]);

  return {
    ...(contextResult.data || {}),
    pending_tasks: tasksResult.data || [],
    whoop_trend: whoopTrendResult.data || []
  };
}

async function getChatContext(supabase: ReturnType<typeof createClient>, userId: string) {
  const [profileResult, tasksResult, whoopResult] = await Promise.all([
    supabase
      .from('user_profile')
      .select('name')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('todos')
      .select('title, priority, due_date')
      .eq('user_id', userId)
      .eq('is_completed', false)
      .order('priority', { ascending: false })
      .limit(3),
    supabase.rpc('get_recent_whoop_data', {
      p_user_id: userId,
      p_days: 1
    }),
  ]);

  return {
    profile_name: profileResult.data?.name || null,
    pending_tasks: tasksResult.data || [],
    whoop_today: Array.isArray(whoopResult.data) ? whoopResult.data[0] || null : whoopResult.data || null,
  };
}

async function generateDailySummary(
  supabase: ReturnType<typeof createClient>, 
  userId: string,
  context: Record<string, unknown>
) {
  const whoopToday = context.whoop_today as Record<string, number> | null;
  const pendingTasks = context.pending_tasks as Array<{ title: string; priority: number }>;
  const lastSession = context.last_session as Record<string, unknown> | null;
  
  // Generate insight based on data
  let insight = "";
  const recommendations: string[] = [];
  
  if (whoopToday) {
    const recovery = whoopToday.recovery;
    const sleepHours = whoopToday.sleep_hours;
    
    if (recovery < 50) {
      insight = "Tu recovery está bajo hoy. ";
      recommendations.push("Considera reducir la intensidad del día");
      recommendations.push("Prioriza solo 1-2 tareas críticas");
    } else if (recovery >= 80) {
      insight = "¡Recovery excelente! ";
      recommendations.push("Buen día para abordar tareas desafiantes");
      recommendations.push("Aprovecha la energía para proyectos importantes");
    }
    
    if (sleepHours && sleepHours < 7) {
      insight += `Dormiste ${sleepHours.toFixed(1)}h. `;
      recommendations.push("Intenta acostarte antes esta noche");
    }
  }
  
  if (pendingTasks && pendingTasks.length > 0) {
    const highPriority = pendingTasks.filter(t => t.priority >= 4);
    if (highPriority.length > 0) {
      insight += `Tienes ${highPriority.length} tareas de alta prioridad pendientes.`;
    }
  }
  
  // Calculate scores
  const productivityScore = pendingTasks ? Math.max(0, 100 - pendingTasks.length * 10) : 50;
  const wellbeingScore = whoopToday?.recovery || 50;
  
  // Store summary
  await supabase.from('potus_daily_summary').upsert({
    user_id: userId,
    summary_date: new Date().toISOString().split('T')[0],
    whoop_summary: whoopToday,
    tasks_summary: { pending: pendingTasks?.length || 0 },
    daily_insight: insight || "Día normal sin alertas especiales.",
    recommendations,
    productivity_score: productivityScore,
    wellbeing_score: wellbeingScore
  }, { onConflict: 'user_id,summary_date' });
  
  return {
    insight: insight || "Todo en orden para hoy.",
    recommendations,
    scores: { productivity: productivityScore, wellbeing: wellbeingScore }
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const token = authHeader.replace("Bearer ", "");
    const { action, message, messages, context: requestContext, user_id, platform, transport } = await req.json() as PotusRequest;

    let userId: string | null = null;

    if (token === supabaseKey && user_id) {
      userId = user_id;
    } else {
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);

      if (userError || !user) {
        throw new Error("Invalid user token");
      }

      userId = user.id;
    }

    if (!userId) {
      throw new Error("Missing user context");
    }

    if (action === "get_context") {
      const fullContext = await getFullContext(supabase, userId);
      return new Response(JSON.stringify({ 
        success: true, 
        context: fullContext 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "daily_summary") {
      const fullContext = await getFullContext(supabase, userId);
      const summary = await generateDailySummary(supabase, userId, fullContext);
      return new Response(JSON.stringify({ 
        success: true, 
        summary 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "route" && message) {
      const { specialist, confidence } = detectSpecialist(message);
      return new Response(JSON.stringify({ 
        success: true, 
        specialist,
        confidence,
        suggestion: specialist 
          ? `Esto parece ser tema de ${specialist}. ¿Quieres que te conecte?`
          : "Puedo ayudarte directamente o derivarte a un especialista."
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "chat" || action === "analyze") {
      const [chatContext, recentHistoryResult, whatsappContext] = await Promise.all([
        getChatContext(supabase, userId),
        messages && messages.length > 0
          ? Promise.resolve({ data: null })
          : supabase
              .from('conversation_history')
              .select('role, content, created_at')
              .eq('user_id', userId)
              .eq('agent_type', 'potus')
              .order('created_at', { ascending: false })
              .limit(12),
        message ? getWhatsAppContext(supabase, userId, message) : Promise.resolve(""),
      ]);

      const normalizedClientMessages = (messages || [])
        .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
        .slice(-10);

      const historyMessages = normalizedClientMessages.length > 0
        ? normalizedClientMessages
        : ((recentHistoryResult.data || []) as Array<{ role: string; content: string }>).reverse().map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          }));

      const systemPrompt = `Eres POTUS, el cerebro central del sistema JARVIS.

TU ROL:
- Visión holística de la vida del usuario
- Coordinador de especialistas (coach, nutrición, inglés, bosco)
- Detector de patrones y correlaciones entre datos
- Consejero estratégico de vida
- Puedes ejecutar acciones en el sistema

CONTEXTO RÁPIDO DEL USUARIO:
${JSON.stringify(chatContext, null, 2)}
${whatsappContext}

ESPECIALISTAS DISPONIBLES:
${SPECIALISTS.map(s => `- ${s.name}: ${s.description}`).join('\n')}

ACCIONES DISPONIBLES (tool-calling):
Puedes incluir acciones ejecutables en tu respuesta añadiendo un bloque JSON al final:
<!-- ACTIONS_START -->
[{"type":"create_task","params":{"title":"...","priority":3}},{"type":"navigate","params":{"route":"/dashboard"}},{"type":"mark_done","params":{"taskId":"..."}},{"type":"notify","params":{"message":"..."}}]
<!-- ACTIONS_END -->

Tipos de acción:
- create_task: crea una tarea (params: title, priority 1-5)
- navigate: navega a una ruta de la app (params: route)
- mark_done: marca tarea como completada (params: taskId)
- agent_command: comando a un agente (params: nodeId, command)
- notify: muestra notificación (params: message)

REGLAS:
1. Si detectas que una consulta es mejor para un especialista, dilo
2. Usa el contexto solo cuando aporte valor real
3. Mantén tono profesional pero cercano
4. Respuestas concisas (2-4 frases)
5. Prioriza responder rápido y claro
6. Si el usuario pide crear tareas, navegar, etc., incluye el bloque ACTIONS
7. Solo incluye acciones cuando sean explícitamente pedidas o claramente útiles

FORMATO:
Responde naturalmente. Si detectas necesidad de especialista, menciona:
"Esto es tema de [especialista]. ¿Quieres que profundicemos ahí?"`;

      const dedupedHistory = historyMessages.filter((msg, index, arr) => {
        const prev = arr[index - 1];
        return !(prev && prev.role === msg.role && prev.content === msg.content);
      });

      const allMessages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...dedupedHistory.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        ...(message ? [{ role: "user" as const, content: message }] : []),
      ];

      const rawResponse = await chat(allMessages, {
        model: "gemini-flash",
        temperature: 0.7,
      });

      // Parse actions from response
      let cleanResponse = rawResponse;
      let actions: Array<{type: string; params: Record<string, unknown>}> = [];
      const actionsMatch = rawResponse.match(/<!-- ACTIONS_START -->\s*([\s\S]*?)\s*<!-- ACTIONS_END -->/);
      if (actionsMatch) {
        try {
          actions = JSON.parse(actionsMatch[1]);
        } catch { /* ignore parse errors */ }
        cleanResponse = rawResponse.replace(/<!-- ACTIONS_START -->[\s\S]*?<!-- ACTIONS_END -->/, "").trim();
      }

      const routeCheck = message ? detectSpecialist(message) : { specialist: null, confidence: 0 };
      const conversation = await resolvePotusConversationContext(supabase, userId);
      const sourcePlatform = platform || "app";

      const writes: Promise<unknown>[] = [];

      if (message) {
        writes.push(
          supabase.from('conversation_history').insert({
            user_id: userId,
            role: 'user',
            content: message,
            agent_type: 'potus',
            metadata: buildPotusMessageMetadata({
              conversationKey: conversation.conversationKey,
              source: sourcePlatform === 'telegram' ? 'telegram' : 'app',
              transport: sourcePlatform,
              platformUserId: sourcePlatform === 'telegram' ? conversation.telegramUserId : null,
              extra: { channel: 'potus-core', direction: 'inbound', ...(transport || {}) },
            })
          })
        );
      }

      writes.push(
        supabase.from('conversation_history').insert({
          user_id: userId,
          role: 'assistant',
          content: cleanResponse,
          agent_type: 'potus',
          metadata: buildPotusMessageMetadata({
            conversationKey: conversation.conversationKey,
            source: sourcePlatform === 'telegram' ? 'telegram' : 'app',
            transport: sourcePlatform,
            platformUserId: sourcePlatform === 'telegram' ? conversation.telegramUserId : null,
            extra: { channel: 'potus-core', direction: 'outbound', model: 'gemini', hasActions: actions.length > 0 },
          })
        })
      );

      if (message && message.length > 20) {
        writes.push(
          supabase.from('specialist_memory').insert({
            user_id: userId,
            specialist: 'potus',
            memory_type: 'interaction',
            content: message.substring(0, 500),
            importance: 3
          })
        );
      }

      await Promise.allSettled(writes);

      return new Response(JSON.stringify({ 
        success: true, 
        message: cleanResponse,
        actions: actions.length > 0 ? actions : undefined,
        suggestedSpecialist: routeCheck.confidence > 0.5 ? routeCheck.specialist : null,
        context: {
          whoopToday: chatContext.whoop_today,
          pendingTasksCount: (chatContext.pending_tasks as unknown[])?.length || 0
        },
        conversationKey: conversation.conversationKey,
        surfaces: conversation.surfaces
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");

  } catch (error: unknown) {
    console.error("POTUS Core error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
