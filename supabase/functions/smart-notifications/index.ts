import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckInData {
  energy: number;
  mood: number;
  focus: number;
  availableTime: number;
  interruptionRisk: string;
  dayMode: string;
}

interface Task {
  id: string;
  title: string;
  priority: string;
  duration: number;
  completed: boolean;
}

interface CalendarEvent {
  title: string;
  time: string;
  duration: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { checkIn, tasks, calendarEvents, currentHour } = await req.json() as {
      checkIn: CheckInData | null;
      tasks: Task[];
      calendarEvents: CalendarEvent[];
      currentHour: number;
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Calculate metrics
    const p0Tasks = tasks.filter(t => t.priority === "P0" && !t.completed);
    const p1Tasks = tasks.filter(t => t.priority === "P1" && !t.completed);
    const pendingTasks = tasks.filter(t => !t.completed);
    const totalWorkload = pendingTasks.reduce((sum, t) => sum + t.duration, 0);
    
    // Count events in next 2 hours
    const upcomingEvents = calendarEvents.filter(e => {
      const [hour] = e.time.split(':').map(Number);
      return hour >= currentHour && hour <= currentHour + 2;
    });

    // Build context
    const context = {
      hasCheckIn: !!checkIn,
      energy: checkIn?.energy || 5,
      mood: checkIn?.mood || 5,
      focus: checkIn?.focus || 5,
      availableTime: checkIn?.availableTime || 8,
      interruptionRisk: checkIn?.interruptionRisk || 'low',
      dayMode: checkIn?.dayMode || 'balanced',
      p0Count: p0Tasks.length,
      p1Count: p1Tasks.length,
      totalPending: pendingTasks.length,
      totalWorkloadMinutes: totalWorkload,
      upcomingEventsCount: upcomingEvents.length,
      currentHour,
      isAfternoon: currentHour >= 14,
      isEvening: currentHour >= 18,
      isMorning: currentHour < 12,
    };

    const systemPrompt = `Eres JARVIS, un asistente de vida inteligente. Analiza el contexto del usuario y genera notificaciones inteligentes.

TIPOS DE NOTIFICACIONES:
1. "overload" - Alerta de sobrecarga (demasiado trabajo, baja energía, muchas reuniones)
2. "p0_urgent" - Tareas P0 pendientes que necesitan atención inmediata
3. "rest" - Oportunidades de descanso (buena energía usada, tarde/noche, merece pausa)
4. "health" - Recordatorios de salud (beber agua, estirarse, caminar)
5. "focus" - Consejos de enfoque (buen momento para deep work, evitar distracciones)
6. "motivation" - Mensajes motivacionales cuando la energía o ánimo están bajos

REGLAS:
- Máximo 3 notificaciones más relevantes
- Prioriza alertas críticas (sobrecarga, P0) sobre consejos generales
- Si energía < 4, sugiere descanso o tareas ligeras
- Si hay P0 pendientes, siempre incluir alerta
- Por la tarde (14+), recordar pausas
- Por la noche (18+), sugerir cierre del día
- Sé específico y accionable, no genérico

FORMATO JSON:
{
  "notifications": [
    {
      "type": "overload|p0_urgent|rest|health|focus|motivation",
      "title": "Título corto (máx 6 palabras)",
      "message": "Mensaje explicativo (máx 20 palabras)",
      "priority": "high|medium|low",
      "actionLabel": "Texto del botón de acción (opcional)",
      "actionType": "navigate_tasks|navigate_calendar|dismiss|start_break"
    }
  ]
}`;

    const userPrompt = `CONTEXTO ACTUAL:
- Check-in realizado: ${context.hasCheckIn ? 'Sí' : 'No'}
- Energía: ${context.energy}/10
- Ánimo: ${context.mood}/10
- Enfoque: ${context.focus}/10
- Tiempo disponible: ${context.availableTime}h
- Riesgo interrupciones: ${context.interruptionRisk}
- Modo del día: ${context.dayMode}

TAREAS:
- P0 pendientes: ${context.p0Count}
- P1 pendientes: ${context.p1Count}
- Total pendientes: ${context.totalPending}
- Carga total: ${context.totalWorkloadMinutes} minutos

CALENDARIO:
- Eventos próximas 2h: ${context.upcomingEventsCount}

MOMENTO DEL DÍA:
- Hora actual: ${context.currentHour}:00
- Es mañana: ${context.isMorning}
- Es tarde: ${context.isAfternoon}
- Es noche: ${context.isEvening}

Genera las notificaciones más relevantes para este momento.`;

    console.log("Generating smart notifications with context:", context);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ notifications: [], error: "Rate limit" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ notifications: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ notifications: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generated", result.notifications?.length || 0, "notifications");

    return new Response(
      JSON.stringify({ notifications: result.notifications || [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Smart notifications error:", error);
    return new Response(
      JSON.stringify({ notifications: [], error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
