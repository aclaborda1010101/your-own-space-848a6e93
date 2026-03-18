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

REGLA DE ORO — BÚSQUEDA EXHAUSTIVA:
NUNCA digas "no tengo esa información" o "no encuentro nada" sin haber usado TODAS las herramientas relevantes primero.
- Si te preguntan algo sobre una persona → usa get_contact_profile + search_whatsapp_messages + search_plaud_transcriptions + search_emails.
- Si te preguntan sobre una conversación → search_whatsapp_messages + search_plaud_transcriptions.
- Si te preguntan sobre un email o correo → search_emails.
- Si te preguntan sobre un proyecto → search_project_data.
- Si buscas y no encuentras nada, di EXACTAMENTE qué herramientas usaste y qué buscaste, para que el usuario pueda reformular.

EMAILS: Puedes buscar en TODOS los correos almacenados (asunto, cuerpo, remitente) con search_emails. Busca por contenido, remitente o contacto.

PERFILES: Puedes consultar toda la información conocida de un contacto con get_contact_profile — personalidad, tags IA, rol, mensajes recientes.

INTELIGENCIA: Cuando respondas, CONECTA información de múltiples fuentes. Si encuentras datos en WhatsApp Y en Plaud Y en emails sobre el mismo tema, sintetízalos en una respuesta coherente. No repitas cada fuente por separado.

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
- IMPORTANTE: Cuando te pregunten datos específicos de un proyecto, cliente o empresa (cifras, flota, requisitos, presupuestos, etc.), USA la herramienta search_project_data para buscar en los documentos del proyecto ANTES de decir que no tienes la información.
- CONVERSACIONES WHATSAPP: Tienes acceso a los mensajes de WhatsApp almacenados. Si te preguntan "¿qué me dijo X sobre Y?", "¿de qué hablamos con X?", o cualquier consulta sobre conversaciones pasadas, USA search_whatsapp_messages.
- TRANSCRIPCIONES PLAUD: Tienes acceso a grabaciones de voz transcritas automáticamente. USA search_plaud_transcriptions para conversaciones presenciales, reuniones, datos médicos, etc.
- BÚSQUEDA COMBINADA: Para preguntas complejas, usa MÚLTIPLES herramientas en paralelo.
- ALIASES FAMILIARES: Cuando el usuario diga "mi madre", "mi padre", etc., pásalo directamente como contact_name. El sistema resolverá automáticamente.`;

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
  {
    type: "function",
    function: {
      name: "search_whatsapp_messages",
      description: "Busca en los mensajes de WhatsApp almacenados del usuario. Usa esto cuando pregunten sobre conversaciones pasadas, qué dijo alguien, de qué se habló con un contacto, etc.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Texto a buscar en los mensajes (ej: 'web grupo Fitz', 'presupuesto', 'reunión')" },
          contact_name: { type: "string", description: "Nombre del contacto para filtrar (opcional, usa fuzzy match)" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_plaud_transcriptions",
      description: "Busca en las transcripciones de grabaciones Plaud (reuniones, conversaciones presenciales, llamadas grabadas). Usa esto para preguntas sobre conversaciones presenciales, datos médicos, reuniones familiares, o información que no está en WhatsApp.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Texto a buscar en las transcripciones (ej: 'TAC', 'reunión presupuesto', 'médico')" },
          contact_name: { type: "string", description: "Nombre del contacto o alias familiar (ej: 'mi madre', 'dani carvajal') para filtrar transcripciones vinculadas a esa persona" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_emails",
      description: "Busca en TODOS los correos electrónicos almacenados del usuario (asunto, cuerpo, remitente, destinatario). Usa esto cuando pregunten sobre emails, correos, qué escribió alguien por email, facturas, propuestas recibidas, etc.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Texto a buscar en asunto o cuerpo del email (ej: 'factura', 'propuesta', 'reunión')" },
          contact_name: { type: "string", description: "Nombre del contacto para filtrar emails asociados (opcional)" },
          from_address: { type: "string", description: "Dirección de email del remitente para filtrar (opcional)" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contact_profile",
      description: "Obtiene el perfil completo de un contacto: nombre, rol, tags IA, perfil de personalidad, mensajes recientes y más. Usa esto cuando pregunten '¿qué sabes de X?', '¿cómo es la personalidad de X?', o para obtener contexto sobre una persona.",
      parameters: {
        type: "object",
        properties: {
          contact_name: { type: "string", description: "Nombre del contacto o alias familiar (ej: 'Dani', 'mi madre', 'Carlos García')" },
        },
        required: ["contact_name"],
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
        result += `\n### ${name}\n${content.slice(0, 3000)}${content.length > 3000 ? "\n[...truncado...]" : ""}\n`;
      }
    }

    const { data: summary } = await sb.from("business_project_live_summary")
      .select("summary_markdown, updated_at")
      .eq("project_id", project.id)
      .maybeSingle();

    if (summary?.summary_markdown) {
      result += `\n\n--- RESUMEN VIVO ---\n${summary.summary_markdown.slice(0, 2000)}\n`;
    }

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

    if (result.length > 8000) {
      result = result.slice(0, 8000) + "\n\n[...resultado truncado por longitud...]";
    }

    return JSON.stringify({ success: true, data: result });
  } catch (e) {
    console.error("[jarvis-agent] search_project_data error:", e);
    return JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Error buscando datos del proyecto" });
  }
}

