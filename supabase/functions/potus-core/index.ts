import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chat, ChatMessage } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PotusRequest {
  action: "chat" | "analyze" | "route" | "daily_summary" | "get_context";
  message?: string;
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  context?: Record<string, unknown>;
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
  // Use the helper function we created
  const { data: context } = await supabase.rpc('get_potus_context', { p_user_id: userId });
  
  // Get pending tasks
  const { data: tasks } = await supabase
    .from('todos')
    .select('title, priority, due_date, is_completed')
    .eq('user_id', userId)
    .eq('is_completed', false)
    .order('priority', { ascending: false })
    .limit(5);
  
  // Get recent WHOOP trend (7 days)
  const { data: whoopTrend } = await supabase.rpc('get_recent_whoop_data', { 
    p_user_id: userId, 
    p_days: 7 
  });
  
  return {
    ...context,
    pending_tasks: tasks || [],
    whoop_trend: whoopTrend || []
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
    
    // Get user from JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Invalid user token");
    }

    const { action, message, messages, context: requestContext, conversationHistory } = await req.json() as PotusRequest & { conversationHistory?: Array<{ role: string; content: string }> };

    // Get full context for this user
    const fullContext = await getFullContext(supabase, user.id);

    if (action === "get_context") {
      return new Response(JSON.stringify({ 
        success: true, 
        context: fullContext 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "daily_summary") {
      const summary = await generateDailySummary(supabase, user.id, fullContext);
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
      // POTUS as central brain
      const systemPrompt = `Eres POTUS, el cerebro central del sistema JARVIS.

TU ROL:
- Visión holística de la vida del usuario
- Coordinador de especialistas (coach, nutrición, inglés, bosco)
- Detector de patrones y correlaciones entre datos
- Consejero estratégico de vida

CONTEXTO DEL USUARIO:
${JSON.stringify(fullContext, null, 2)}

ESPECIALISTAS DISPONIBLES:
${SPECIALISTS.map(s => `- ${s.name}: ${s.description}`).join('\n')}

REGLAS:
1. Si detectas que una consulta es mejor para un especialista, dilo
2. Usa los datos WHOOP para contextualizar consejos
3. Recuerda insights de sesiones anteriores
4. Mantén tono profesional pero cercano
5. Respuestas concisas (2-4 frases)
6. Ofrece perspectiva integrada cuando sea útil

FORMATO:
Responde naturalmente. Si detectas necesidad de especialista, menciona:
"Esto es tema de [especialista]. ¿Quieres que profundicemos ahí?"`;

      const allMessages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        // Include conversation history from the app (recent context)
        ...(conversationHistory || []).map(m => ({ 
          role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant" | "system", 
          content: m.content 
        })),
        // Include any messages passed via the old format
        ...(messages || []).map(m => ({ role: m.role, content: m.content })),
        ...(message ? [{ role: "user" as const, content: message }] : [])
      ];

      const response = await chat(allMessages, {
        model: "gemini-flash",
        temperature: 0.7,
      });

      // Detect if we should route to specialist
      const routeCheck = message ? detectSpecialist(message) : { specialist: null, confidence: 0 };

      // Save interaction as memory if relevant
      if (message && message.length > 20) {
        await supabase.from('specialist_memory').insert({
          user_id: user.id,
          specialist: 'potus',
          memory_type: 'interaction',
          content: message.substring(0, 500),
          importance: 3
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: response,
        suggestedSpecialist: routeCheck.confidence > 0.5 ? routeCheck.specialist : null,
        context: {
          whoopToday: fullContext.whoop_today,
          pendingTasksCount: (fullContext.pending_tasks as unknown[])?.length || 0
        }
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
