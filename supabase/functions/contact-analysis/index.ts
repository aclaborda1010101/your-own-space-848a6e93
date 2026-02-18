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

### Métricas de comunicación (calcular de los mensajes)
- Frecuencia: mensajes/semana actual
- Ratio de iniciativa: quién escribe primero más a menudo (usuario vs contacto). Mira quién inicia las conversaciones (primer mensaje tras un silencio de >4 horas)
- Tendencia: creciente / estable / declive comparando los últimos 15 días con los 15 anteriores
- Último contacto: fecha exacta del último mensaje
- Canales usados: whatsapp, email, llamada, presencial

### Acciones pendientes
Busca activamente:
- Reuniones/citas mencionadas pendientes de confirmar
- Tareas comprometidas por cualquiera de las partes
- Seguimientos prometidos ("te confirmo", "te paso info", "te llamo")
- Información solicitada sin respuesta
`;

const PROFESSIONAL_LAYER = `
## CAPA PROFESIONAL — Extracción específica
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
- Intereses y hobbies mencionados
- Situación sentimental y familiar
- Planes de futuro (viajes, proyectos personales)
- Estado de ánimo predominante en conversaciones recientes
- Temas recurrentes de conversación
- Favores pedidos o hechos (en ambas direcciones)
- Eventos compartidos (cenas, viajes, actividades)

## Patrones personales a detectar
- 🔴 Distanciamiento: reducción drástica de frecuencia, respuestas frías o monosilábicas
- 🟡 Momento difícil: problemas de salud, rupturas, pérdidas, estrés
- 🟡 Reciprocidad desequilibrada: siempre inicia el usuario, contacto nunca propone planes
- 🟢 Confianza creciente: comparte temas más íntimos, pide consejo, se abre emocionalmente
- 🟡 Favor pendiente: alguien prometió algo y no lo ha cumplido (cualquier dirección)
- 🟢 Oportunidad social: contacto menciona evento, viaje o actividad donde podrías unirte
- 🟡 Cambio vital: nueva pareja, nuevo trabajo, mudanza, nacimiento
- 🟢 Fecha importante: cumpleaños, aniversarios mencionados

## Campos específicos personales a incluir en JSON
"termometro_relacion": "frio|tibio|calido|fuerte"
"reciprocidad": { "usuario_inicia": 70, "contacto_inicia": 30, "evaluacion": "equilibrada|desequilibrada" }
`;

const FAMILIAR_LAYER = `
## CAPA FAMILIAR — Extracción específica
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

    const { contact_id } = await req.json();
    if (!contact_id) throw new Error("contact_id required");

    // 1. Fetch contact info
    const { data: contact, error: contactErr } = await supabase
      .from("people_contacts")
      .select("*")
      .eq("id", contact_id)
      .eq("user_id", user.id)
      .single();

    if (contactErr || !contact) throw new Error("Contact not found");

    const ambito = contact.category || 'profesional';
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

    // 6. Build context with dates and direction
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

    const scopeLayer = getLayerByScope(ambito);

    const prompt = `Eres un analista experto en inteligencia relacional. Analiza TODA la información disponible sobre esta persona y genera un perfil exhaustivo ESPECÍFICO para el ámbito "${ambito}".

## DATOS DEL CONTACTO
- Nombre: ${contact.name}
- Ámbito: ${ambito}
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

${COMMON_EXTRACTION}

${scopeLayer}

## REGLAS ESTRICTAS — LEE ESTO ANTES DE RESPONDER

1. NUNCA generes análisis genéricos. Cada insight DEBE estar respaldado por contenido REAL de los mensajes. Si dices "hablan de temas cotidianos", CITA qué temas concretos con fecha.
2. NUNCA inventes información. Si no hay datos para un campo, pon "Datos insuficientes — se requieren más interacciones".
3. SIEMPRE cita ejemplos concretos con fechas: "El 15/01 Carlos mencionó que cambió de trabajo a Accenture".
4. SIEMPRE prioriza los últimos 30 días. Lo reciente pesa MÁS que lo antiguo.
5. SIEMPRE termina con acciones pendientes CONCRETAS con fecha sugerida.
6. La fecha de hoy es: ${new Date().toISOString().split('T')[0]}

## FORMATO DE SALIDA — JSON EXACTO

Responde SOLO con este JSON (sin markdown, sin explicaciones):

{
  "ambito": "${ambito}",
  "ultima_interaccion": { "fecha": "YYYY-MM-DD", "canal": "whatsapp|email|presencial|llamada" },
  "estado_relacion": { "emoji": "emoji apropiado", "descripcion": "descripción breve basada en datos reales" },
  "datos_clave": [
    { "dato": "texto concreto extraído de conversaciones", "fuente": "WhatsApp DD/MM o Plaud DD/MM o Email DD/MM", "tipo": "empresa|salud|familia|personal|finanzas|proyecto|evento" }
  ],
  "situacion_actual": "2-3 frases con hechos concretos del estado actual de la relación, citando fechas",
  "metricas_comunicacion": {
    "frecuencia": "X msgs/semana",
    "ratio_iniciativa": { "usuario": 60, "contacto": 40 },
    "tendencia": "creciente|estable|declive",
    "ultimo_contacto": "YYYY-MM-DD",
    "canales": ["whatsapp", "email"]
  },
  "patrones_detectados": [
    { "emoji": "🟢|🟡|🔴", "patron": "nombre del patrón", "evidencia": "texto concreto con fecha como prueba", "nivel": "verde|amarillo|rojo" }
  ],
  "alertas": [
    { "nivel": "rojo|amarillo", "texto": "descripción con evidencia concreta" }
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
  "reciprocidad": { "usuario_inicia": 70, "contacto_inicia": 30, "evaluacion": "equilibrada|desequilibrada" }` : ''}${ambito === 'familiar' ? `,
  "bienestar": { "estado_emocional": "descripción", "necesidades": ["necesidad1"] },
  "coordinacion": [{ "tarea": "descripción", "responsable": "nombre" }],
  "desarrollo_bosco": { "hitos": [{"hito": "descripción", "fecha": "YYYY-MM-DD"}], "patrones_emocionales": ["patrón1"] }` : ''}
}`;

    // 7. Call Claude API
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

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
        system: `Eres un analista experto en inteligencia relacional para el ámbito "${ambito}". Responde SIEMPRE en JSON válido. NUNCA uses markdown. NUNCA inventes datos — si no hay evidencia, di "Datos insuficientes". Cada insight debe citar fechas y contenido real de los mensajes.`,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Claude error:", aiResponse.status, errText);
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const textContent = aiData.content?.find((b: any) => b.type === "text");
    let profileText = textContent?.text || "";

    // Clean markdown if present
    if (profileText.startsWith("```json")) profileText = profileText.slice(7);
    if (profileText.startsWith("```")) profileText = profileText.slice(3);
    if (profileText.endsWith("```")) profileText = profileText.slice(0, -3);

    const profile = JSON.parse(profileText.trim());

    // 8. Save to people_contacts
    const { error: updateErr } = await supabase
      .from("people_contacts")
      .update({ personality_profile: profile })
      .eq("id", contact_id)
      .eq("user_id", user.id);

    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ success: true, profile }), {
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