// ── Family alias map for contact resolution ──
const FAMILY_ALIASES: Record<string, string[]> = {
  "madre": ["mama", "mamá", "mami", "madre"],
  "mi madre": ["mama", "mamá", "mami", "madre"],
  "padre": ["papa", "papá", "papi", "padre"],
  "mi padre": ["papa", "papá", "papi", "padre"],
  "abuela": ["abuela", "yaya", "abu"],
  "abuelo": ["abuelo", "abu"],
  "hermano": ["hermano"],
  "hermana": ["hermana"],
  "hijo": ["hijo"],
  "hija": ["hija"],
  "tio": ["tio", "tío"],
  "tia": ["tia", "tía"],
};

async function resolveContactName(
  sb: any, userId: string, rawName: string
): Promise<{ contacts: { id: string; name: string }[]; resolution_note: string }> {
  // 1. Try direct ilike
  const term = `%${rawName}%`;
  let { data: contacts } = await sb.from("people_contacts")
    .select("id, name")
    .eq("user_id", userId)
    .ilike("name", term)
    .limit(5);

  if (contacts && contacts.length > 0) {
    return { contacts, resolution_note: "" };
  }

  // 2. Try family aliases
  const normalized = rawName.toLowerCase().trim();
  const aliases = FAMILY_ALIASES[normalized];
  if (aliases) {
    for (const alias of aliases) {
      const { data: aliasContacts } = await sb.from("people_contacts")
        .select("id, name")
        .eq("user_id", userId)
        .ilike("name", `%${alias}%`)
        .limit(5);
      if (aliasContacts && aliasContacts.length > 0) {
        return {
          contacts: aliasContacts,
          resolution_note: `No encontré "${rawName}" directamente, pero encontré "${aliasContacts[0].name}" como coincidencia.`,
        };
      }
    }
  }

  // 3. Try splitting multi-word names
  const parts = rawName.trim().split(/\s+/);
  if (parts.length > 1) {
    for (const part of parts) {
      if (part.length < 3) continue;
      const { data: partContacts } = await sb.from("people_contacts")
        .select("id, name")
        .eq("user_id", userId)
        .ilike("name", `%${part}%`)
        .limit(5);
      if (partContacts && partContacts.length > 0) {
        return {
          contacts: partContacts,
          resolution_note: `No encontré "${rawName}" exacto, pero encontré "${partContacts.map((c: any) => c.name).join(", ")}" buscando por "${part}".`,
        };
      }
    }
  }

  // 4. Fallback: fuzzy search with pg_trgm
  const { data: fuzzyContacts } = await sb.rpc("search_contacts_fuzzy", {
    p_user_id: userId,
    p_search_term: rawName,
    p_limit: 5,
  });

  if (fuzzyContacts && fuzzyContacts.length > 0) {
    return {
      contacts: fuzzyContacts,
      resolution_note: `No encontré "${rawName}" exacto, pero por similitud encontré "${fuzzyContacts[0].name}".`,
    };
  }

  return { contacts: [], resolution_note: `No se encontró ningún contacto con nombre "${rawName}".` };
}

