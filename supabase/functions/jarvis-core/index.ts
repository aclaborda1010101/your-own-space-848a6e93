import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  endTime?: string;
  duration: string;
  type: string;
  isFixed?: boolean;
}

// Calculate end time from start time and duration
function calculateEventEndTime(startTime: string, duration: string): string {
  // Parse start time (HH:MM format)
  const [hours, minutes] = startTime.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return startTime;
  
  // Parse duration (could be "30", "30 min", "1h", "1h 30min", etc.)
  let durationMinutes = 0;
  const hourMatch = duration.match(/(\d+)\s*h/i);
  const minMatch = duration.match(/(\d+)\s*(?:min|m(?!in)|$)/i);
  
  if (hourMatch) durationMinutes += parseInt(hourMatch[1]) * 60;
  if (minMatch) durationMinutes += parseInt(minMatch[1]);
  if (!hourMatch && !minMatch) {
    // Try to parse as plain number (assume minutes)
    const plainNum = parseInt(duration);
    if (!isNaN(plainNum)) durationMinutes = plainNum;
  }
  
  if (durationMinutes === 0) return startTime;
  
  // Calculate end time
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
}

// Calculate free time slots between calendar events
function calculateFreeSlots(events: CalendarEvent[], startHour: number = 6, endHour: number = 22): string {
  if (events.length === 0) {
    return `Libre: ${startHour.toString().padStart(2, '0')}:00 - ${endHour.toString().padStart(2, '0')}:00 (${endHour - startHour}h disponibles)`;
  }
  
  // Filter events with valid times and sort by start time
  const sortedEvents = events
    .filter(e => e.time && e.time !== 'flexible' && e.time.includes(':'))
    .map(e => ({
      start: e.time,
      end: e.endTime || calculateEventEndTime(e.time, e.duration),
      title: e.title
    }))
    .sort((a, b) => a.start.localeCompare(b.start));
  
  if (sortedEvents.length === 0) {
    return `Libre: ${startHour.toString().padStart(2, '0')}:00 - ${endHour.toString().padStart(2, '0')}:00 (${endHour - startHour}h disponibles)`;
  }
  
  const slots: string[] = [];
  let currentTime = `${startHour.toString().padStart(2, '0')}:00`;
  
  for (const event of sortedEvents) {
    if (event.start > currentTime) {
      const gapMinutes = timeToMinutes(event.start) - timeToMinutes(currentTime);
      if (gapMinutes >= 30) {
        slots.push(`${currentTime} - ${event.start} (${formatDuration(gapMinutes)})`);
      }
    }
    if (event.end > currentTime) {
      currentTime = event.end;
    }
  }
  
  // Check for gap after last event
  const endTimeStr = `${endHour.toString().padStart(2, '0')}:00`;
  if (currentTime < endTimeStr) {
    const gapMinutes = timeToMinutes(endTimeStr) - timeToMinutes(currentTime);
    if (gapMinutes >= 30) {
      slots.push(`${currentTime} - ${endTimeStr} (${formatDuration(gapMinutes)})`);
    }
  }
  
  if (slots.length === 0) {
    return "Sin huecos disponibles de más de 30 minutos";
  }
  
  return `Huecos libres:\n${slots.map(s => `  • ${s}`).join('\n')}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

interface UserProfile {
  name: string | null;
  vital_role: string | null;
  current_context: string | null;
  cognitive_style: string | null;
  personal_principles: string[];
  life_goals: string[];
  professional_goals: string[];
  family_context: Record<string, string>;
  health_profile: Record<string, string>;
  food_preferences: Record<string, string>;
  food_dislikes: string[];
  best_focus_time: string;
  fatigue_time: string;
  needs_buffers: boolean;
  communication_style: Record<string, string>;
  personal_rules: string[];
  auto_decisions: string[];
  require_confirmation: string[];
}

// Determinar modo del día según reglas IF/THEN
function determineDayMode(checkIn: CheckInData): { mode: string; reason: string } {
  if (checkIn.interruptionRisk === "high") {
    return { mode: "survival", reason: "Riesgo alto de interrupciones detectado" };
  }
  
  if (checkIn.energy <= 3) {
    return { mode: "survival", reason: "Energía muy baja - priorizamos lo esencial" };
  }
  
  if (checkIn.energy <= 2 && checkIn.mood <= 2) {
    return { mode: "recovery", reason: "Estado bajo detectado - día de recuperación" };
  }
  
  if (checkIn.energy >= 7 && checkIn.focus >= 7) {
    return { mode: "push", reason: "Alta capacidad - aprovechamos para tareas exigentes" };
  }
  
  return { mode: "balanced", reason: "Día equilibrado - balance trabajo/vida" };
}

// Generar acciones de secretaría basadas en reglas
function generateSecretaryActions(
  checkIn: CheckInData, 
  tasks: Task[], 
  calendarEvents: CalendarEvent[],
  dayMode: string,
  profile: UserProfile | null
): string[] {
  const actions: string[] = [];
  
  const totalEventHours = calendarEvents.reduce((sum, e) => {
    const match = e.duration.match(/(\d+)/);
    return sum + (match ? parseInt(match[1]) / 60 : 0);
  }, 0);
  
  if (totalEventHours > 9) {
    actions.push("📅 Día sobrecargado (>9h). Propongo mover bloques no-P0 a mañana.");
  }
  
  if (dayMode === "survival") {
    actions.push("⚡ Modo supervivencia: añado descansos entre bloques y reduzco duración.");
  }
  
  const p0Tasks = tasks.filter(t => t.priority === "P0");
  if (p0Tasks.length > 0) {
    actions.push(`🔴 ${p0Tasks.length} tarea(s) P0 pendiente(s): las priorizo en el plan.`);
  }
  
  if (checkIn.interruptionRisk === "high") {
    actions.push("🚨 Riesgo alto: bloques cortos (25-30 min) con pausas.");
  }
  
  if (checkIn.availableTime >= 6 && (profile?.needs_buffers !== false)) {
    actions.push("🛡️ Añado descanso de contingencia para imprevistos.");
  }

  // Profile-based actions
  if (profile) {
    if (profile.personal_rules && profile.personal_rules.length > 0) {
      const maxPrioritiesRule = profile.personal_rules.find(r => 
        r.toLowerCase().includes("prioridades") || r.toLowerCase().includes("priorities")
      );
      if (maxPrioritiesRule) {
        actions.push(`📋 Regla personal activa: "${maxPrioritiesRule}"`);
      }
    }

    if (profile.family_context && profile.family_context.priorities) {
      actions.push(`👨‍👩‍👦 Protegiendo tiempo familiar: ${profile.family_context.priorities}`);
    }
  }
  
  return actions;
}

// Build profile context for AI
function buildProfileContext(profile: UserProfile | null): string {
  if (!profile) {
    return "No hay perfil de usuario configurado. Usar configuración por defecto.";
  }

  const sections: string[] = [];

  if (profile.name) {
    sections.push(`👤 USUARIO: ${profile.name}`);
  }

  if (profile.vital_role) {
    sections.push(`🎯 ROL: ${profile.vital_role}`);
  }

  if (profile.current_context) {
    sections.push(`📍 CONTEXTO ACTUAL: ${profile.current_context}`);
  }

  if (profile.cognitive_style) {
    sections.push(`🧠 ESTILO COGNITIVO: ${profile.cognitive_style}`);
  }

  if (profile.personal_principles && profile.personal_principles.length > 0) {
    sections.push(`💎 PRINCIPIOS: ${profile.personal_principles.join(", ")}`);
  }

  if (profile.life_goals && profile.life_goals.length > 0) {
    sections.push(`🌟 OBJETIVOS VITALES: ${profile.life_goals.join(", ")}`);
  }

  if (profile.professional_goals && profile.professional_goals.length > 0) {
    sections.push(`💼 OBJETIVOS PROFESIONALES: ${profile.professional_goals.join(", ")}`);
  }

  if (profile.family_context) {
    const familyInfo = Object.entries(profile.family_context)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    if (familyInfo) {
      sections.push(`👨‍👩‍👦 FAMILIA: ${familyInfo}`);
    }
  }

  if (profile.health_profile) {
    const healthInfo = Object.entries(profile.health_profile)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    if (healthInfo) {
      sections.push(`❤️ SALUD: ${healthInfo}`);
    }
  }

  if (profile.best_focus_time) {
    const focusMap: Record<string, string> = {
      early_morning: "muy temprano (5-7h)",
      morning: "mañana (8-12h)",
      midday: "mediodía (12-14h)",
      afternoon: "tarde (15-18h)",
      evening: "noche (19-22h)",
      night: "noche tardía (22h+)"
    };
    sections.push(`⏰ MEJOR FOCO: ${focusMap[profile.best_focus_time] || profile.best_focus_time}`);
  }

  if (profile.fatigue_time) {
    const fatigueMap: Record<string, string> = {
      early_morning: "muy temprano",
      morning: "mañana",
      midday: "mediodía",
      afternoon: "tarde",
      evening: "noche",
      night: "noche tardía"
    };
    sections.push(`😴 FATIGA: ${fatigueMap[profile.fatigue_time] || profile.fatigue_time}`);
  }

  if (profile.needs_buffers) {
    sections.push(`🛡️ BUFFERS: Necesita tiempo entre tareas`);
  }

  if (profile.communication_style) {
    const commInfo = Object.entries(profile.communication_style)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    if (commInfo) {
      sections.push(`💬 COMUNICACIÓN: ${commInfo}`);
    }
  }

  if (profile.personal_rules && profile.personal_rules.length > 0) {
    sections.push(`📜 REGLAS PERSONALES:\n${profile.personal_rules.map(r => `  - ${r}`).join("\n")}`);
  }

  if (profile.auto_decisions && profile.auto_decisions.length > 0) {
    sections.push(`✅ PUEDO DECIDIR AUTOMÁTICAMENTE: ${profile.auto_decisions.join(", ")}`);
  }

  if (profile.require_confirmation && profile.require_confirmation.length > 0) {
    sections.push(`⚠️ REQUIERE CONFIRMACIÓN: ${profile.require_confirmation.join(", ")}`);
  }

  if (profile.food_dislikes && profile.food_dislikes.length > 0) {
    sections.push(`🚫 EVITAR EN COMIDAS: ${profile.food_dislikes.join(", ")}`);
  }

  return sections.join("\n");
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

    // Get user profile from database
    let userProfile: UserProfile | null = null;
    const authHeader = req.headers.get("Authorization");
    
    if (authHeader) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const token = authHeader.replace("Bearer ", "");
        
        const { data: { user } } = await supabase.auth.getUser(token);
        
        if (user) {
          const { data: profile } = await supabase
            .from("user_profile")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle();
          
          if (profile) {
            userProfile = {
              name: profile.name,
              vital_role: profile.vital_role,
              current_context: profile.current_context,
              cognitive_style: profile.cognitive_style,
              personal_principles: Array.isArray(profile.personal_principles) ? profile.personal_principles : [],
              life_goals: Array.isArray(profile.life_goals) ? profile.life_goals : [],
              professional_goals: Array.isArray(profile.professional_goals) ? profile.professional_goals : [],
              family_context: typeof profile.family_context === 'object' && !Array.isArray(profile.family_context) ? profile.family_context : {},
              health_profile: typeof profile.health_profile === 'object' && !Array.isArray(profile.health_profile) ? profile.health_profile : {},
              food_preferences: typeof profile.food_preferences === 'object' && !Array.isArray(profile.food_preferences) ? profile.food_preferences : {},
              food_dislikes: Array.isArray(profile.food_dislikes) ? profile.food_dislikes : [],
              best_focus_time: profile.best_focus_time || "morning",
              fatigue_time: profile.fatigue_time || "afternoon",
              needs_buffers: profile.needs_buffers ?? true,
              communication_style: typeof profile.communication_style === 'object' && !Array.isArray(profile.communication_style) ? profile.communication_style : {},
              personal_rules: Array.isArray(profile.personal_rules) ? profile.personal_rules : [],
              auto_decisions: Array.isArray(profile.auto_decisions) ? profile.auto_decisions : [],
              require_confirmation: Array.isArray(profile.require_confirmation) ? profile.require_confirmation : [],
            };
          }
        }
      }
    }

    const { mode: dayMode, reason: modeReason } = determineDayMode(checkIn);
    const secretaryActions = generateSecretaryActions(checkIn, tasks, calendarEvents, dayMode, userProfile);
    const profileContext = buildProfileContext(userProfile);

    const capacityLevel = checkIn.energy >= 7 ? "alta" : checkIn.energy >= 4 ? "media" : "baja";
    
    const pendingTasks = tasks.filter(t => t.priority === "P0" || t.priority === "P1");
    const tasksSummary = pendingTasks.map(t => 
      `- ${t.title} (${t.type}, ${t.priority}, ${t.duration}min)`
    ).join("\n");

    const eventsSummary = calendarEvents
      .filter(e => e.time && e.time !== 'flexible')
      .map(e => {
        const endTime = e.endTime || calculateEventEndTime(e.time, e.duration);
        const fixedLabel = e.isFixed ? ' [BLOQUEADO - NO MODIFICAR]' : '';
        return `- ${e.time} - ${endTime}: ${e.title} (${e.duration})${fixedLabel}`;
      }).join("\n");
    
    const freeSlotsSummary = calculateFreeSlots(calendarEvents.filter(e => e.isFixed !== false));

    const systemPrompt = `Eres JARVIS CORE, el cerebro central de un sistema de productividad personal para ${userProfile?.name || "el usuario"}.

🧠 CONOCIMIENTO DEL USUARIO:
${profileContext}

🧠 ROL JARVIS CORE:
- Orquestas y decides prioridades diarias
- Controlas la carga cognitiva del usuario
- Aplicas reglas de decisión inteligentes basadas en el perfil
- Aprendes de patrones para mejorar
- RESPETAS las reglas personales y límites del usuario

📅 ROL JARVIS SECRETARÍA (motor proactivo):
- Lee y modifica agenda
- Crea bloques de tiempo
- Detecta sobrecarga y replanifica
- Añade descansos y protege tiempo

REGLAS FUNDAMENTALES (IF/THEN):
1. IF riesgo_interrupción = alto THEN modo_supervivencia + bloques_cortos + descansos
2. IF energía <= 3 THEN reducir_objetivos + priorizar_P0 + descanso
3. IF energía >= 7 AND foco >= 7 THEN modo_empuje + tareas_exigentes
4. IF calendario_sobrecargado (>9h) THEN replanificar + mover_no_P0
5. IF tarea_P0_pendiente > 48h THEN alerta + bloqueo_urgente
6. SIEMPRE: proteger salud y familia sobre trabajo
7. SIEMPRE: balance "Dual Track" (trabajo vs vida)
8. SIEMPRE: respetar las REGLAS PERSONALES del perfil
9. NUNCA: tomar decisiones que requieren confirmación sin avisar

FORMATO DE RESPUESTA (JSON ESTRICTO):
{
  "greeting": "Saludo personalizado usando el nombre del usuario si está disponible",
  "diagnosis": {
    "currentState": "Descripción breve del estado actual",
    "dayMode": "${dayMode}",
    "modeReason": "${modeReason}",
    "capacityLevel": "alta|media|baja",
    "riskFactors": ["Lista de factores de riesgo detectados"],
    "opportunities": ["Oportunidades del día basadas en los objetivos del perfil"]
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
    "today": "Objetivo principal del día alineado con objetivos del perfil",
    "evening": "Reflexión/cierre sugerido"
  },
  "tips": ["2-3 consejos personalizados basados en el perfil"],
  "warnings": ["Alertas si hay riesgos o se violan reglas personales"]
}

REGLAS DE SOLAPAMIENTO (CRÍTICO):
- ⛔ PROHIBIDO: Crear bloques que se solapen con eventos existentes del calendario
- Los eventos marcados como [BLOQUEADO] son INAMOVIBLES y no puedes programar nada encima
- PRIMERO identifica los huecos libres, LUEGO programa los bloques en esos huecos
- Si un hueco es menor a 30 minutos, solo programa descanso breve, NO trabajo
- Si no hay suficiente tiempo para todas las tareas P0, incluye una advertencia en "warnings"

IMPORTANTE:
- En modo survival: máx 3 bloques de trabajo, duración ≤30 min
- En modo balanced: 4-5 bloques de trabajo, duración 45-60 min
- En modo push: hasta 6 bloques de trabajo, duración hasta 90 min
- Siempre incluir al menos 1 bloque de salud y 1 de vida/familia
- ${userProfile?.needs_buffers ? "INCLUIR descansos entre bloques (usuario lo necesita)" : "Bloques pueden ser consecutivos"}
- Programar trabajo cognitivo en: ${userProfile?.best_focus_time || "mañana"}
- Evitar tareas exigentes en: ${userProfile?.fatigue_time || "tarde"}`;

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

📅 EVENTOS DEL CALENDARIO (BLOQUEADOS - NO SOLAPAR):
${eventsSummary || "Sin eventos programados"}

⏳ ANÁLISIS DE DISPONIBILIDAD:
${freeSlotsSummary}

⏰ HORA ACTUAL: ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}

Genera el plan diario aplicando:
1. Las reglas IF/THEN del sistema
2. El modo del día (${dayMode})
3. Las acciones de secretaría sugeridas
4. Balance dual-track (trabajo vs vida)
5. Protección de tiempo para salud/familia
6. Las preferencias y reglas del perfil del usuario`;

    console.log("JARVIS CORE - Generating plan:", { 
      dayMode,
      modeReason,
      energy: checkIn.energy, 
      mood: checkIn.mood, 
      focus: checkIn.focus,
      tasks: pendingTasks.length,
      events: calendarEvents.length,
      secretaryActions: secretaryActions.length,
      hasProfile: !!userProfile,
      userName: userProfile?.name
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
      
      if (!plan.secretaryActions || plan.secretaryActions.length === 0) {
        plan.secretaryActions = secretaryActions;
      } else {
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
