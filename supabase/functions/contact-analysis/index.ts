import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Prompt layers by scope ─────────────────────────────────────────────────────

const COMMON_EXTRACTION = `
## CAPA COMÚN — Extraer SIEMPRE

### Datos factuales concretos
- Compromisos explícitos: "te llamo el martes", "quedamos a las 5", "te envío el presupuesto mañana"
- Tareas pendientes: cualquier compromiso del usuario o del contacto
- Fechas y eventos mencionados: cumpleaños, viajes, reuniones, entregas, citas médicas
- Personas mencionadas por el contacto: familia, compañeros, jefes, amigos comunes (y contexto)
- Datos personales revelados: dónde vive, trabaja, hijos, coche, gustos, alergias, preferencias
- Cambios vitales: mudanzas, cambio de trabajo, ruptura sentimental, nacimiento, fallecimiento, enfermedad
`;

const PROFESSIONAL_LAYER = `
## CAPA PROFESIONAL — Extracción específica

### REGLAS DE FILTRADO POR ÁMBITO — MUY IMPORTANTE
- Analiza SOLO el contenido PROFESIONAL: proyectos, negocios, propuestas comerciales, reuniones de trabajo, entregas, deadlines, pipeline de oportunidades.
- IGNORA COMPLETAMENTE: planes personales, quedadas, humor, temas familiares, hijos, salud personal, gestiones administrativas no empresariales.
- Las métricas deben reflejar SOLO mensajes profesionales. Estima qué porcentaje de los mensajes son profesionales y repórtalo en mensajes_ambito.
- Si hay muy pocos mensajes profesionales, dilo como insight honesto. NO rellenes con contenido personal o familiar.

### Datos profesionales a extraer
- Empresa/organización y cargo actual del contacto
- Proyectos o negocios mencionados en conversación
- Presupuestos, cifras, condiciones comerciales discutidas
- Competidores o alternativas mencionadas
- Plazos y deadlines de proyectos
- Decisores mencionados (su jefe, socio, quien aprueba)
- Objeciones o preocupaciones sobre propuestas

## Patrones profesionales a detectar
- 🟢 Oportunidad de negocio: menciona problema, necesidad, proyecto nuevo, presupuesto disponible
- 🟢 Interés creciente: aumenta frecuencia, preguntas específicas, pide presupuestos
- 🔴 Enfriamiento: respuestas cortas, tarda más, mensajes sin responder
- 🟡 Objeción no resuelta: menciona precio, timing, competencia sin respuesta satisfactoria
- 🔴 Compromiso incumplido: algo prometido que no se ha hecho (por cualquiera)
- 🟢 Momento de cierre: pide condiciones finales, disponibilidad, "vamos adelante"
- 🟡 Cambio de poder: cambia de puesto, empresa o menciona reorganización
- 🔴 Referencia a competencia: habla con otros proveedores o alternativas

## Campos específicos profesionales a incluir en JSON
"pipeline": { "oportunidades": [{"descripcion": "...", "estado": "activa|fría|cerrada"}], "probabilidad_cierre": "alta|media|baja" }
`;

