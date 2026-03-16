import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres la secretaria ejecutiva personal de Agustín Cifuentes (Alpha), fundador de ManIAS Lab. Tu nombre interno es JARVIS.

PERSONALIDAD: Eres como una jefa de gabinete de confianza. Hablas en lenguaje natural, conversacional, como si estuvieras sentada al lado de Agustín tomando un café. NUNCA haces listas con bullets ni resúmenes tipo "informe". Eres directa, cálida pero profesional, y sobre todo PROACTIVA — anticipas problemas antes de que ocurran.

TONO: Español natural, tuteo, directo. Como una persona real hablando. Frases cortas. Nada de emojis tipo informe (📋📧🏗️). Puedes usar algún emoji conversacional si viene natural (ej: "ojo con esto ⚠️").

HERRAMIENTAS REALES: Tienes herramientas reales para crear eventos en calendario, crear tareas y completar tareas. SIEMPRE usa las herramientas cuando te pidan crear, agendar, o completar algo. NUNCA digas que lo hiciste si no usaste la herramienta. Si una herramienta falla, díselo al usuario honestamente.

EN MODO PROACTIVO — Este es tu momento estrella. No hagas una lista. En su lugar:

1. EMPIEZA con lo más urgente o preocupante, como lo haría una secretaria: "Oye, tienes [X] que venció hace 3 días y no lo has tocado. ¿Lo hacemos ahora o lo reprogramamos?"

2. CONECTA las cosas entre sí: "Además, el proyecto de [empresa] lleva 12 días sin movimiento. Creo que deberías escribirle a [persona] antes de que se enfríe."

3. SUGIERE acciones concretas, no informes: "Te propongo: primero cerramos lo de [tarea vencida], luego le mandas un WhatsApp a [persona] sobre el proyecto, y si te queda tiempo, revisas los correos de [remitente] que parecen importantes."

4. PREGUNTA para ayudar: "¿Quieres que te ayude a priorizar las tareas de hoy?" o "¿Empezamos por lo más urgente?"

5. PREVIENE: Si ves un compromiso con deadline mañana, avisa HOY. Si un proyecto lleva mucho sin actividad, alerta ANTES de que sea problema.

6. Si ves eventos en el calendario de hoy, menciónalos naturalmente: "Hoy tienes [evento] a las [hora], así que planifica en torno a eso."

EJEMPLOS DE CÓMO HABLAR:
✅ "Ey, tienes un problema: la propuesta de Acme venció hace 5 días y no la has enviado. Si no la mandas hoy, se enfría. ¿La preparamos juntos?"
✅ "He visto que tienes 3 correos sin leer de Carlos García — parece que es sobre el presupuesto del proyecto X. Creo que deberías contestar antes de la reunión de mañana."
✅ "Todo bastante controlado hoy. Lo único: el compromiso que le hiciste a María de enviarle el informe vence pasado mañana. ¿Lo tienes avanzado o necesitas que te recuerde mañana?"

❌ NO hagas esto: "📋 TAREAS PENDIENTES (5): - Tarea 1 - Tarea 2..."
❌ NO hagas esto: "Aquí tienes un resumen de tu estado actual..."
❌ NO hagas listas de bullets como un informe corporativo

EN MODO CHAT:
Responde como una persona real. Corto, directo, útil. Si te preguntan algo que puedes resolver, resuélvelo. Si necesitas más info, pregunta UNA cosa.