async function executeSearchWhatsAppMessages(args: any, userId: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    let contactIds: string[] = [];
    let contactNames: Record<string, string> = {};
    let resolutionNote = "";

    if (args.contact_name) {
      const resolved = await resolveContactName(sb, userId, args.contact_name);
      resolutionNote = resolved.resolution_note;

      if (resolved.contacts.length > 0) {
        contactIds = resolved.contacts.map((c: any) => c.id);
        for (const c of resolved.contacts) contactNames[c.id] = c.name;
      } else {
        return JSON.stringify({ success: false, error: resolved.resolution_note || `No se encontró ningún contacto con nombre "${args.contact_name}".` });
      }
    }

    // Build OR filter for multiple query terms for better recall
    const queryTerms = args.query.split(/\s+/).filter((t: string) => t.length > 2);
    
    let msgQuery = sb.from("contact_messages")
      .select("contact_id, content, direction, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (contactIds.length > 0) {
      msgQuery = msgQuery.in("contact_id", contactIds);
    }

    // Use OR for multiple terms for better recall
    if (queryTerms.length > 1) {
      const orFilter = queryTerms.map((t: string) => `content.ilike.%${t}%`).join(",");
      msgQuery = msgQuery.or(orFilter);
    } else if (queryTerms.length === 1) {
      msgQuery = msgQuery.ilike("content", `%${queryTerms[0]}%`);
    }

    const { data: messages, error } = await msgQuery.limit(50);

    if (error) {
      console.error("[jarvis-agent] search_whatsapp error:", error);
      return JSON.stringify({ success: false, error: error.message });
    }

    if (!messages || messages.length === 0) {
      return JSON.stringify({ success: true, data: "No se encontraron mensajes que coincidan con la búsqueda.", count: 0 });
    }

    // If we don't have contact names yet, fetch them
    if (Object.keys(contactNames).length === 0) {
      const uniqueContactIds = [...new Set(messages.map((m: any) => m.contact_id))];
      const { data: contacts } = await sb.from("people_contacts")
        .select("id, name")
        .in("id", uniqueContactIds);
      if (contacts) {
        for (const c of contacts) contactNames[c.id] = c.name;
      }
    }

    // Format results
    let result = resolutionNote ? `${resolutionNote}\n\n` : "";
    result += `Encontrados ${messages.length} mensajes:\n\n`;
    for (const msg of messages) {
      const name = contactNames[msg.contact_id] || "Desconocido";
      const dir = msg.direction === "incoming" ? `${name} →` : `Tú →`;
      const date = new Date(msg.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
      const content = (msg.content || "").slice(0, 500);
      result += `[${date}] ${dir} ${content}\n\n`;
    }

    if (result.length > 8000) {
      result = result.slice(0, 8000) + "\n[...truncado...]";
    }

    return JSON.stringify({ success: true, data: result, count: messages.length });
  } catch (e) {
    console.error("[jarvis-agent] search_whatsapp error:", e);
    return JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Error buscando mensajes" });
  }
}