const PERSONAL_LAYER = `
## CAPA PERSONAL — Extracción específica

### REGLAS DE FILTRADO POR ÁMBITO — MUY IMPORTANTE
- Analiza SOLO el contenido PERSONAL: amistad, planes, quedadas, humor, intereses comunes, favores, gestiones administrativas compartidas (dinero no empresarial).
- IGNORA COMPLETAMENTE: proyectos de negocio, reuniones de trabajo, pipeline, presupuestos empresariales, deadlines de proyectos.
- Si hay pocos mensajes personales (ej: el 90% son profesionales), dilo COMO INSIGHT HONESTO: "La relación se ha profesionalizado significativamente. De los X mensajes del último mes, solo ~Y son de carácter personal."
- NO rellenes con contenido profesional para que la vista parezca completa. Mejor un análisis corto y honesto que uno largo con datos del ámbito equivocado.
- Las métricas deben reflejar SOLO mensajes personales. Estima qué porcentaje de los mensajes son personales y repórtalo en mensajes_ambito.

### Datos personales a extraer
- Intereses y hobbies mencionados
- Situación sentimental y familiar
- Planes de futuro (viajes, proyectos personales)
- Estado de ánimo predominante en conversaciones recientes
- Temas recurrentes de conversación NO laborales
- Favores pedidos o hechos (en ambas direcciones)
- Eventos compartidos (cenas, viajes, actividades)

### GESTIONES COMPARTIDAS — Extraer siempre en ámbito personal
Cualquier mención de dinero entre el usuario y el contacto que NO sea un proyecto de negocio va aquí:
- Préstamos personales, pagos compartidos, suscripciones, facturas domésticas
- Líneas de teléfono, servicios compartidos, deudas personales
- Formato: gestiones_compartidas: [{ descripcion, monto, origen, estado, fecha_detectada }]
- Si algo parece un pago de proyecto empresarial, NO lo incluyas aquí — eso va en la vista profesional.

### DINÁMICA DE LA RELACIÓN — Extraer siempre en ámbito personal
Analiza CÓMO se hablan el usuario y el contacto, no solo DE QUÉ hablan:
- tono: "humor" | "formal" | "cercano" | "tenso" | "neutro"
- uso_humor: "frecuente" | "ocasional" | "raro" — con ejemplo concreto si hay
- temas_no_laborales: lista de temas personales recurrentes (ej: fútbol, coches, familia)
- confianza_percibida: "alta" | "media" | "baja"
- evidencia_confianza: cita concreta que justifique el nivel de confianza
- ultima_conversacion_personal: { fecha, tema } — última conversación que NO fue de trabajo

## Patrones personales a detectar
- 🔴 Distanciamiento: reducción drástica de frecuencia, respuestas frías o monosilábicas
- 🟡 Momento difícil: problemas de salud, rupturas, pérdidas, estrés
- 🟡 Reciprocidad desequilibrada: siempre inicia el usuario, contacto nunca propone planes
- 🟢 Confianza creciente: comparte temas más íntimos, pide consejo, se abre emocionalmente
- 🟡 Favor pendiente: alguien prometió algo y no lo ha cumplido (cualquier dirección)
- 🟢 Oportunidad social: contacto menciona evento, viaje o actividad donde podrías unirte
- 🟡 Cambio vital: nueva pareja, nuevo trabajo, mudanza, nacimiento
- 🟢 Fecha importante: cumpleaños, aniversarios mencionados
- 🟡 Profesionalización de la relación: si estimas que la proporción de mensajes personales ha bajado significativamente respecto al total, genera una alerta amarilla con el texto "Profesionalización de la relación: la comunicación personal representa solo X% del total. Considerar recuperar espacio personal."

## Campos específicos personales a incluir en JSON
"termometro_relacion": "frio|tibio|calido|fuerte"
"reciprocidad": { "usuario_inicia": 70, "contacto_inicia": 30, "evaluacion": "equilibrada|desequilibrada" }
"gestiones_compartidas": [{ "descripcion": "...", "monto": "...", "origen": "WhatsApp DD/MM", "estado": "activo|resuelto|pendiente", "fecha_detectada": "DD/MM" }]
"dinamica_relacion": { "tono": "...", "uso_humor": "...", "temas_no_laborales": ["..."], "confianza_percibida": "alta|media|baja", "evidencia_confianza": "cita concreta", "ultima_conversacion_personal": { "fecha": "DD/MM", "tema": "..." } }
`;