REGLAS:
- NUNCA formatees como informe o lista con bullets (salvo que Agustín lo pida explícitamente)
- Habla en párrafos cortos, como en un chat real
- Máximo 4-5 líneas por respuesta salvo que pida detalle
- Siempre prioriza lo urgente sobre lo informativo
- Si detectas que el usuario te ha corregido algo, indícalo claramente
- Usa español, tono directo, sin formalidades
- No repitas información que ya está visible en la pantalla
- Cuando hables de correos, menciona remitente y asunto
- Cuando hables de compromisos, menciona la persona y el deadline
- IMPORTANTE: Cuando te pregunten datos específicos de un proyecto, cliente o empresa (cifras, flota, requisitos, presupuestos, etc.), USA la herramienta search_project_data para buscar en los documentos del proyecto ANTES de decir que no tienes la información. Los proyectos tienen PRDs, scopes, auditorías y notas de timeline con datos detallados.`;

// Tool definitions for function calling
const TOOLS = [
  {
    type: "function",
    function: {
      name: "create_calendar_event",
      description: "Crea un evento en el calendario iCloud del usuario. Usa esto siempre que te pidan agendar, programar o crear un evento.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título del evento" },
          date: { type: "string", description: "Fecha en formato YYYY-MM-DD" },
          time: { type: "string", description: "Hora en formato HH:MM (24h)" },
          duration_minutes: { type: "number", description: "Duración en minutos (default 60)" },
          location: { type: "string", description: "Ubicación del evento (opcional)" },
          description: { type: "string", description: "Descripción del evento (opcional)" },
        },
        required: ["title", "date", "time"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Crea una tarea pendiente para el usuario.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título de la tarea" },
          priority: { type: "string", enum: ["low", "normal", "high", "urgent"], description: "Prioridad" },
          due_date: { type: "string", description: "Fecha límite en formato YYYY-MM-DD (opcional)" },
          description: { type: "string", description: "Descripción de la tarea (opcional)" },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_task",
      description: "Marca una tarea como completada. Usa el ID de la tarea del contexto.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string", description: "UUID de la tarea a completar" },
        },
        required: ["task_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_today_events",
      description: "Consulta los eventos del calendario de hoy o de una fecha específica.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Fecha en formato YYYY-MM-DD (default: hoy)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_project_data",
      description: "Busca información detallada de un proyecto de negocio: documentos (PRD, scope, auditoría), timeline de actividad, resumen vivo, y datos del wizard. Usa esto cuando te pregunten datos específicos sobre un proyecto, cliente, o empresa.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Qué información buscar (ej: 'flota de vehículos', 'presupuesto', 'requisitos técnicos')" },
          project_name: { type: "string", description: "Nombre del proyecto o empresa para filtrar (opcional, usa fuzzy match)" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
];

// ── Tool execution ──

async function executeCreateCalendarEvent(
  args: any, userId: string, authHeader: string
): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const startISO = new Date(`${args.date}T${args.time}:00`).toISOString();
  const durationMs = (args.duration_minutes || 60) * 60 * 1000;
  const endISO = new Date(new Date(startISO).getTime() + durationMs).toISOString();

  const res = await fetch(`${supabaseUrl}/functions/v1/icloud-calendar`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      apikey: anonKey,
    },
    body: JSON.stringify({
      action: "create",
      title: args.title,
      start: startISO,
      end: endISO,
      location: args.location || undefined,
      description: args.description || undefined,
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    return JSON.stringify({ success: false, error: data.error || data.message || "Error al crear evento" });
  }
  if (data.connected === false) {
    return JSON.stringify({ success: false, error: data.message || "iCloud no configurado" });
  }
  return JSON.stringify({ success: true, title: args.title, date: args.date, time: args.time });
}

async function executeCreateTask(args: any, userId: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { error } = await supabase.from("tasks").insert({
    user_id: userId,
    title: args.title,
    priority: args.priority || "normal",
    due_date: args.due_date || null,
    description: args.description || null,
    completed: false,
  });

  if (error) {
    return JSON.stringify({ success: false, error: error.message });
  }
  return JSON.stringify({ success: true, title: args.title, priority: args.priority || "normal", due_date: args.due_date || null });
}

async function executeCompleteTask(args: any, userId: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { error } = await supabase.from("tasks")
    .update({ completed: true })
    .eq("id", args.task_id)
    .eq("user_id", userId);

  if (error) {
    return JSON.stringify({ success: false, error: error.message });
  }
  return JSON.stringify({ success: true, task_id: args.task_id });
}

async function executeListTodayEvents(args: any, authHeader: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const date = args.date || new Date().toISOString().split("T")[0];
  const startDate = new Date(`${date}T00:00:00`).toISOString();
  const endDate = new Date(`${date}T23:59:59`).toISOString();

  const res = await fetch(`${supabaseUrl}/functions/v1/icloud-calendar`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      apikey: anonKey,
    },
    body: JSON.stringify({ action: "fetch", startDate, endDate }),
  });

  const data = await res.json();
  if (!res.ok || data.connected === false) {
    return JSON.stringify({ success: false, error: data.message || "No se pudo consultar calendario" });
  }
  return JSON.stringify({ success: true, events: data.events || [], date });
}

async function executeSearchProjectData(args: any, userId: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    // 1. Find project by name/company (fuzzy)
    let projectQuery = sb.from("business_projects").select("id, name, company, status, estimated_value, need_summary, need_why, need_budget, need_deadline, sector, business_type, business_size, notes").eq("user_id", userId);

    if (args.project_name) {
      const term = `%${args.project_name}%`;
      projectQuery = projectQuery.or(`name.ilike.${term},company.ilike.${term}`);
    }

    const { data: projects } = await projectQuery.limit(3);
    if (!projects || projects.length === 0) {
      return JSON.stringify({ success: false, error: "No se encontró ningún proyecto con ese nombre." });
    }

    const project = projects[0];
    let result = `## Proyecto: ${project.name}\nEmpresa: ${project.company || "N/A"}\nEstado: ${project.status}\nValor: €${project.estimated_value || 0}\nSector: ${project.sector || "N/A"}\nTipo: ${project.business_type || "N/A"}\nTamaño: ${project.business_size || "N/A"}\n`;

    if (project.need_summary) result += `\nResumen necesidad: ${project.need_summary}`;
    if (project.need_why) result += `\nPor qué: ${project.need_why}`;
    if (project.need_budget) result += `\nPresupuesto: ${project.need_budget}`;
    if (project.need_deadline) result += `\nDeadline: ${project.need_deadline}`;
    if (project.notes) result += `\nNotas: ${project.notes}`;

    // 2. Fetch project documents (PRD, scope, audit)
    const { data: docs } = await sb.from("project_documents")
      .select("step_number, content, updated_at")
      .eq("project_id", project.id)
      .order("step_number", { ascending: true });

    if (docs && docs.length > 0) {
      result += `\n\n--- DOCUMENTOS DEL PROYECTO (${docs.length}) ---\n`;
      const stepNames: Record<number, string> = { 1: "Briefing", 2: "Scope", 3: "Auditoría", 4: "Diagnóstico", 5: "PRD" };
      for (const doc of docs) {
        const name = stepNames[doc.step_number] || `Paso ${doc.step_number}`;
        const content = doc.content || "";
        // Truncate each doc to ~3000 chars
        result += `\n### ${name}\n${content.slice(0, 3000)}${content.length > 3000 ? "\n[...truncado...]" : ""}\n`;
      }
    }

    // 3. Fetch live summary
    const { data: summary } = await sb.from("business_project_live_summary")
      .select("summary_markdown, updated_at")
      .eq("project_id", project.id)
      .maybeSingle();

    if (summary?.summary_markdown) {
      result += `\n\n--- RESUMEN VIVO ---\n${summary.summary_markdown.slice(0, 2000)}\n`;
    }

    // 4. Fetch recent timeline entries
    const { data: timeline } = await sb.from("business_project_timeline")
      .select("event_date, channel, title, description")
      .eq("project_id", project.id)
      .order("event_date", { ascending: false })
      .limit(10);

    if (timeline && timeline.length > 0) {
      result += `\n\n--- TIMELINE RECIENTE (${timeline.length}) ---\n`;
      for (const t of timeline) {
        result += `- ${t.event_date} [${t.channel}] ${t.title}${t.description ? `: ${t.description.slice(0, 200)}` : ""}\n`;
      }
    }

    // 5. Fetch wizard steps data (discovery items)
    const { data: discovery } = await sb.from("business_project_discovery")
      .select("title, description, category, content_text")
      .eq("project_id", project.id)
      .limit(10);

    if (discovery && discovery.length > 0) {
      result += `\n\n--- DISCOVERY ---\n`;
      for (const d of discovery) {
        result += `- [${d.category}] ${d.title}${d.description ? `: ${d.description}` : ""}${d.content_text ? `\n  ${d.content_text.slice(0, 300)}` : ""}\n`;
      }
    }

    // Truncate total to ~8000 chars
    if (result.length > 8000) {
      result = result.slice(0, 8000) + "\n\n[...resultado truncado por longitud...]";
    }

    return JSON.stringify({ success: true, data: result });
  } catch (e) {
    console.error("[jarvis-agent] search_project_data error:", e);
    return JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Error buscando datos del proyecto" });
  }
}