async function executeSearchPlaudTranscriptions(args: any, userId: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    let contactIds: string[] = [];
    let resolutionNote = "";

    if (args.contact_name) {
      const resolved = await resolveContactName(sb, userId, args.contact_name);
      resolutionNote = resolved.resolution_note;
      contactIds = resolved.contacts.map((c: any) => c.id);
      if (contactIds.length === 0) {
        resolutionNote = resolved.resolution_note;
      }
    }

    const searchTerm = `%${args.query}%`;
    let query = sb.from("plaud_transcriptions")
      .select("id, title, recording_date, summary_structured, transcript_raw, linked_contact_ids, processing_status, duration_minutes")
      .eq("user_id", userId)
      .in("processing_status", ["completed", "pending_review"])
      .or(`summary_structured.ilike.${searchTerm},transcript_raw.ilike.${searchTerm},title.ilike.${searchTerm}`)
      .order("recording_date", { ascending: false })
      .limit(10);

    const { data: transcriptions, error } = await query;

    if (error) {
      console.error("[jarvis-agent] search_plaud error:", error);
      return JSON.stringify({ success: false, error: error.message });
    }

    let filtered = transcriptions || [];
    if (contactIds.length > 0 && filtered.length > 0) {
      const contactFiltered = filtered.filter((t: any) => {
        if (!t.linked_contact_ids || !Array.isArray(t.linked_contact_ids)) return false;
        return t.linked_contact_ids.some((id: string) => contactIds.includes(id));
      });
      if (contactFiltered.length > 0) filtered = contactFiltered;
    }

    // Also search in conversation_embeddings as fallback
    if (filtered.length === 0) {
      let embQuery = sb.from("conversation_embeddings")
        .select("id, date, brain, people, summary, content")
        .eq("user_id", userId)
        .or(`content.ilike.${searchTerm},summary.ilike.${searchTerm}`)
        .order("date", { ascending: false })
        .limit(10);

      const { data: embeddings } = await embQuery;
      if (embeddings && embeddings.length > 0) {
        let result = resolutionNote ? `${resolutionNote}\n\n` : "";
        result += `Encontradas ${embeddings.length} conversaciones grabadas:\n\n`;
        for (const emb of embeddings) {
          const date = emb.date ? new Date(emb.date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "?";
          const people = Array.isArray(emb.people) ? emb.people.join(", ") : "";
          const snippet = (emb.content || emb.summary || "").slice(0, 500);
          result += `[${date}] ${emb.brain || ""} ${people ? `(${people})` : ""}\n${snippet}\n\n`;
        }
        if (result.length > 6000) result = result.slice(0, 6000) + "\n[...truncado...]";
        return JSON.stringify({ success: true, data: result, count: embeddings.length, source: "conversation_embeddings" });
      }
    }

    if (filtered.length === 0) {
      return JSON.stringify({ success: true, data: `${resolutionNote ? resolutionNote + "\n" : ""}No se encontraron transcripciones de Plaud que coincidan con "${args.query}".`, count: 0 });
    }

    let result = resolutionNote ? `${resolutionNote}\n\n` : "";
    result += `Encontradas ${filtered.length} transcripciones Plaud:\n\n`;
    for (const t of filtered) {
      const date = t.recording_date ? new Date(t.recording_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "?";
      const duration = t.duration_minutes ? ` (${t.duration_minutes} min)` : "";
      const content = (t.transcript_raw || t.summary_structured || "").slice(0, 800);
      result += `### ${t.title || "Grabación"} — ${date}${duration}\n${content}\n\n`;
    }

    if (result.length > 6000) result = result.slice(0, 6000) + "\n[...truncado...]";
    return JSON.stringify({ success: true, data: result, count: filtered.length, source: "plaud_transcriptions" });
  } catch (e) {
    console.error("[jarvis-agent] search_plaud error:", e);
    return JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Error buscando transcripciones" });
  }
}

// ── NEW: Search emails ──

async function executeSearchEmails(args: any, userId: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const searchTerm = `%${args.query}%`;

    // Build OR filter across subject, body_text, from_addr
    let orParts = [
      `subject.ilike.${searchTerm}`,
      `body_text.ilike.${searchTerm}`,
    ];

    let emailQuery = sb.from("jarvis_emails_cache")
      .select("id, from_addr, to_addr, subject, body_text, preview, received_at, is_read")
      .eq("user_id", userId)
      .or(orParts.join(","))
      .order("received_at", { ascending: false })
      .limit(10);

    // Optional from_address filter
    if (args.from_address) {
      emailQuery = emailQuery.ilike("from_addr", `%${args.from_address}%`);
    }

    const { data: emails, error } = await emailQuery;

    if (error) {
      console.error("[jarvis-agent] search_emails error:", error);
      return JSON.stringify({ success: false, error: error.message });
    }

    // If contact_name provided, also try to find emails from that contact's known addresses
    if (args.contact_name && (!emails || emails.length === 0)) {
      const resolved = await resolveContactName(sb, userId, args.contact_name);
      if (resolved.contacts.length > 0) {
        // Get contact's metadata for email addresses
        const { data: contactData } = await sb.from("people_contacts")
          .select("name, metadata")
          .in("id", resolved.contacts.map((c: any) => c.id));

        if (contactData) {
          for (const contact of contactData) {
            const meta = contact.metadata as any;
            const emails_list = meta?.emails || meta?.email ? [meta.email, ...(meta.emails || [])] : [];
            for (const email of emails_list) {
              if (!email) continue;
              const { data: contactEmails } = await sb.from("jarvis_emails_cache")
                .select("id, from_addr, to_addr, subject, body_text, preview, received_at, is_read")
                .eq("user_id", userId)
                .or(`from_addr.ilike.%${email}%,to_addr.ilike.%${email}%`)
                .order("received_at", { ascending: false })
                .limit(10);

              if (contactEmails && contactEmails.length > 0) {
                let result = resolved.resolution_note ? `${resolved.resolution_note}\n\n` : "";
                result += `Encontrados ${contactEmails.length} emails de/para ${contact.name}:\n\n`;
                for (const e of contactEmails) {
                  const date = new Date(e.received_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
                  const body = (e.body_text || e.preview || "").slice(0, 800);
                  result += `[${date}] De: ${e.from_addr}\nAsunto: ${e.subject}\n${body}\n\n`;
                }
                if (result.length > 8000) result = result.slice(0, 8000) + "\n[...truncado...]";
                return JSON.stringify({ success: true, data: result, count: contactEmails.length });
              }
            }
          }
        }
      }
    }

    if (!emails || emails.length === 0) {
      return JSON.stringify({ success: true, data: `No se encontraron emails que coincidan con "${args.query}".`, count: 0 });
    }

    let result = `Encontrados ${emails.length} emails:\n\n`;
    for (const e of emails) {
      const date = new Date(e.received_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
      const body = (e.body_text || e.preview || "").slice(0, 800);
      const readStatus = e.is_read ? "" : " 🆕";
      result += `[${date}]${readStatus} De: ${e.from_addr}\nAsunto: ${e.subject}\n${body}\n\n`;
    }

    if (result.length > 8000) {
      result = result.slice(0, 8000) + "\n[...truncado...]";
    }

    return JSON.stringify({ success: true, data: result, count: emails.length });
  } catch (e) {
    console.error("[jarvis-agent] search_emails error:", e);
    return JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Error buscando emails" });
  }
}

// ── NEW: Get contact profile ──

async function executeGetContactProfile(args: any, userId: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const resolved = await resolveContactName(sb, userId, args.contact_name);
    if (resolved.contacts.length === 0) {
      return JSON.stringify({ success: false, error: resolved.resolution_note || `No se encontró ningún contacto con nombre "${args.contact_name}".` });
    }

    const contactId = resolved.contacts[0].id;

    // Fetch full contact profile
    const { data: contact } = await sb.from("people_contacts")
      .select("id, name, role, notes, ai_tags, personality_profile, metadata, phone_numbers, wa_id, created_at")
      .eq("id", contactId)
      .maybeSingle();

    if (!contact) {
      return JSON.stringify({ success: false, error: "No se encontró el perfil del contacto." });
    }

    let result = resolved.resolution_note ? `${resolved.resolution_note}\n\n` : "";
    result += `## Perfil: ${contact.name}\n`;
    if (contact.role) result += `Rol: ${contact.role}\n`;
    if (contact.notes) result += `Notas: ${contact.notes}\n`;

    // AI Tags
    if (contact.ai_tags && Array.isArray(contact.ai_tags) && contact.ai_tags.length > 0) {
      result += `\nTags IA: ${contact.ai_tags.join(", ")}\n`;
    }

    // Personality profile
    if (contact.personality_profile) {
      const pp = contact.personality_profile as any;
      result += `\n--- PERFIL DE PERSONALIDAD ---\n`;
      if (pp.resumen || pp.summary) result += `Resumen: ${pp.resumen || pp.summary}\n`;
      if (pp.estilo_comunicacion || pp.communication_style) result += `Estilo comunicación: ${pp.estilo_comunicacion || pp.communication_style}\n`;
      if (pp.valores || pp.values) result += `Valores: ${JSON.stringify(pp.valores || pp.values)}\n`;
      if (pp.motivaciones || pp.motivations) result += `Motivaciones: ${JSON.stringify(pp.motivaciones || pp.motivations)}\n`;
      if (pp.puntos_fuertes || pp.strengths) result += `Fortalezas: ${JSON.stringify(pp.puntos_fuertes || pp.strengths)}\n`;
      if (pp.areas_mejora || pp.weaknesses) result += `Áreas de mejora: ${JSON.stringify(pp.areas_mejora || pp.weaknesses)}\n`;
      // Dump remaining keys
      const knownKeys = ['resumen', 'summary', 'estilo_comunicacion', 'communication_style', 'valores', 'values', 'motivaciones', 'motivations', 'puntos_fuertes', 'strengths', 'areas_mejora', 'weaknesses'];
      for (const [key, val] of Object.entries(pp)) {
        if (!knownKeys.includes(key) && val) {
          result += `${key}: ${typeof val === 'string' ? val : JSON.stringify(val)}\n`;
        }
      }
    }

    // Metadata (phones, emails, etc.)
    if (contact.metadata) {
      const meta = contact.metadata as any;
      if (meta.emails) result += `\nEmails: ${JSON.stringify(meta.emails)}\n`;
      if (meta.company) result += `Empresa: ${meta.company}\n`;
      if (meta.position) result += `Cargo: ${meta.position}\n`;
    }

    // Recent messages (last 5)
    const { data: recentMsgs } = await sb.from("contact_messages")
      .select("content, direction, created_at")
      .eq("user_id", userId)
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (recentMsgs && recentMsgs.length > 0) {
      result += `\n--- MENSAJES RECIENTES (${recentMsgs.length}) ---\n`;
      for (const msg of recentMsgs) {
        const date = new Date(msg.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
        const dir = msg.direction === "incoming" ? `${contact.name} →` : "Tú →";
        result += `[${date}] ${dir} ${(msg.content || "").slice(0, 300)}\n`;
      }
    }

    // Message count
    const { count } = await sb.from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("contact_id", contactId);

    if (count !== null) {
      result += `\nTotal mensajes almacenados: ${count}\n`;
    }

    if (result.length > 8000) {
      result = result.slice(0, 8000) + "\n[...truncado...]";
    }

    return JSON.stringify({ success: true, data: result });
  } catch (e) {
    console.error("[jarvis-agent] get_contact_profile error:", e);
    return JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Error obteniendo perfil del contacto" });
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
    case "search_whatsapp_messages":
      return executeSearchWhatsAppMessages(args, userId);
    case "search_plaud_transcriptions":
      return executeSearchPlaudTranscriptions(args, userId);
    case "search_emails":
      return executeSearchEmails(args, userId);
    case "get_contact_profile":
      return executeGetContactProfile(args, userId);
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

  if (todayEvents.length > 0) {
    contextStr += `🗓️ AGENDA DE HOY (${todayEvents.length}):\n`;
    for (const ev of todayEvents) {
      const timeStr = ev.time || "todo el día";
      contextStr += `- ${timeStr}: ${ev.title}${ev.location ? ` (${ev.location})` : ""}\n`;
    }
    contextStr += "\n";
  }

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

  if (followUps.length > 0) {
    contextStr += `🔄 FOLLOW-UPS ABIERTOS (${followUps.length}):\n`;
    for (const f of followUps) {
      const resolveBy = f.resolve_by ? ` — resolver antes: ${new Date(f.resolve_by).toLocaleDateString("es-ES")}` : "";
      const overdue = f.resolve_by && new Date(f.resolve_by) < now ? " ⚠️ VENCIDO" : "";
      contextStr += `- ${f.topic} [${f.status}]${resolveBy}${overdue}\n`;
    }
    contextStr += "\n";
  }

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

  if (unreadEmails.length > 0) {
    contextStr += `📧 CORREOS NO LEÍDOS (${unreadEmails.length}):\n`;
    for (const e of unreadEmails.slice(0, 5)) {
      const from = e.from_addr || "desconocido";
      contextStr += `- De: ${from} — "${e.subject}"\n`;
      if (e.preview) contextStr += `  Preview: ${e.preview.slice(0, 100)}...\n`;
    }
    contextStr += "\n";
  }

  if (projects.length > 0) {
    const projectIds = projects.map((p: any) => p.id);
    const docCounts: Record<string, number> = {};
    const { data: docs } = await supabase.from("project_documents")
      .select("project_id")
      .in("project_id", projectIds);
    if (docs) {
      for (const d of docs) {
        docCounts[d.project_id] = (docCounts[d.project_id] || 0) + 1;
      }
    }

    contextStr += `🏗️ PROYECTOS ACTIVOS (${projects.length}):\n`;
    for (const p of projects) {
      const daysSince = Math.floor((now.getTime() - new Date(p.updated_at).getTime()) / 86400000);
      const stale = daysSince > 7 ? ` ⏳ ${daysSince} días sin actividad` : "";
      const value = p.estimated_value ? ` — €${p.estimated_value.toLocaleString()}` : "";
      const docCount = docCounts[p.id] || 0;
      const docInfo = docCount > 0 ? ` — 📄 ${docCount} docs (usa search_project_data para consultar)` : "";
      contextStr += `- ${p.name} (${p.company || "sin empresa"}) — ${p.status}${value}${stale}${docInfo}\n`;
    }
    contextStr += "\n";
  }

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

// ── Detect if a question requires advanced reasoning ──
function needsProModel(message: string): boolean {
  const complexPatterns = [
    /\bpor qu[eé]\b/i, /\banaliz[ao]\b/i, /\bcompar[ao]\b/i,
    /\bexpl[ií]ca\b/i, /\beval[uú]a\b/i, /\bestrategi/i,
    /\bqu[eé] opinas\b/i, /\bqu[eé] piensas\b/i, /\bqu[eé] recomiendas\b/i,
    /\bresume todo\b/i, /\bcómo deber[ií]a\b/i,
    /\bpros y contras\b/i, /\bventajas\b/i,
  ];
  return complexPatterns.some(p => p.test(message));
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

    // Build dynamic context
    const ctx = await buildContext(supabase, userId, authHeader);

    // Select model based on complexity
    const useProModel = mode === "chat" && message && needsProModel(message);
    const model = useProModel ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";

    // Build messages
    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT + "\n\n--- CONTEXTO ACTUAL ---\n" + ctx.contextStr },
    ];

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

    console.log(`[jarvis-agent] Using model: ${model}${useProModel ? " (complex query detected)" : ""}`);

    // First call: non-streaming to detect tool calls
    const firstResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
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
        console.log(`[jarvis-agent] Tool result: ${result.slice(0, 200)}`);

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
          model,
          messages,
          stream: true,
        }),
      });

      if (!secondResponse.ok) {
        const errText = await secondResponse.text();
        console.error("[jarvis-agent] Second LLM call error:", secondResponse.status, errText);
        throw new Error(`LLM error on second call: ${secondResponse.status}`);
      }

      return streamAndSave(secondResponse, userId, mode, ctx, supabaseUrl, model);
    }

    // No tool calls — the model responded with text directly
    if (firstChoice?.message?.content) {
      const fullContent = firstChoice.message.content;

      const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await serviceClient.from("agent_chat_messages").insert({
        user_id: userId,
        role: mode === "proactive" ? "proactive" : "assistant",
        content: fullContent,
        model_used: model,
        context_used: { tasks: ctx.taskCount, projects: ctx.projectCount, follow_ups: ctx.followUpCount, commitments: ctx.commitmentCount, emails: ctx.emailCount, calendar: ctx.calendarCount },
      });

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
  model: string,
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
            model_used: model,
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