const FAMILIAR_LAYER = `
## CAPA FAMILIAR — Extracción específica

### REGLAS DE FILTRADO POR ÁMBITO — MUY IMPORTANTE
- Analiza SOLO el contenido FAMILIAR: familia, hijos, parejas, padres, hermanos, salud familiar, coordinación, celebraciones, bienestar emocional.
- IGNORA COMPLETAMENTE: proyectos de negocio, reuniones de trabajo, temas de amistad no familiar, pipeline, presupuestos empresariales.
- Si hay pocos mensajes familiares, dilo como insight honesto. NO rellenes con contenido profesional o personal no familiar.
- Las métricas deben reflejar SOLO mensajes familiares. Estima qué porcentaje de los mensajes son familiares y repórtalo en mensajes_ambito.

### Datos familiares a extraer
- Estado emocional del familiar
- Necesidades expresadas (explícitas o implícitas)
- Salud: médicos, síntomas, medicación, citas médicas
- Logros y progresos (especialmente niños: Bosco)
- Conflictos o tensiones mencionadas
- Planes familiares: vacaciones, celebraciones, visitas
- Coordinación logística: quién recoge al niño, compras, horarios

## Patrones familiares a detectar
- 🔴 Necesidad no expresada: menciona cansancio, agobio, soledad recurrente sin pedir ayuda
- 🟡 Tensión creciente: tono seco, respuestas cortantes, temas que se evitan
- 🔴 Desconexión: reducción de comunicación con familiar cercano
- 🟢 Hito del hijo: Bosco logra algo nuevo, empieza actividad, cambia de etapa
- 🟡 Salud familiar: citas médicas, síntomas, tratamientos mencionados
- 🟡 Coordinación fallida: malentendidos sobre horarios, responsabilidades no asumidas
- 🟢 Momento positivo: planes que salen bien, celebraciones, momentos de conexión
- 🟡 Patrón emocional del hijo: cambios de humor recurrentes, miedos, alegrías, frustraciones

## Campos específicos familiares a incluir en JSON
"bienestar": { "estado_emocional": "...", "necesidades": ["..."] }
"coordinacion": [{ "tarea": "...", "responsable": "..." }]
"desarrollo_bosco": { "hitos": [{"hito": "...", "fecha": "..."}], "patrones_emocionales": ["..."] }
`;

const getLayerByScope = (category: string) => {
  switch (category) {
    case 'profesional': return PROFESSIONAL_LAYER;
    case 'personal': return PERSONAL_LAYER;
    case 'familiar': return FAMILIAR_LAYER;
    default: return PROFESSIONAL_LAYER;
  }
};

// ── Pre-calculate metrics from messages ────────────────────────────────────────

interface PreCalculatedMetrics {
  total_30d: number;
  total_prev_30d: number;
  media_semanal_actual: number;
  media_semanal_anterior: number;
  tendencia_pct: number;
  tendencia: string;
  ratio_iniciativa_usuario: number;
  ratio_iniciativa_contacto: number;
  dia_mas_activo: string;
  horario_habitual: string;
  canales: string[];
  ultimo_contacto: string;
}