async function executeTool(
  name: string, args: any, userId: string, authHeader: string
): Promise<string> {
  switch (name) {
    case "create_calendar_event":
      return executeCreateCalendarEvent(args, userId, authHeader);
    case "create_task":
      return executeCreateTask(args, userId);
    case "complete_task":
      return executeCompleteTask(args, userId);
    case "list_today_events":
      return executeListTodayEvents(args, authHeader);
    case "search_project_data":
      return executeSearchProjectData(args, userId);
    default:
      return JSON.stringify({ success: false, error: `Herramienta desconocida: ${name}` });
  }
}

// ── Context builder ──

async function safeQuery(_label: string, queryFn: () => Promise<any>) {
  try {
    const { data, error } = await queryFn();
    if (error) {
      console.warn(`[jarvis-agent] Error querying ${_label}:`, error.message);
      return [];
    }
    return data || [];
  } catch (e) {
    console.warn(`[jarvis-agent] Table ${_label} error:`, e);
    return [];
  }
}

async function fetchTodayCalendar(authHeader: string): Promise<any[]> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) return [];

    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const res = await fetch(`${supabaseUrl}/functions/v1/icloud-calendar`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        apikey: anonKey,
      },
      body: JSON.stringify({
        action: "fetch",
        startDate: now.toISOString(),
        endDate: endOfDay.toISOString(),
      }),
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data?.events || [];
  } catch {
    return [];
  }
}

