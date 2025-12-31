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
  type: string;
  priority: string;
  duration: number;
}

interface CalendarEvent {
  title: string;
  time: string;
  duration: string;
  type: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { checkIn, tasks, calendarEvents } = await req.json() as {
      checkIn: CheckInData;
      tasks: Task[];
      calendarEvents: CalendarEvent[];
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context for the AI
    const avgEnergy = checkIn.energy;
    const avgMood = checkIn.mood;
    const avgFocus = checkIn.focus;
    const capacityLevel = avgEnergy >= 7 ? "alta" : avgEnergy >= 4 ? "media" : "baja";
    
    const pendingTasks = tasks.filter(t => t.priority === "P0" || t.priority === "P1");
    const tasksSummary = pendingTasks.map(t => 
      `- ${t.title} (${t.type}, ${t.priority}, ${t.duration}min)`
    ).join("\n");

    const eventsSummary = calendarEvents.map(e => 
      `- ${e.time}: ${e.title} (${e.duration})`
    ).join("\n");

    const systemPrompt = `Eres JARVIS, un asistente de vida inteligente y coach personal. Tu rol es analizar el estado actual del usuario y crear un plan diario optimizado.

REGLAS FUNDAMENTALES:
1. NUNCA sobrecargues al usuario - respeta su energía y capacidad
2. Prioriza salud y familia sobre trabajo cuando la energía es baja
3. Sugiere pausas y descansos estratégicos
4. Adapta la intensidad del trabajo según el nivel de energía y enfoque
5. En días de alta interrupción (hospital, hijos, etc.), sugiere micro-tareas
6. Balance "Dual Track": equilibra trabajo y vida personal

FORMATO DE RESPUESTA (JSON):
{
  "greeting": "Saludo personalizado basado en el estado del usuario",
  "analysis": {
    "capacityLevel": "alta|media|baja",
    "recommendation": "Resumen de 1-2 líneas sobre el enfoque del día",
    "warnings": ["Lista de alertas si hay sobrecarga o riesgos"]
  },
  "timeBlocks": [
    {
      "time": "HH:MM",
      "endTime": "HH:MM",
      "title": "Nombre del bloque",
      "type": "work|health|life|family|rest",
      "description": "Descripción corta",
      "priority": "high|medium|low",
      "isFlexible": true/false
    }
  ],
  "tips": ["2-3 consejos personalizados para el día"],
  "eveningReflection": "Pregunta o reflexión para el cierre del día"
}`;

    const userPrompt = `ESTADO ACTUAL DEL USUARIO:
- Energía: ${avgEnergy}/10
- Ánimo: ${avgMood}/10
- Enfoque: ${avgFocus}/10
- Tiempo disponible: ${checkIn.availableTime} horas
- Riesgo de interrupciones: ${checkIn.interruptionRisk}
- Modo del día: ${checkIn.dayMode}

TAREAS PENDIENTES (${pendingTasks.length}):
${tasksSummary || "Sin tareas pendientes"}

EVENTOS DEL CALENDARIO:
${eventsSummary || "Sin eventos programados"}

HORA ACTUAL: ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}

Genera un plan diario optimizado considerando:
1. El nivel de capacidad actual (${capacityLevel})
2. Los eventos ya programados en el calendario
3. Las tareas pendientes por prioridad
4. Incluir pausas y tiempo para salud/vida personal
5. No programar trabajo intenso si la energía está baja
6. En riesgo alto de interrupciones, usar bloques cortos (15-30 min)`;

    console.log("Calling Lovable AI with check-in data:", { 
      energy: avgEnergy, 
      mood: avgMood, 
      focus: avgFocus,
      tasks: pendingTasks.length,
      events: calendarEvents.length
    });

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
          JSON.stringify({ error: "Límite de uso alcanzado. Intenta de nuevo en unos minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos agotados. Recarga tu cuenta para continuar." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    let plan;
    try {
      plan = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("Invalid AI response format");
    }

    console.log("Generated plan with", plan.timeBlocks?.length || 0, "time blocks");

    return new Response(
      JSON.stringify({ success: true, plan }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("JARVIS Core error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
