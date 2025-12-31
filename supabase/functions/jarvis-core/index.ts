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

// Determinar modo del día según reglas IF/THEN
function determineDayMode(checkIn: CheckInData): { mode: string; reason: string } {
  // IF interruption_risk = high THEN survival mode
  if (checkIn.interruptionRisk === "high") {
    return { mode: "survival", reason: "Riesgo alto de interrupciones detectado" };
  }
  
  // IF energy <= 3 THEN survival mode
  if (checkIn.energy <= 3) {
    return { mode: "survival", reason: "Energía muy baja - priorizamos lo esencial" };
  }
  
  // IF energy <= 2 AND mood <= 2 THEN coach intervention needed
  if (checkIn.energy <= 2 && checkIn.mood <= 2) {
    return { mode: "recovery", reason: "Estado bajo detectado - día de recuperación" };
  }
  
  // IF energy >= 7 AND focus >= 7 THEN push mode
  if (checkIn.energy >= 7 && checkIn.focus >= 7) {
    return { mode: "push", reason: "Alta capacidad - aprovechamos para tareas exigentes" };
  }
  
  // Default: balanced
  return { mode: "balanced", reason: "Día equilibrado - balance trabajo/vida" };
}

// Generar acciones de secretaría basadas en reglas
function generateSecretaryActions(
  checkIn: CheckInData, 
  tasks: Task[], 
  calendarEvents: CalendarEvent[],
  dayMode: string
): string[] {
  const actions: string[] = [];
  
  // Calcular horas totales de eventos
  const totalEventHours = calendarEvents.reduce((sum, e) => {
    const match = e.duration.match(/(\d+)/);
    return sum + (match ? parseInt(match[1]) / 60 : 0);
  }, 0);
  
  // IF calendar overbooked (>9h) THEN propose replanification
  if (totalEventHours > 9) {
    actions.push("📅 Día sobrecargado (>9h). Propongo mover bloques no-P0 a mañana.");
  }
  
  // IF survival mode THEN add buffers
  if (dayMode === "survival") {
    actions.push("⚡ Modo supervivencia: añado buffers entre bloques y reduzco duración.");
  }
  
  // Check for P0 overdue tasks
  const p0Tasks = tasks.filter(t => t.priority === "P0");
  if (p0Tasks.length > 0) {
    actions.push(`🔴 ${p0Tasks.length} tarea(s) P0 pendiente(s): las priorizo en el plan.`);
  }
  
  // IF high interruption risk THEN use short blocks
  if (checkIn.interruptionRisk === "high") {
    actions.push("🚨 Riesgo alto: bloques cortos (25-30 min) con pausas.");
  }
  
  // Add buffer suggestion if available time > 6 hours
  if (checkIn.availableTime >= 6) {
    actions.push("🛡️ Añado buffer de contingencia para imprevistos.");
  }
  
  return actions;
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

    // Determinar modo del día con reglas IF/THEN
    const { mode: dayMode, reason: modeReason } = determineDayMode(checkIn);
    
    // Generar acciones proactivas de secretaría
    const secretaryActions = generateSecretaryActions(checkIn, tasks, calendarEvents, dayMode);

    // Build context
    const capacityLevel = checkIn.energy >= 7 ? "alta" : checkIn.energy >= 4 ? "media" : "baja";
    
    const pendingTasks = tasks.filter(t => t.priority === "P0" || t.priority === "P1");
    const tasksSummary = pendingTasks.map(t => 
      `- ${t.title} (${t.type}, ${t.priority}, ${t.duration}min)`
    ).join("\n");

    const eventsSummary = calendarEvents.map(e => 
      `- ${e.time}: ${e.title} (${e.duration})`
    ).join("\n");

    const systemPrompt = `Eres JARVIS CORE, el cerebro central de un sistema de productividad personal. Trabajas junto a JARVIS SECRETARÍA, que gestiona la agenda de forma proactiva.

🧠 ROL JARVIS CORE:
- Orquestas y decides prioridades diarias
- Controlas la carga cognitiva del usuario
- Aplicas reglas de decisión inteligentes
- Aprendes de patrones para mejorar

📅 ROL JARVIS SECRETARÍA (motor proactivo):
- Lee y modifica agenda
- Crea bloques de tiempo
- Detecta sobrecarga y replanifica
- Añade buffers y protege tiempo

REGLAS FUNDAMENTALES (IF/THEN):
1. IF riesgo_interrupción = alto THEN modo_supervivencia + bloques_cortos + buffers
2. IF energía <= 3 THEN reducir_objetivos + priorizar_P0 + descanso
3. IF energía >= 7 AND foco >= 7 THEN modo_empuje + tareas_exigentes
4. IF calendario_sobrecargado (>9h) THEN replanificar + mover_no_P0
5. IF tarea_P0_pendiente > 48h THEN alerta + bloqueo_urgente
6. SIEMPRE: proteger salud y familia sobre trabajo
7. SIEMPRE: balance "Dual Track" (trabajo vs vida)

FORMATO DE RESPUESTA (JSON ESTRICTO):
{
  "greeting": "Saludo personalizado y empático según estado",
  "diagnosis": {
    "currentState": "Descripción breve del estado actual",
    "dayMode": "${dayMode}",
    "modeReason": "${modeReason}",
    "capacityLevel": "alta|media|baja",
    "riskFactors": ["Lista de factores de riesgo detectados"],
    "opportunities": ["Oportunidades del día"]
  },
  "decisions": [
    {
      "rule": "Regla aplicada (ej: IF energy <= 3)",
      "action": "Acción tomada",
      "reason": "Por qué esta decisión"
    }
  ],
  "secretaryActions": ["Acciones automáticas de secretaría"],
  "timeBlocks": [
    {
      "time": "HH:MM",
      "endTime": "HH:MM", 
      "title": "Nombre del bloque",
      "type": "work|health|life|family|rest",
      "description": "Descripción breve",
      "priority": "high|medium|low",
      "isFlexible": true/false,
      "linkedTask": "ID de tarea vinculada o null"
    }
  ],
  "nextSteps": {
    "immediate": "Próxima acción inmediata (los próximos 30 min)",
    "today": "Objetivo principal del día",
    "evening": "Reflexión/cierre sugerido"
  },
  "tips": ["2-3 consejos personalizados"],
  "warnings": ["Alertas si hay riesgos"]
}

IMPORTANTE:
- En modo survival: máx 3 bloques de trabajo, duración ≤30 min
- En modo balanced: 4-5 bloques de trabajo, duración 45-60 min
- En modo push: hasta 6 bloques de trabajo, duración hasta 90 min
- Siempre incluir al menos 1 bloque de salud y 1 de vida/familia
- Los bloques deben respetar los eventos existentes del calendario`;

    const userPrompt = `📊 ESTADO ACTUAL DEL USUARIO:
- Energía: ${checkIn.energy}/10
- Ánimo: ${checkIn.mood}/10
- Enfoque: ${checkIn.focus}/10
- Tiempo disponible: ${checkIn.availableTime} horas
- Riesgo de interrupciones: ${checkIn.interruptionRisk}
- Modo sugerido: ${checkIn.dayMode}

📋 ANÁLISIS PREVIO DE SECRETARÍA:
- Modo del día determinado: ${dayMode} (${modeReason})
- Nivel de capacidad: ${capacityLevel}
- Acciones de secretaría:
${secretaryActions.map(a => `  ${a}`).join('\n')}

📝 TAREAS PENDIENTES (${pendingTasks.length}):
${tasksSummary || "Sin tareas pendientes"}

📅 EVENTOS DEL CALENDARIO:
${eventsSummary || "Sin eventos programados"}

⏰ HORA ACTUAL: ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}

Genera el plan diario aplicando:
1. Las reglas IF/THEN del sistema
2. El modo del día (${dayMode})
3. Las acciones de secretaría sugeridas
4. Balance dual-track (trabajo vs vida)
5. Protección de tiempo para salud/familia`;

    console.log("JARVIS CORE - Generating plan:", { 
      dayMode,
      modeReason,
      energy: checkIn.energy, 
      mood: checkIn.mood, 
      focus: checkIn.focus,
      tasks: pendingTasks.length,
      events: calendarEvents.length,
      secretaryActions: secretaryActions.length
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
      
      // Merge secretary actions from our rules with AI suggestions
      if (!plan.secretaryActions || plan.secretaryActions.length === 0) {
        plan.secretaryActions = secretaryActions;
      } else {
        // Combine both, removing duplicates
        const combined = [...secretaryActions, ...plan.secretaryActions];
        plan.secretaryActions = [...new Set(combined)];
      }
      
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("Invalid AI response format");
    }

    console.log("JARVIS CORE - Plan generated:", {
      dayMode: plan.diagnosis?.dayMode,
      timeBlocks: plan.timeBlocks?.length || 0,
      decisions: plan.decisions?.length || 0,
      secretaryActions: plan.secretaryActions?.length || 0
    });

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