async function buildContext(supabase: any, userId: string, authHeader: string) {
  const now = new Date();
  const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  const [tasks, projects, learnings, followUps, commitments, unreadEmails, todayEvents] = await Promise.all([
    safeQuery("tasks", () =>
      supabase.from("tasks").select("id, title, priority, completed, due_date, type, source, description")
        .eq("user_id", userId).or("completed.is.null,completed.eq.false")
        .order("created_at", { ascending: false }).limit(20)
    ),
    safeQuery("business_projects", () =>
      supabase.from("business_projects").select("id, name, status, company, updated_at, estimated_value")
        .eq("user_id", userId).in("status", ["active", "in_progress", "new", "proposal"])
        .order("updated_at", { ascending: false }).limit(10)
    ),
    safeQuery("agent_learnings", () =>
      supabase.from("agent_learnings").select("trigger_text, learning_text, category")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(10)
    ),
    safeQuery("follow_ups", () =>
      supabase.from("follow_ups").select("id, topic, status, resolve_by, last_mention, notes")
        .eq("user_id", userId).neq("status", "resolved")
        .order("created_at", { ascending: false }).limit(10)
    ),
    safeQuery("commitments", () =>
      supabase.from("commitments").select("id, description, commitment_type, person_name, deadline, status")
        .eq("user_id", userId).neq("status", "completed")
        .order("deadline", { ascending: true }).limit(10)
    ),
    safeQuery("jarvis_emails_cache", () =>
      supabase.from("jarvis_emails_cache").select("id, from_addr, subject, preview, is_read, received_at")
        .eq("user_id", userId).eq("is_read", false)
        .order("received_at", { ascending: false }).limit(10)
    ),
    fetchTodayCalendar(authHeader),
  ]);

  let contextStr = `📅 ${dayNames[now.getDay()]} ${now.toLocaleDateString("es-ES")} — ${now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}\n\n`;

  // Today's calendar events
  if (todayEvents.length > 0) {
    contextStr += `🗓️ AGENDA DE HOY (${todayEvents.length}):\n`;
    for (const ev of todayEvents) {
      const timeStr = ev.time || "todo el día";
      contextStr += `- ${timeStr}: ${ev.title}${ev.location ? ` (${ev.location})` : ""}\n`;
    }
    contextStr += "\n";
  }

  // Tasks
  if (tasks.length > 0) {
    contextStr += `📋 TAREAS PENDIENTES (${tasks.length}):\n`;
    for (const t of tasks) {
      const overdue = t.due_date && new Date(t.due_date) < now ? " ⚠️ VENCIDA" : "";
      const dueStr = t.due_date ? ` (vence: ${new Date(t.due_date).toLocaleDateString("es-ES")})` : "";
      contextStr += `- [id:${t.id}] [${t.priority || "normal"}] ${t.title}${dueStr}${overdue}\n`;
    }
    contextStr += "\n";
  } else {
    contextStr += "📋 Sin tareas pendientes.\n\n";
  }

  // Follow-ups
  if (followUps.length > 0) {
    contextStr += `🔄 FOLLOW-UPS ABIERTOS (${followUps.length}):\n`;
    for (const f of followUps) {
      const resolveBy = f.resolve_by ? ` — resolver antes: ${new Date(f.resolve_by).toLocaleDateString("es-ES")}` : "";
      const overdue = f.resolve_by && new Date(f.resolve_by) < now ? " ⚠️ VENCIDO" : "";
      contextStr += `- ${f.topic} [${f.status}]${resolveBy}${overdue}\n`;
    }
    contextStr += "\n";
  }

  // Commitments
  if (commitments.length > 0) {
    contextStr += `🤝 COMPROMISOS PENDIENTES (${commitments.length}):\n`;
    for (const c of commitments) {
      const deadlineStr = c.deadline ? ` — deadline: ${new Date(c.deadline).toLocaleDateString("es-ES")}` : "";
      const overdue = c.deadline && new Date(c.deadline) < now ? " ⚠️ VENCIDO" : "";
      const who = c.person_name ? ` (${c.person_name})` : "";
      contextStr += `- [${c.commitment_type}]${who} ${c.description}${deadlineStr}${overdue}\n`;
    }
    contextStr += "\n";
  }

  // Unread emails
  if (unreadEmails.length > 0) {
    contextStr += `📧 CORREOS NO LEÍDOS (${unreadEmails.length}):\n`;
    for (const e of unreadEmails.slice(0, 5)) {
      const from = e.from_addr || "desconocido";
      contextStr += `- De: ${from} — "${e.subject}"\n`;
      if (e.preview) contextStr += `  Preview: ${e.preview.slice(0, 100)}...\n`;
    }
    contextStr += "\n";
  }

  // Projects
  if (projects.length > 0) {
    contextStr += `🏗️ PROYECTOS ACTIVOS (${projects.length}):\n`;
    for (const p of projects) {
      const daysSince = Math.floor((now.getTime() - new Date(p.updated_at).getTime()) / 86400000);
      const stale = daysSince > 7 ? ` ⏳ ${daysSince} días sin actividad` : "";
      const value = p.estimated_value ? ` — €${p.estimated_value.toLocaleString()}` : "";
      contextStr += `- ${p.name} (${p.company || "sin empresa"}) — ${p.status}${value}${stale}\n`;
    }
    contextStr += "\n";
  }

  // Learnings
  if (learnings.length > 0) {
    contextStr += `🧠 CORRECCIONES RECIENTES:\n`;
    for (const l of learnings.slice(0, 5)) {
      contextStr += `- [${l.category}] "${l.trigger_text}" → ${l.learning_text}\n`;
    }
    contextStr += "\n";
  }

  return { contextStr, taskCount: tasks.length, projectCount: projects.length, followUpCount: followUps.length, commitmentCount: commitments.length, emailCount: unreadEmails.length, calendarCount: todayEvents.length };
}