function preCalculateMetrics(messages: any[], contactName: string): PreCalculatedMetrics {
  const now = new Date();
  const d30ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const d60ago = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const msgs30d = messages.filter(m => m.message_date && new Date(m.message_date) >= d30ago);
  const msgsPrev30d = messages.filter(m => {
    if (!m.message_date) return false;
    const d = new Date(m.message_date);
    return d >= d60ago && d < d30ago;
  });

  const total_30d = msgs30d.length;
  const total_prev_30d = msgsPrev30d.length;

  // Weekly averages
  const media_semanal_actual = total_30d > 0 ? Math.round((total_30d / 4.3) * 10) / 10 : 0;
  const media_semanal_anterior = total_prev_30d > 0 ? Math.round((total_prev_30d / 4.3) * 10) / 10 : 0;

  // Trend
  let tendencia_pct = 0;
  let tendencia = 'estable';
  if (media_semanal_anterior > 0) {
    tendencia_pct = Math.round(((media_semanal_actual - media_semanal_anterior) / media_semanal_anterior) * 100);
    if (tendencia_pct > 15) tendencia = 'creciente';
    else if (tendencia_pct < -15) tendencia = 'declive';
  } else if (media_semanal_actual > 0) {
    tendencia = 'creciente';
    tendencia_pct = 100;
  }

  // Initiative ratio: who sends first message after >4h silence
  let userInitiates = 0;
  let contactInitiates = 0;
  const sortedMsgs = [...msgs30d].sort((a, b) => 
    new Date(a.message_date).getTime() - new Date(b.message_date).getTime()
  );

  for (let i = 0; i < sortedMsgs.length; i++) {
    const msg = sortedMsgs[i];
    if (i === 0) {
      if (msg.direction === 'outgoing') userInitiates++;
      else contactInitiates++;
      continue;
    }
    const prev = sortedMsgs[i - 1];
    const gap = new Date(msg.message_date).getTime() - new Date(prev.message_date).getTime();
    if (gap > 4 * 60 * 60 * 1000) { // >4h gap
      if (msg.direction === 'outgoing') userInitiates++;
      else contactInitiates++;
    }
  }

  const totalInitiatives = userInitiates + contactInitiates;
  const ratio_iniciativa_usuario = totalInitiatives > 0 ? Math.round((userInitiates / totalInitiatives) * 100) : 50;
  const ratio_iniciativa_contacto = 100 - ratio_iniciativa_usuario;

  // Most active day
  const dayCounts: Record<string, number> = {};
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  for (const m of msgs30d) {
    if (!m.message_date) continue;
    const day = dayNames[new Date(m.message_date).getDay()];
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  }
  const dia_mas_activo = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  // Most active hour range
  const hourCounts: Record<number, number> = {};
  for (const m of msgs30d) {
    if (!m.message_date) continue;
    const hour = new Date(m.message_date).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  }
  const topHours = Object.entries(hourCounts).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 3);
  const horario_habitual = topHours.length > 0
    ? topHours.map(([h]) => `${h}:00`).join(', ')
    : 'N/A';

  // Channels used
  const canales = new Set<string>();
  canales.add('whatsapp'); // messages are from WA
  // Could add email, plaud detection here if needed

  // Last contact
  const ultimo_contacto = messages.length > 0 && messages[0].message_date
    ? messages[0].message_date.substring(0, 10)
    : 'N/A';

  return {
    total_30d,
    total_prev_30d,
    media_semanal_actual,
    media_semanal_anterior,
    tendencia_pct,
    tendencia,
    ratio_iniciativa_usuario,
    ratio_iniciativa_contacto,
    dia_mas_activo,
    horario_habitual,
    canales: Array.from(canales),
    ultimo_contacto,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Not authenticated");

    const { contact_id, scopes: requestedScopes } = await req.json();
    if (!contact_id) throw new Error("contact_id required");

    // 1. Fetch contact info
    const { data: contact, error: contactErr } = await supabase
      .from("people_contacts")
      .select("*")
      .eq("id", contact_id)
      .eq("user_id", user.id)
      .single();

    if (contactErr || !contact) throw new Error("Contact not found");

    // Determine scopes to analyze
    const scopes: string[] = requestedScopes && Array.isArray(requestedScopes) && requestedScopes.length > 0
      ? requestedScopes
      : contact.categories && Array.isArray(contact.categories) && contact.categories.length > 0
        ? contact.categories
        : [contact.category || 'profesional'];

    const contactName = contact.name.toLowerCase();
    const contactFirstName = contactName.split(" ")[0];

    // 2. Fetch messages (800 most recent, with date and direction)
    const { data: messages } = await supabase
      .from("contact_messages")
      .select("sender, content, direction, message_date, chat_name")
      .eq("contact_id", contact_id)
      .eq("user_id", user.id)
      .order("message_date", { ascending: false })
      .limit(800);

    // 3. Fetch transcriptions mentioning contact
    const { data: transcriptions } = await supabase
      .from("conversation_embeddings")
      .select("summary, content, date, brain, people")
      .eq("user_id", user.id)
      .limit(200);

    const relevantTranscriptions = (transcriptions || []).filter((t: any) => {
      const people = t.people || [];
      return people.some((p: string) => p.toLowerCase().includes(contactFirstName)) ||
        (t.content || "").toLowerCase().includes(contactFirstName) ||
        (t.summary || "").toLowerCase().includes(contactFirstName);
    });

    // 4. Fetch emails
    const { data: emails } = await supabase
      .from("jarvis_emails_cache")
      .select("subject, body_preview, from_address, received_at")
      .or(`from_address.ilike.%${contactFirstName}%,subject.ilike.%${contactFirstName}%`)
      .eq("user_id", user.id)
      .order("received_at", { ascending: false })
      .limit(50);

    // 5. Fetch existing commitments related to contact
    const { data: commitments } = await supabase
      .from("commitments")
      .select("description, commitment_type, status, deadline, person_name")
      .eq("user_id", user.id)
      .or(`person_name.ilike.%${contactFirstName}%,description.ilike.%${contactFirstName}%`)
      .limit(30);

    // 6. Pre-calculate exact metrics
    const metrics = preCalculateMetrics(messages || [], contact.name);

    // 7. Build shared context strings
    const messagesSummary = (messages || []).slice(0, 500).map((m: any) => {
      const date = m.message_date ? m.message_date.substring(0, 10) : '??';
      const dir = m.direction === 'outgoing' ? `Yo → ${contact.name.split(' ')[0]}` : `${m.sender || contact.name.split(' ')[0]} → Yo`;
      return `[${date} | ${dir}] ${m.content}`;
    }).join("\n");

    const transcriptionsSummary = relevantTranscriptions.slice(0, 10).map((t: any) =>
      `[Transcripción ${t.date}] ${t.summary || t.content?.substring(0, 500)}`
    ).join("\n\n");

    const emailsSummary = (emails || []).slice(0, 20).map((e: any) =>
      `[Email ${e.received_at?.substring(0, 10) || '??'}] De: ${e.from_address} | Asunto: ${e.subject} | ${e.body_preview?.substring(0, 200) || ''}`
    ).join("\n");

    const commitmentsSummary = (commitments || []).map((c: any) =>
      `[${c.commitment_type}] ${c.description} — Estado: ${c.status} — Deadline: ${c.deadline || 'sin fecha'}`
    ).join("\n");

    const metricsBlock = `
## MÉTRICAS PRE-CALCULADAS (usar estos datos TAL CUAL, NO inventar ni aproximar)
- Mensajes totales últimos 30 días: ${metrics.total_30d}
- Mensajes 30-60 días atrás: ${metrics.total_prev_30d}
- Media semanal actual: ${metrics.media_semanal_actual} msgs/semana
- Media semanal mes anterior: ${metrics.media_semanal_anterior} msgs/semana
- Tendencia: ${metrics.tendencia} (${metrics.tendencia_pct > 0 ? '+' : ''}${metrics.tendencia_pct}%)
- Ratio iniciativa: Usuario ${metrics.ratio_iniciativa_usuario}% — Contacto ${metrics.ratio_iniciativa_contacto}%
- Día más activo: ${metrics.dia_mas_activo}
- Horario habitual: ${metrics.horario_habitual}
- Canales: ${metrics.canales.join(', ')}
- Último contacto: ${metrics.ultimo_contacto}
`;

    // 8. Loop through scopes and generate analysis for each
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const profileByScope: Record<string, any> = {};

    for (const ambito of scopes) {
      const scopeLayer = getLayerByScope(ambito);

      // Build prohibited content list per scope
      const prohibitedContent: Record<string, string> = {
        profesional: '',
        personal: `
CONTENIDO PROHIBIDO en ámbito personal (si aparece alguna de estas palabras en tu análisis, BÓRRALO):
- Nombres de empresas como proyectos: AICOX, WIBEX, MediaPRO, CFMOTO
- Presupuestos de proyectos empresariales, deadlines de entregas, pipeline de oportunidades
- Reuniones de trabajo, calls profesionales, propuestas comerciales
- Arabia Saudí como proyecto, entregables, facturación empresarial
Si un campo queda vacío por falta de datos personales, escribe un insight honesto: "La relación se ha profesionalizado significativamente..."`,
        familiar: `
CONTENIDO PROHIBIDO en ámbito familiar (si aparece alguna de estas palabras en tu análisis, BÓRRALO):
- Proyectos empresariales, presupuestos de negocio, pipeline, oportunidades comerciales
- Reuniones de trabajo, deadlines, entregas profesionales
- Temas de amistad no familiar: quedadas con amigos, humor entre colegas
Si un campo queda vacío por falta de datos familiares, escribe un insight honesto explicando la situación.`,
      };

      const prompt = `## ⚠️ FILTRO OBLIGATORIO — LEER ANTES QUE NADA ⚠️

Este análisis es EXCLUSIVAMENTE para el ámbito "${ambito}".
REGLA ABSOLUTA: Cada campo del JSON debe contener SOLO información del ámbito "${ambito}".
ANTES de escribir cualquier campo, pregúntate: ¿este contenido pertenece al ámbito ${ambito}? Si NO, EXCLÚYELO.
Es MEJOR un análisis corto y honesto que uno largo con datos del ámbito equivocado.
${prohibitedContent[ambito] || ''}

## DATOS DEL CONTACTO
- Nombre: ${contact.name}
- Ámbito actual de análisis: ${ambito}
- Rol: ${contact.role || 'No especificado'}
- Empresa: ${contact.company || 'No especificada'}
- Cerebro/Categoría: ${contact.brain || 'No clasificado'}
- Contexto existente: ${contact.context || 'Sin contexto previo'}
- Total mensajes WA: ${contact.wa_message_count || 0}

## MENSAJES DE WHATSAPP (con fechas y dirección)
${messagesSummary || '(Sin mensajes disponibles)'}

## TRANSCRIPCIONES DE CONVERSACIONES PRESENCIALES (PLAUD)
${transcriptionsSummary || '(Sin transcripciones)'}

## EMAILS
${emailsSummary || '(Sin emails)'}

## COMPROMISOS YA REGISTRADOS
${commitmentsSummary || '(Sin compromisos previos)'}

${metricsBlock}

${COMMON_EXTRACTION}

${scopeLayer}

## REGLAS ESTRICTAS DE ALERTAS — MUY IMPORTANTE

1. Las alertas son SIEMPRE sobre el CONTACTO, no sobre el usuario.
2. Si el USUARIO dice algo sobre sí mismo ("estoy sobresaturado", "duermo 4h"), eso NO es una alerta del contacto. Es contexto del usuario.
3. Si el CONTACTO dice algo sobre su propio estado ("estoy con fiebre", "me siento ansioso"), SÍ es una alerta sobre el contacto.
4. Si el CONTACTO observa algo sobre el usuario ("te veo cansado"), es una OBSERVACIÓN, no una alerta de salud del contacto.
5. Cada alerta DEBE llevar etiqueta:
   - tipo: "contacto" → si la alerta es sobre el estado/situación del contacto
   - tipo: "observacion" → si es algo que el contacto comenta/observa sobre el usuario o sobre la relación
6. NUNCA generes alertas sobre el estado del USUARIO como si fueran del contacto.

## RED DE CONTACTOS DE SEGUNDO NIVEL

Busca en los mensajes TODAS las personas que el contacto menciona (nombres propios de terceros). Para cada persona mencionada, extrae:
- nombre: nombre de la persona
- contexto: qué rol o relación tiene con el contacto. Si NO hay contexto suficiente, pon "Sin contexto suficiente — solo aparece en [tipo de mención]"
- fecha_mencion: fecha aproximada de cuándo se menciona
- relacion: tipo de relación SI HAY EVIDENCIA CLARA en los mensajes. Si solo tienes una mención de un nombre en una felicitación de cumpleaños o mención casual, usa "no_determinada". NUNCA uses "familiar", "amigo" ni "otro" sin evidencia EXPLÍCITA en los mensajes. Es mejor "no_determinada" que inventar.
- posible_match: true si el nombre coincide potencialmente con otro contacto conocido del usuario. false en caso contrario.

## MÉTRICAS SEGMENTADAS POR ÁMBITO

Estima qué proporción de los mensajes corresponde a cada ámbito (profesional, personal, familiar) basándote en su contenido.
Incluye en metricas_comunicacion un campo "mensajes_ambito" con:
- total: número estimado de mensajes de ESTE ámbito en los últimos 30 días
- porcentaje: porcentaje sobre el total de mensajes
- media_semanal: media semanal filtrada solo para este ámbito

IMPORTANTE: Si detectas que la proporción de mensajes personales ha bajado significativamente (ej: antes era 40% y ahora es 10%), genera una alerta amarilla de "Profesionalización de la relación".

## EVOLUCIÓN TEMPORAL

Genera una sección de evolución reciente que muestre:
- hace_1_mes: estado de la relación hace ~30 días (basado en mensajes de esa época)
- hace_1_semana: estado de la relación hace ~7 días
- hoy: estado actual
- tendencia_general: "mejorando" | "estable" | "deteriorandose"

## REGLAS GENERALES ESTRICTAS

1. NUNCA generes análisis genéricos. Cada insight DEBE estar respaldado por contenido REAL de los mensajes.
2. NUNCA inventes información. Si no hay datos para un campo, pon "Datos insuficientes".
3. SIEMPRE cita ejemplos concretos con fechas.
4. SIEMPRE prioriza los últimos 30 días.
5. SIEMPRE termina con acciones pendientes CONCRETAS con fecha sugerida.
6. La fecha de hoy es: ${new Date().toISOString().split('T')[0]}
7. Para métricas de comunicación, usa EXACTAMENTE los datos pre-calculados proporcionados. No redondees ni aproximes.
8. Recuerda: FILTRA por ámbito. Si estás en ámbito "personal", no incluyas proyectos de negocio en situación_actual, datos_clave, ni patrones.

## FORMATO DE SALIDA — JSON EXACTO

Responde SOLO con este JSON (sin markdown, sin explicaciones):

{
  "ambito": "${ambito}",
  "ultima_interaccion": { "fecha": "YYYY-MM-DD", "canal": "whatsapp|email|presencial|llamada" },
  "estado_relacion": { "emoji": "emoji apropiado", "descripcion": "descripción breve basada en datos reales FILTRADA al ámbito ${ambito}" },
  "datos_clave": [
    { "dato": "texto concreto extraído de conversaciones SOLO del ámbito ${ambito}", "fuente": "WhatsApp DD/MM o Plaud DD/MM o Email DD/MM", "tipo": "empresa|salud|familia|personal|finanzas|proyecto|evento" }
  ],
  "situacion_actual": "2-3 frases con hechos concretos del estado actual SOLO del ámbito ${ambito}, citando fechas. Si hay pocos datos para este ámbito, dilo honestamente.",
  "evolucion_reciente": {
    "hace_1_mes": "estado de la relación hace 30 días",
    "hace_1_semana": "estado de la relación hace 7 días",
    "hoy": "estado actual",
    "tendencia_general": "mejorando|estable|deteriorandose"
  },
  "metricas_comunicacion": {
    "total_mensajes_30d": ${metrics.total_30d},
    "media_semanal_actual": ${metrics.media_semanal_actual},
    "media_semanal_anterior": ${metrics.media_semanal_anterior},
    "tendencia_pct": ${metrics.tendencia_pct},
    "tendencia": "${metrics.tendencia}",
    "ratio_iniciativa": { "usuario": ${metrics.ratio_iniciativa_usuario}, "contacto": ${metrics.ratio_iniciativa_contacto} },
    "dia_mas_activo": "${metrics.dia_mas_activo}",
    "horario_habitual": "${metrics.horario_habitual}",
    "ultimo_contacto": "${metrics.ultimo_contacto}",
    "canales": ${JSON.stringify(metrics.canales)},
    "mensajes_ambito": {
      "total": "número estimado de mensajes de este ámbito en 30d (DEBE ser un número entero, no texto)",
      "porcentaje": "porcentaje sobre total (DEBE ser un número entero, no texto)",
      "media_semanal": "media semanal filtrada (DEBE ser un número, no texto)"
    },
    "distribucion_ambitos": {
      "profesional_pct": "porcentaje estimado de mensajes profesionales (número entero)",
      "personal_pct": "porcentaje estimado de mensajes personales (número entero)",
      "familiar_pct": "porcentaje estimado de mensajes familiares (número entero)"
    }
  },
  "patrones_detectados": [
    { "emoji": "🟢|🟡|🔴", "patron": "nombre del patrón", "evidencia": "texto concreto con fecha como prueba", "nivel": "verde|amarillo|rojo" }
  ],
  "alertas": [
    { "nivel": "rojo|amarillo", "tipo": "contacto|observacion", "texto": "descripción con evidencia concreta" }
  ],
  "red_contactos_mencionados": [
    { "nombre": "nombre persona", "contexto": "rol o relación (o 'Sin contexto suficiente')", "fecha_mencion": "DD/MM", "relacion": "colega|familiar|socio|amigo|decisor|no_determinada", "posible_match": false }
  ],
  "acciones_pendientes": [
    { "accion": "descripción concreta de la acción", "origen": "mensaje/fecha donde se mencionó", "fecha_sugerida": "YYYY-MM-DD" }
  ],
  "proxima_accion": {
    "que": "descripción de qué hacer",
    "canal": "whatsapp|email|presencial|llamada",
    "cuando": "fecha o periodo sugerido",
    "pretexto": "tema concreto para abrir conversación"
  }${ambito === 'profesional' ? `,
  "pipeline": { "oportunidades": [{"descripcion": "...", "estado": "activa|fria|cerrada"}], "probabilidad_cierre": "alta|media|baja" }` : ''}${ambito === 'personal' ? `,
  "termometro_relacion": "frio|tibio|calido|fuerte",
  "reciprocidad": { "usuario_inicia": ${metrics.ratio_iniciativa_usuario}, "contacto_inicia": ${metrics.ratio_iniciativa_contacto}, "evaluacion": "equilibrada|desequilibrada" },
  "gestiones_compartidas": [{ "descripcion": "...", "monto": "...", "origen": "WhatsApp DD/MM", "estado": "activo|resuelto|pendiente", "fecha_detectada": "DD/MM" }],
  "dinamica_relacion": { "tono": "humor|formal|cercano|tenso|neutro", "uso_humor": "frecuente|ocasional|raro", "temas_no_laborales": ["tema1"], "confianza_percibida": "alta|media|baja", "evidencia_confianza": "cita concreta del mensaje", "ultima_conversacion_personal": { "fecha": "DD/MM", "tema": "descripción" } }` : ''}${ambito === 'familiar' ? `,
  "bienestar": { "estado_emocional": "descripción", "necesidades": ["necesidad1"] },
  "coordinacion": [{ "tarea": "descripción", "responsable": "nombre" }],
  "desarrollo_bosco": { "hitos": [{"hito": "descripción", "fecha": "YYYY-MM-DD"}], "patrones_emocionales": ["patrón1"] }` : ''}
}`;

      const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8192,
          temperature: 0.3,
          system: `Eres un analista de inteligencia relacional para el ámbito "${ambito}".
REGLA CRÍTICA: Cada campo del JSON debe contener SOLO información del ámbito "${ambito}".
ANTES de escribir cualquier campo, verifica: ¿este contenido es de "${ambito}"? Si no lo es, EXCLÚYELO aunque dejes el campo vacío o con pocos datos.
Es MEJOR un análisis corto y honesto que uno largo con datos del ámbito equivocado.
Responde SIEMPRE en JSON válido. NUNCA uses markdown. NUNCA inventes datos — si no hay evidencia, di "Datos insuficientes".
Cada insight debe citar fechas y contenido real de los mensajes. Las alertas son SIEMPRE sobre el CONTACTO, nunca sobre el usuario. Etiqueta cada alerta con tipo "contacto" o "observacion".`,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error(`Claude error for scope ${ambito}:`, aiResponse.status, errText);
        throw new Error(`AI error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const textContent = aiData.content?.find((b: any) => b.type === "text");
      let profileText = textContent?.text || "";

      // Clean markdown if present
      if (profileText.startsWith("```json")) profileText = profileText.slice(7);
      if (profileText.startsWith("```")) profileText = profileText.slice(3);
      if (profileText.endsWith("```")) profileText = profileText.slice(0, -3);

      profileByScope[ambito] = JSON.parse(profileText.trim());
    }

    // 9. Save to people_contacts — store as { profesional: {...}, familiar: {...} }
    const { error: updateErr } = await supabase
      .from("people_contacts")
      .update({
        personality_profile: profileByScope,
        categories: scopes,
      })
      .eq("id", contact_id)
      .eq("user_id", user.id);

    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ success: true, profile: profileByScope, scopes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("contact-analysis error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