function detectCorrection(message: string): boolean {
  const correctionPatterns = [
    /\bno\b.*\beso\b/i, /\bte equivocas\b/i, /\bno es así\b/i,
    /\bestás mal\b/i, /\bincorrecto\b/i, /\bno,?\s+es\b/i,
    /\bcorregir\b/i, /\bmal\b.*\brespuesta\b/i,
  ];
  return correctionPatterns.some(p => p.test(message));
}

// ── Main handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mode, message, history } = await req.json();

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Build dynamic context (including today's calendar)
    const ctx = await buildContext(supabase, userId, authHeader);

    // Build messages
    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT + "\n\n--- CONTEXTO ACTUAL ---\n" + ctx.contextStr },
    ];

    // Add recent history
    if (history && Array.isArray(history)) {
      for (const h of history.slice(-10)) {
        messages.push({ role: h.role === "proactive" ? "assistant" : h.role, content: h.content });
      }
    }

    if (mode === "proactive") {
      messages.push({
        role: "user",
        content: "Háblame como mi secretaria de confianza. Dime qué es lo más urgente, qué debería hacer primero, avísame de problemas que veas venir, y proponme un plan para hoy. No hagas listas — háblame como una persona real.",
      });
    } else if (message) {
      messages.push({ role: "user", content: message });
    }

    // Save user message to DB
    if (mode === "chat" && message) {
      await supabase.from("agent_chat_messages").insert({
        user_id: userId,
        role: "user",
        content: message,
        context_used: { tasks: ctx.taskCount, projects: ctx.projectCount, follow_ups: ctx.followUpCount, commitments: ctx.commitmentCount, emails: ctx.emailCount, calendar: ctx.calendarCount },
      });

      if (detectCorrection(message)) {
        await supabase.from("agent_learnings").insert({
          user_id: userId,
          category: "correction",
          trigger_text: message.slice(0, 500),
          learning_text: "Corrección del usuario — pendiente de procesar contexto completo",
          confidence: 0.70,
        });
      }
    }

    // Call LLM with tools
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // First call: non-streaming to detect tool calls
    const firstResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: TOOLS,
        stream: false,
      }),
    });

    if (!firstResponse.ok) {
      if (firstResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Intenta en unos segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (firstResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes en Lovable AI." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await firstResponse.text();
      console.error("[jarvis-agent] LLM error:", firstResponse.status, errText);
      throw new Error(`LLM error: ${firstResponse.status}`);
    }

    const firstResult = await firstResponse.json();
    const firstChoice = firstResult.choices?.[0];

    // Check if the model wants to call tools
    if (firstChoice?.message?.tool_calls && firstChoice.message.tool_calls.length > 0) {
      console.log("[jarvis-agent] Tool calls detected:", firstChoice.message.tool_calls.length);

      // Add assistant message with tool calls to conversation
      messages.push(firstChoice.message);

      // Execute each tool call
      for (const toolCall of firstChoice.message.tool_calls) {
        const fnName = toolCall.function.name;
        let fnArgs: any;
        try {
          fnArgs = typeof toolCall.function.arguments === "string"
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments;
        } catch {
          fnArgs = {};
        }

        console.log(`[jarvis-agent] Executing tool: ${fnName}`, fnArgs);
        const result = await executeTool(fnName, fnArgs, userId, authHeader);
        console.log(`[jarvis-agent] Tool result: ${result}`);

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      // Second call: stream the final response after tool execution
      const secondResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          stream: true,
        }),
      });

      if (!secondResponse.ok) {
        const errText = await secondResponse.text();
        console.error("[jarvis-agent] Second LLM call error:", secondResponse.status, errText);
        throw new Error(`LLM error on second call: ${secondResponse.status}`);
      }

      return streamAndSave(secondResponse, userId, mode, ctx, supabaseUrl);
    }

    // No tool calls — the model responded with text directly
    // Re-do as streaming for better UX
    if (firstChoice?.message?.content) {
      const fullContent = firstChoice.message.content;

      // Save to DB
      const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await serviceClient.from("agent_chat_messages").insert({
        user_id: userId,
        role: mode === "proactive" ? "proactive" : "assistant",
        content: fullContent,
        model_used: "gemini-2.5-flash",
        context_used: { tasks: ctx.taskCount, projects: ctx.projectCount, follow_ups: ctx.followUpCount, commitments: ctx.commitmentCount, emails: ctx.emailCount, calendar: ctx.calendarCount },
      });

      // Convert to SSE format for the client
      const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: fullContent } }] })}\n\ndata: [DONE]\n\n`;
      return new Response(sseData, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    throw new Error("No response from LLM");
  } catch (e) {
    console.error("[jarvis-agent] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function streamAndSave(
  llmResponse: Response,
  userId: string,
  mode: string,
  ctx: any,
  supabaseUrl: string,
): Response {
  const reader = llmResponse.body!.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          controller.enqueue(new TextEncoder().encode(chunk));

          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) fullContent += delta;
            } catch { /* ignore */ }
          }
        }
        controller.close();

        if (fullContent) {
          const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
          await serviceClient.from("agent_chat_messages").insert({
            user_id: userId,
            role: mode === "proactive" ? "proactive" : "assistant",
            content: fullContent,
            model_used: "gemini-2.5-flash",
            context_used: { tasks: ctx.taskCount, projects: ctx.projectCount, follow_ups: ctx.followUpCount, commitments: ctx.commitmentCount, emails: ctx.emailCount, calendar: ctx.calendarCount },
          });
        }
      } catch (e) {
        console.error("[jarvis-agent] Stream error:", e);
        controller.error(e);
      }
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}
