import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chat } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Programmatic duration calculation ──────────────────────────────────────────

function calculateDuration(firstDateStr: string): string {
  if (!firstDateStr || firstDateStr === 'desconocido') return 'sin datos';
  const match = firstDateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return 'sin datos';
  const firstDate = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  const now = new Date();
  if (isNaN(firstDate.getTime()) || firstDate > now) return 'sin datos';
  
  let years = now.getFullYear() - firstDate.getFullYear();
  let months = now.getMonth() - firstDate.getMonth();
  if (now.getDate() < firstDate.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  
  if (years === 0) {
    return months <= 1 ? '1 mes' : `${months} meses`;
  }
  if (months === 0) {
    return years === 1 ? '1 año' : `${years} años`;
  }
  return `${years} ${years === 1 ? 'año' : 'años'} y ${months} ${months === 1 ? 'mes' : 'meses'}`;
}

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
- Las métricas deben reflejar SOLO mensajes profesionales.
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

## DETECCIÓN DE ESTRÉS Y HUMANIDAD — PRIORIDAD SOBRE PIPELINE
Si detectas palabras como 'ansiedad', 'estrés', 'fiebre', 'agotamiento', 'no puedo más', 'quemado', 'saturado', 'enfermo', 'burnout', 'desbordado', 'agobio' en mensajes del contacto:
- Genera una ALERTA nivel "rojo" tipo "contacto" ANTES que cualquier alerta de negocio
- La proxima_accion debe ser EMPÁTICA (preguntar cómo está, ofrecer ayuda) ANTES de cualquier seguimiento comercial
- Patrón: 🔴 "Señal de estrés detectada" con evidencia textual y fecha del mensaje
- Esta regla tiene PRIORIDAD ABSOLUTA sobre el pipeline y las oportunidades de negocio

## Campos específicos profesionales a incluir en JSON
"pipeline": { "oportunidades": [{"descripcion": "...", "estado": "activa|fría|cerrada"}], "probabilidad_cierre": "alta|media|baja" }
`;

const PERSONAL_LAYER = `
## CAPA PERSONAL — Extracción específica

### REGLAS DE FILTRADO POR ÁMBITO — MUY IMPORTANTE
- Analiza SOLO el contenido PERSONAL: amistad, planes, quedadas, humor, intereses comunes, favores, gestiones administrativas compartidas (dinero no empresarial).
- IGNORA COMPLETAMENTE: proyectos de negocio, reuniones de trabajo, pipeline, presupuestos empresariales, deadlines de proyectos.
- Si hay pocos mensajes personales, dilo COMO INSIGHT HONESTO.
- NO rellenes con contenido profesional para que la vista parezca completa.

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

### DINÁMICA DE LA RELACIÓN — Extraer siempre en ámbito personal
Analiza CÓMO se hablan el usuario y el contacto:
- tono: "humor" | "formal" | "cercano" | "tenso" | "neutro"
- uso_humor: "frecuente" | "ocasional" | "raro"
- temas_no_laborales: lista de temas personales recurrentes
- confianza_percibida: "alta" | "media" | "baja"
- evidencia_confianza: cita concreta
- ultima_conversacion_personal: { fecha, tema }

## Patrones personales a detectar
- 🔴 Distanciamiento: reducción drástica de frecuencia
- 🟡 Momento difícil: problemas de salud, rupturas, pérdidas
- 🟡 Reciprocidad desequilibrada
- 🟢 Confianza creciente
- 🟡 Favor pendiente
- 🟢 Oportunidad social
- 🟡 Cambio vital
- 🟢 Fecha importante
- 🟡 Profesionalización de la relación

## Campos específicos personales a incluir en JSON
"termometro_relacion": "frio|tibio|calido|fuerte"
"reciprocidad": { "usuario_inicia": 70, "contacto_inicia": 30, "evaluacion": "equilibrada|desequilibrada" }
"gestiones_compartidas": [{ "descripcion": "...", "monto": "...", "origen": "WhatsApp DD/MM", "estado": "activo|resuelto|pendiente", "fecha_detectada": "DD/MM" }]
"dinamica_relacion": { "tono": "...", "uso_humor": "...", "temas_no_laborales": [], "confianza_percibida": "alta|media|baja", "evidencia_confianza": "cita", "ultima_conversacion_personal": { "fecha": "DD/MM", "tema": "..." } }
`;

const FAMILIAR_LAYER = `
## CAPA FAMILIAR — Extracción específica

### REGLAS DE FILTRADO POR ÁMBITO — MUY IMPORTANTE
- Analiza SOLO el contenido FAMILIAR: familia, hijos, parejas, padres, hermanos, salud familiar, coordinación, celebraciones, bienestar emocional.
- IGNORA COMPLETAMENTE: proyectos de negocio, reuniones de trabajo, temas de amistad no familiar, pipeline, presupuestos empresariales.

### ⚠️ REGLAS DE CLASIFICACIÓN FAMILIAR — CRÍTICO
- FAMILIAR solo si el mensaje HABLA SOBRE familia (hijos, pareja, padres, salud familiar).
- Los apodos cariñosos entre amigos (hermanito, gordo, negrito) son PERSONALES, NO familiares.
- Las expresiones de afecto ("te quiero", "te amo") entre amigos son PERSONALES, NO familiares.
- Un mensaje es FAMILIAR SOLO si menciona a un FAMILIAR CONCRETO o trata un TEMA FAMILIAR explícito.
- "Te quiero hermanito" → PERSONAL (apodo cariñoso entre amigos)
- "Gordo, ¿quedamos?" → PERSONAL (plan personal)
- "¿Te pasas a ver al peque?" → FAMILIAR ✅ (habla de hijo)
- "¿Cómo está Juany?" → FAMILIAR ✅ (pregunta por familiar)
- NO infles el porcentaje familiar incluyendo mensajes de amistad con apodos cariñosos.

### Datos familiares a extraer
- Estado emocional del familiar
- Necesidades expresadas
- Salud: médicos, síntomas, medicación
- Logros y progresos (especialmente niños: Bosco)
- Conflictos o tensiones
- Planes familiares
- Coordinación logística

## Patrones familiares a detectar
- 🔴 Necesidad no expresada
- 🟡 Tensión creciente
- 🔴 Desconexión
- 🟢 Hito del hijo
- 🟡 Salud familiar
- 🟡 Coordinación fallida
- 🟢 Momento positivo
- 🟡 Patrón emocional del hijo

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

  const media_semanal_actual = total_30d > 0 ? Math.round((total_30d / 4.3) * 10) / 10 : 0;
  const media_semanal_anterior = total_prev_30d > 0 ? Math.round((total_prev_30d / 4.3) * 10) / 10 : 0;

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
    if (gap > 4 * 60 * 60 * 1000) {
      if (msg.direction === 'outgoing') userInitiates++;
      else contactInitiates++;
    }
  }

  const totalInitiatives = userInitiates + contactInitiates;
  const ratio_iniciativa_usuario = totalInitiatives > 0 ? Math.round((userInitiates / totalInitiatives) * 100) : 50;
  const ratio_iniciativa_contacto = 100 - ratio_iniciativa_usuario;

  const dayCounts: Record<string, number> = {};
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  for (const m of msgs30d) {
    if (!m.message_date) continue;
    const day = dayNames[new Date(m.message_date).getDay()];
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  }
  const dia_mas_activo = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

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

  const canales = new Set<string>();
  canales.add('whatsapp');

  const ultimo_contacto = messages.length > 0 && messages[0].message_date
    ? messages[0].message_date.substring(0, 10)
    : 'N/A';

  return {
    total_30d, total_prev_30d, media_semanal_actual, media_semanal_anterior,
    tendencia_pct, tendencia, ratio_iniciativa_usuario, ratio_iniciativa_contacto,
    dia_mas_activo, horario_habitual, canales: Array.from(canales), ultimo_contacto,
  };
}

// ── Fetch ALL messages with pagination ──────────────────────────────────────────

async function fetchAllMessages(supabase: any, contactId: string, userId: string): Promise<any[]> {
  const allMessages: any[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("contact_messages")
      .select("sender, content, direction, message_date, chat_name")
      .eq("contact_id", contactId)
      .eq("user_id", userId)
      .order("message_date", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("Error fetching messages page:", error);
      break;
    }

    if (data && data.length > 0) {
      allMessages.push(...data);
      from += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  return allMessages;
}

// ── Historical analysis processing ─────────────────────────────────────────────

interface HistoricalAnalysis {
  primer_contacto: string;
  duracion_relacion: string;
  mensajes_totales: number;
  evolucion_anual: Array<{ ano: number; mensajes: number; periodo?: string; descripcion: string }>;
  hitos: Array<{ fecha: string; descripcion: string }>;
  temas_historicos: {
    profesional: string[];
    personal: string[];
    familiar: string[];
  };
  apodos_y_dinamicas: string[];
  resumen_narrativo: string;
  last_updated: string;
  last_message_date: string;
}

function splitIntoQuarterlyBlocks(messages: any[]): any[][] {
  if (messages.length === 0) return [];

  // Step 1: Split strictly by quarter
  const quarterMap = new Map<string, any[]>();
  const noDateMsgs: any[] = [];

  for (const msg of messages) {
    if (!msg.message_date) { noDateMsgs.push(msg); continue; }
    const d = new Date(msg.message_date);
    const q = `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3)}`;
    if (!quarterMap.has(q)) quarterMap.set(q, []);
    quarterMap.get(q)!.push(msg);
  }

  // Distribute no-date messages into the first quarter
  if (noDateMsgs.length > 0) {
    const firstKey = quarterMap.keys().next().value;
    if (firstKey) quarterMap.get(firstKey)!.unshift(...noDateMsgs);
    else quarterMap.set('unknown', noDateMsgs);
  }

  // Step 2: Subdivide large quarters into chunks of max 800 messages
  const MAX_CHUNK = 800;
  const chunks: any[][] = [];
  for (const [, qMsgs] of quarterMap) {
    if (qMsgs.length <= MAX_CHUNK) {
      chunks.push(qMsgs);
    } else {
      for (let i = 0; i < qMsgs.length; i += MAX_CHUNK) {
        chunks.push(qMsgs.slice(i, i + MAX_CHUNK));
      }
    }
  }

  // Step 3: Merge very small consecutive chunks (< 100 msgs) to avoid too many API calls
  const merged: any[][] = [];
  for (const chunk of chunks) {
    if (merged.length > 0 && merged[merged.length - 1].length + chunk.length <= MAX_CHUNK) {
      merged[merged.length - 1].push(...chunk);
    } else {
      merged.push(chunk);
    }
  }

  return merged;
}

async function processHistoricalAnalysis(
  supabase: any,
  contactId: string,
  userId: string,
  contactName: string,
  existingAnalysis: HistoricalAnalysis | null
): Promise<HistoricalAnalysis> {
  // Fetch ALL messages
  const allMessages = await fetchAllMessages(supabase, contactId, userId);
  if (allMessages.length === 0) {
    return {
      primer_contacto: 'desconocido',
      duracion_relacion: 'sin datos',
      mensajes_totales: 0,
      evolucion_anual: [],
      hitos: [],
      temas_historicos: { profesional: [], personal: [], familiar: [] },
      apodos_y_dinamicas: [],
      resumen_narrativo: 'Sin mensajes disponibles para análisis histórico.',
      last_updated: new Date().toISOString(),
      last_message_date: '',
    };
  }

  const totalMessages = allMessages.length;
  const lastMessageDate = allMessages[allMessages.length - 1]?.message_date || '';

  // If we have existing analysis and it's recent, only process new messages
  if (existingAnalysis && existingAnalysis.last_message_date) {
    // Detect incomplete analysis: if stored count differs >20% from real count, force full reprocess
    const prevTotal = existingAnalysis.mensajes_totales || 0;
    const diffPct = totalMessages > 0 ? Math.abs(totalMessages - prevTotal) / totalMessages : 0;
    if (diffPct > 0.2) {
      console.log(`Historical analysis INCOMPLETE detected for ${contactName}: stored ${prevTotal} vs real ${totalMessages} (diff ${(diffPct * 100).toFixed(1)}%). Forcing full reprocess.`);
      // Fall through to full analysis below
    } else {
      const lastProcessed = new Date(existingAnalysis.last_message_date);
      const daysSinceUpdate = (Date.now() - new Date(existingAnalysis.last_updated).getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceUpdate < 30) {
        // Just update the total count
        return { ...existingAnalysis, mensajes_totales: totalMessages, last_message_date: lastMessageDate };
      }

      // Process only new messages since last analysis
      const newMessages = allMessages.filter(m => m.message_date && new Date(m.message_date) > lastProcessed);
      if (newMessages.length > 0) {
        return await updateHistoricalWithNewMessages(existingAnalysis, newMessages, contactName, totalMessages, lastMessageDate);
      }
      return { ...existingAnalysis, mensajes_totales: totalMessages };
    }
  }

  // Full historical analysis — first time
  const blocks = splitIntoQuarterlyBlocks(allMessages);
  console.log(`Historical analysis: ${totalMessages} messages in ${blocks.length} blocks for ${contactName}`);

  let progressiveSummary = '';

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const firstDate = block[0]?.message_date?.substring(0, 10) || '??';
    const lastDate = block[block.length - 1]?.message_date?.substring(0, 10) || '??';

    const blockText = block.map((m: any) => {
      const date = m.message_date ? m.message_date.substring(0, 10) : '??';
      const dir = m.direction === 'outgoing' ? '→' : '←';
      const content = (m.content || '').substring(0, 80).replace(/\n/g, ' ');
      return `[${date}] ${dir} ${content}`;
    }).join("\n");

    const blockPrompt = `Analiza este bloque de mensajes (${firstDate} a ${lastDate}, ${block.length} msgs) entre el usuario y "${contactName}".

${progressiveSummary ? `## RESUMEN ACUMULADO DE BLOQUES ANTERIORES\n${progressiveSummary}\n` : ''}

## MENSAJES DEL BLOQUE ${i + 1}/${blocks.length}
${blockText.substring(0, 40000)}

Genera un resumen progresivo que incluya:
1. Temas principales de este periodo
2. Hitos o eventos clave con fechas
3. Personas mencionadas y su contexto
4. Evolución del tono/dinámica de la relación
5. Proyectos o actividades que empiezan/terminan
6. Apodos o dinámicas recurrentes

IMPORTANTE: Integra con el resumen acumulado anterior si existe. No repitas info, añade lo nuevo.
Responde en texto plano, NO JSON. Máximo 1500 palabras.`;

    try {
      progressiveSummary = await chat(
        [{ role: "system", content: "Eres un analista de relaciones. Resume conversaciones de forma precisa, citando fechas y hechos concretos." },
         { role: "user", content: blockPrompt }],
        { model: "gemini-flash", temperature: 0.3, maxTokens: 2048 }
      );
      console.log(`Block ${i + 1}/${blocks.length} completed for ${contactName} (${firstDate} to ${lastDate}, ${block.length} msgs). Summary length: ${progressiveSummary.length} chars`);
    } catch (err) {
      console.error(`Error processing block ${i + 1}/${blocks.length} for ${contactName}:`, err);
      // Continue with what we have
    }
  }

  // Final consolidation with structured output
  const consolidationPrompt = `Basándote en este resumen completo de la relación entre el usuario y "${contactName}" (${totalMessages} mensajes totales), genera un análisis histórico estructurado.

## RESUMEN COMPLETO
${progressiveSummary}

## DATOS
- Primer mensaje: ${allMessages[0]?.message_date?.substring(0, 10) || '??'}
- Último mensaje: ${lastMessageDate.substring(0, 10)}
- Total mensajes: ${totalMessages}

IMPORTANTE: La sección "evolucion_anual" DEBE incluir TODOS los años desde el primer mensaje hasta el último, sin omitir ninguno. Los datos exactos de mensajes por año están al final de este prompt — úsalos obligatoriamente.

Responde SOLO con este JSON:
{
  "primer_contacto": "YYYY-MM-DD",
  "duracion_relacion": "X años y Y meses",
  "mensajes_totales": ${totalMessages},
  "evolucion_anual": [
    { "ano": 2022, "mensajes": 0, "periodo": "jul-dic", "descripcion": "..." }
  ],
  "hitos": [
    { "fecha": "YYYY-MM-DD o mes YYYY", "descripcion": "..." }
  ],
  "temas_historicos": {
    "profesional": ["tema1: detalle breve"],
    "personal": ["tema1: detalle breve"],
    "familiar": ["tema1: detalle breve"]
  },
  "apodos_y_dinamicas": ["apodo/dinámica con contexto"],
  "resumen_narrativo": "Párrafo de 3-5 frases resumiendo la evolución de la relación desde el inicio hasta hoy"
}`;

  try {
    // Count messages per year for the consolidation
    const yearCounts: Record<number, number> = {};
    for (const m of allMessages) {
      if (!m.message_date) continue;
      const year = new Date(m.message_date).getFullYear();
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    }

    const resultText = await chat(
      [{ role: "system", content: "Eres un analista de relaciones. Responde SOLO con JSON válido." },
       { role: "user", content: consolidationPrompt + `\n\nDATOS EXACTOS mensajes por año: ${JSON.stringify(yearCounts)}` }],
      { model: "gemini-flash", temperature: 0.2, maxTokens: 4096, responseFormat: "json" }
    );

    const result = JSON.parse(resultText) as HistoricalAnalysis;
    result.last_updated = new Date().toISOString();
    result.last_message_date = lastMessageDate;
    result.mensajes_totales = totalMessages;
    
    // Programmatic duration override — never trust the AI's calculation
    if (!result.primer_contacto || result.primer_contacto === 'desconocido') {
      result.primer_contacto = allMessages[0]?.message_date?.substring(0, 10) || 'desconocido';
    }
    result.duracion_relacion = calculateDuration(result.primer_contacto);
    
    return result;
  } catch (err) {
    console.error("Error in historical consolidation:", err);
    return {
      primer_contacto: allMessages[0]?.message_date?.substring(0, 10) || 'desconocido',
      duracion_relacion: 'error en análisis',
      mensajes_totales: totalMessages,
      evolucion_anual: [],
      hitos: [],
      temas_historicos: { profesional: [], personal: [], familiar: [] },
      apodos_y_dinamicas: [],
      resumen_narrativo: progressiveSummary.substring(0, 500),
      last_updated: new Date().toISOString(),
      last_message_date: lastMessageDate,
    };
  }
}

async function updateHistoricalWithNewMessages(
  existing: HistoricalAnalysis,
  newMessages: any[],
  contactName: string,
  totalMessages: number,
  lastMessageDate: string
): Promise<HistoricalAnalysis> {
  const newMsgsText = newMessages.slice(0, 3000).map((m: any) => {
    const date = m.message_date ? m.message_date.substring(0, 10) : '??';
    const dir = m.direction === 'outgoing' ? 'Yo' : (m.sender || contactName.split(' ')[0]);
    return `[${date}] ${dir}: ${m.content}`;
  }).join("\n");

  const prompt = `Actualiza este análisis histórico con ${newMessages.length} mensajes nuevos.

## ANÁLISIS HISTÓRICO EXISTENTE
${JSON.stringify(existing, null, 2)}

## MENSAJES NUEVOS
${newMsgsText}

Actualiza el JSON manteniendo toda la info existente y añadiendo lo nuevo. Responde SOLO con el JSON actualizado completo (mismo formato).`;

  try {
    const resultText = await chat(
      [{ role: "system", content: "Actualiza el análisis histórico. Responde SOLO con JSON válido." },
       { role: "user", content: prompt }],
      { model: "gemini-flash", temperature: 0.2, maxTokens: 4096, responseFormat: "json" }
    );

    const result = JSON.parse(resultText) as HistoricalAnalysis;
    result.last_updated = new Date().toISOString();
    result.last_message_date = lastMessageDate;
    result.mensajes_totales = totalMessages;
    
    // Protect primer_contacto: never let the AI overwrite the original
    result.primer_contacto = existing.primer_contacto || result.primer_contacto;
    result.duracion_relacion = calculateDuration(result.primer_contacto);
    
    return result;
  } catch {
    // Also fix duration on fallback path
    const fixed = { ...existing, mensajes_totales: totalMessages, last_updated: new Date().toISOString(), last_message_date: lastMessageDate };
    fixed.duracion_relacion = calculateDuration(fixed.primer_contacto);
    return fixed;
  }
}

// ── Global distribution classification ─────────────────────────────────────────

interface GlobalDistribution {
  profesional_pct: number;
  personal_pct: number;
  familiar_pct: number;
}

async function classifyGlobalDistribution(
  messagesSample: string,
  contactName: string
): Promise<GlobalDistribution> {
  const prompt = `Clasifica los mensajes entre el usuario y "${contactName}" en tres ámbitos: profesional, personal, familiar.

## REGLAS DE CLASIFICACIÓN FAMILIAR — CRÍTICO
- FAMILIAR solo si el mensaje HABLA SOBRE familia (hijos, pareja, padres, salud familiar).
- Los apodos cariñosos entre amigos (hermanito, gordo, negrito) son PERSONALES, NO familiares.
- Las expresiones de afecto ("te quiero", "te amo") entre amigos son PERSONALES.
- Un mensaje es FAMILIAR SOLO si menciona a un FAMILIAR CONCRETO o trata un TEMA FAMILIAR.
- Quedar, hacer planes, bromas = PERSONAL.
- Proyectos, negocios, entregas = PROFESIONAL.

## MENSAJES A CLASIFICAR
${messagesSample}

Responde SOLO con este JSON:
{ "profesional_pct": 70, "personal_pct": 25, "familiar_pct": 5 }

Los tres deben sumar 100. Sé estricto con la categoría familiar.`;

  try {
    const result = await chat(
      [{ role: "system", content: "Clasificador de mensajes. Responde SOLO con JSON." },
       { role: "user", content: prompt }],
      { model: "gemini-flash", temperature: 0.1, maxTokens: 256, responseFormat: "json" }
    );
    const parsed = JSON.parse(result);
    // Normalize to ensure sum = 100
    const total = (parsed.profesional_pct || 0) + (parsed.personal_pct || 0) + (parsed.familiar_pct || 0);
    if (total > 0 && total !== 100) {
      parsed.profesional_pct = Math.round((parsed.profesional_pct / total) * 100);
      parsed.personal_pct = Math.round((parsed.personal_pct / total) * 100);
      parsed.familiar_pct = 100 - parsed.profesional_pct - parsed.personal_pct;
    }
    return parsed;
  } catch {
    return { profesional_pct: 60, personal_pct: 35, familiar_pct: 5 };
  }
}

// ── Post-process: unify red_contactos_mencionados across scopes ────────────────

function unifyMentionedContacts(profileByScope: Record<string, any>): void {
  // Collect all mentioned contacts from all scopes
  const allMentioned: Map<string, any> = new Map();

  for (const [scope, profile] of Object.entries(profileByScope)) {
    const red = profile?.red_contactos_mencionados;
    if (!Array.isArray(red)) continue;

    for (const person of red) {
      const key = person.nombre?.toLowerCase()?.trim();
      if (!key) continue;

      const existing = allMentioned.get(key);
      if (!existing) {
        allMentioned.set(key, {
          ...person,
          contexto_por_ambito: { [scope]: person.contexto },
          scopes_mencionado: [scope],
        });
      } else {
        // Merge: keep the richer context
        if (person.contexto && (!existing.contexto || existing.contexto.includes('no determinada') || existing.contexto.includes('Sin contexto'))) {
          existing.contexto = person.contexto;
        }
        if (person.relacion && person.relacion !== 'no_determinada' && existing.relacion === 'no_determinada') {
          existing.relacion = person.relacion;
        }
        existing.contexto_por_ambito[scope] = person.contexto;
        if (!existing.scopes_mencionado.includes(scope)) {
          existing.scopes_mencionado.push(scope);
        }
        if (person.posible_match) existing.posible_match = true;
        allMentioned.set(key, existing);
      }
    }
  }

  // Write back unified list — only show in scopes where actually mentioned
  for (const [scope, profile] of Object.entries(profileByScope)) {
    const unifiedForScope = Array.from(allMentioned.values())
      .filter(p => p.scopes_mencionado.includes(scope))
      .map(p => ({
        nombre: p.nombre,
        contexto: p.contexto,
        fecha_mencion: p.fecha_mencion,
        relacion: p.relacion,
        posible_match: p.posible_match,
        contexto_en_este_ambito: p.contexto_por_ambito[scope] || null,
      }));
    profile.red_contactos_mencionados = unifiedForScope;
  }
}

// ── Main handler ───────────────────────────────────────────────────────────────

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

    const { contact_id, scopes: requestedScopes, include_historical } = await req.json();
    if (!contact_id) throw new Error("contact_id required");

    // 1. Fetch contact info
    const { data: contact, error: contactErr } = await supabase
      .from("people_contacts")
      .select("*")
      .eq("id", contact_id)
      .eq("user_id", user.id)
      .single();

    if (contactErr || !contact) throw new Error("Contact not found");

    const scopes: string[] = requestedScopes && Array.isArray(requestedScopes) && requestedScopes.length > 0
      ? requestedScopes
      : contact.categories && Array.isArray(contact.categories) && contact.categories.length > 0
        ? contact.categories
        : [contact.category || 'profesional'];

    const contactName = contact.name.toLowerCase();
    const contactFirstName = contactName.split(" ")[0];

    // 2. Historical analysis (Problem 1)
    let historicalAnalysis: HistoricalAnalysis | null = (contact as any).historical_analysis as HistoricalAnalysis | null;

    if (include_historical || !historicalAnalysis) {
      console.log(`Processing historical analysis for ${contact.name}...`);
      historicalAnalysis = await processHistoricalAnalysis(
        supabase, contact_id, user.id, contact.name, historicalAnalysis
      );

      // Save historical analysis immediately
      await supabase
        .from("people_contacts")
        .update({ historical_analysis: historicalAnalysis })
        .eq("id", contact_id)
        .eq("user_id", user.id);

      console.log(`Historical analysis saved for ${contact.name}`);
    }

    // 3. Fetch recent messages (800 most recent for 30-day analysis)
    const { data: messages } = await supabase
      .from("contact_messages")
      .select("sender, content, direction, message_date, chat_name")
      .eq("contact_id", contact_id)
      .eq("user_id", user.id)
      .order("message_date", { ascending: false })
      .limit(800);

    // 4. Fetch transcriptions mentioning contact
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

    // 5. Fetch emails
    const { data: emails } = await supabase
      .from("jarvis_emails_cache")
      .select("subject, body_preview, from_address, received_at")
      .or(`from_address.ilike.%${contactFirstName}%,subject.ilike.%${contactFirstName}%`)
      .eq("user_id", user.id)
      .order("received_at", { ascending: false })
      .limit(50);

    // 6. Fetch existing commitments
    const { data: commitments } = await supabase
      .from("commitments")
      .select("description, commitment_type, status, deadline, person_name")
      .eq("user_id", user.id)
      .or(`person_name.ilike.%${contactFirstName}%,description.ilike.%${contactFirstName}%`)
      .limit(30);

    // 7. Fetch user's known contacts for linking (Problem 4)
    const { data: knownContacts } = await supabase
      .from("people_contacts")
      .select("id, name, relationship, category, categories")
      .eq("user_id", user.id)
      .neq("id", contact_id)
      .limit(500);

    const knownContactsList = (knownContacts || []).map((c: any) =>
      `- ${c.name} (${c.relationship || c.category || 'sin categoría'})`
    ).join("\n");

    // 8. Pre-calculate exact metrics
    const metrics = preCalculateMetrics(messages || [], contact.name);

    // 9. Build shared context strings
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

    // 10. Global distribution classification (Problem 2 + Problem 5)
    const sampleForClassification = (messages || []).slice(0, 200).map((m: any) => {
      const date = m.message_date ? m.message_date.substring(0, 10) : '??';
      return `[${date}] ${m.content}`;
    }).join("\n");

    const globalDistribution = await classifyGlobalDistribution(sampleForClassification, contact.name);
    console.log(`Global distribution for ${contact.name}:`, globalDistribution);

    // 11. Build historical context for injection into 30-day analysis
    const historicalContext = historicalAnalysis ? `
## CONTEXTO HISTÓRICO DE LA RELACIÓN (usar para enriquecer el análisis actual)
- Primer contacto: ${historicalAnalysis.primer_contacto}
- Duración: ${historicalAnalysis.duracion_relacion}
- Mensajes totales históricos: ${historicalAnalysis.mensajes_totales}
- Resumen: ${historicalAnalysis.resumen_narrativo}
- Hitos clave: ${(historicalAnalysis.hitos || []).map(h => `${h.fecha}: ${h.descripcion}`).join('; ')}
- Apodos/dinámicas: ${(historicalAnalysis.apodos_y_dinamicas || []).join(', ')}
- Temas profesionales históricos: ${(historicalAnalysis.temas_historicos?.profesional || []).join(', ')}
- Temas personales históricos: ${(historicalAnalysis.temas_historicos?.personal || []).join(', ')}
- Temas familiares históricos: ${(historicalAnalysis.temas_historicos?.familiar || []).join(', ')}

IMPORTANTE: Usa este contexto para que la "situacion_actual" haga REFERENCIA a la historia. En vez de solo describir el último mes, contextualiza: "Relación de X años que ha evolucionado de... a... En el último mes..."
` : '';

    // 12. Loop through scopes and generate analysis for each
    const profileByScope: Record<string, any> = {};

    for (const ambito of scopes) {
      const scopeLayer = getLayerByScope(ambito);

      const prohibitedContent: Record<string, string> = {
        profesional: '',
        personal: `
CONTENIDO PROHIBIDO en ámbito personal:
- Nombres de empresas como proyectos: AICOX, WIBEX, MediaPRO, CFMOTO
- Presupuestos de proyectos empresariales, deadlines de entregas, pipeline de oportunidades
- Reuniones de trabajo, calls profesionales, propuestas comerciales
Si un campo queda vacío, escribe un insight honesto.`,
        familiar: `
CONTENIDO PROHIBIDO en ámbito familiar:
- Proyectos empresariales, presupuestos de negocio, pipeline, oportunidades comerciales
- Reuniones de trabajo, deadlines, entregas profesionales
- Temas de amistad no familiar: quedadas con amigos, humor entre colegas
- APODOS CARIÑOSOS entre amigos (hermanito, gordo, negrito) → esto es PERSONAL, no familiar
- EXPRESIONES DE AFECTO entre amigos → PERSONAL, no familiar
Si un campo queda vacío, escribe un insight honesto.`,
      };

      const prompt = `## ⚠️ FILTRO OBLIGATORIO — LEER ANTES QUE NADA ⚠️

Este análisis es EXCLUSIVAMENTE para el ámbito "${ambito}".
REGLA ABSOLUTA: Cada campo del JSON debe contener SOLO información del ámbito "${ambito}".
${prohibitedContent[ambito] || ''}

## DATOS DEL CONTACTO
- Nombre: ${contact.name}
- Ámbito actual de análisis: ${ambito}
- Rol: ${contact.role || 'No especificado'}
- Empresa: ${contact.company || 'No especificada'}
- Contexto existente: ${contact.context || 'Sin contexto previo'}
- Total mensajes WA: ${contact.wa_message_count || 0}

${historicalContext}

## CONTACTOS CONOCIDOS DEL USUARIO (para vincular personas mencionadas)
${knownContactsList || '(Sin contactos conocidos)'}

INSTRUCCIÓN: Si una persona mencionada en los mensajes coincide con un contacto conocido de la lista anterior, usa la relación conocida en vez de "no_determinada". Marca posible_match: true.

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

## DISTRIBUCIÓN DE ÁMBITOS PRE-CALCULADA (usar estos valores EXACTOS, NO recalcular)
- Profesional: ${globalDistribution.profesional_pct}%
- Personal: ${globalDistribution.personal_pct}%
- Familiar: ${globalDistribution.familiar_pct}%

## REGLAS ESTRICTAS DE ALERTAS
1. Las alertas son SIEMPRE sobre el CONTACTO, no sobre el usuario.
2. Si el USUARIO dice algo sobre sí mismo, NO es una alerta del contacto.
3. Cada alerta DEBE llevar etiqueta tipo: "contacto" o "observacion".

## RED DE CONTACTOS DE SEGUNDO NIVEL
Busca en los mensajes TODAS las personas que el contacto menciona. Para cada persona:
- Si coincide con un CONTACTO CONOCIDO de la lista anterior, usa la relación del contacto conocido y marca posible_match: true
- Si NO hay match, usa "no_determinada" SOLO si no hay evidencia clara

## REGLAS GENERALES
1. NUNCA generes análisis genéricos.
2. NUNCA inventes información.
3. SIEMPRE cita ejemplos concretos con fechas.
4. La fecha de hoy es: ${new Date().toISOString().split('T')[0]}
5. Para métricas: usa los datos pre-calculados TAL CUAL.
6. FILTRA por ámbito.

## FORMATO DE SALIDA — JSON EXACTO

{
  "ambito": "${ambito}",
  "ultima_interaccion": { "fecha": "YYYY-MM-DD", "canal": "whatsapp|email|presencial|llamada" },
  "estado_relacion": { "emoji": "emoji", "descripcion": "descripción" },
  "datos_clave": [
    { "dato": "texto", "fuente": "WhatsApp DD/MM", "tipo": "empresa|salud|familia|personal|finanzas|proyecto|evento" }
  ],
  "situacion_actual": "2-3 frases contextualizadas con la historia de la relación",
  "evolucion_reciente": {
    "hace_1_mes": "...", "hace_1_semana": "...", "hoy": "...",
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
      "total": "número entero",
      "porcentaje": "número entero",
      "media_semanal": "número"
    },
    "distribucion_ambitos": {
      "profesional_pct": ${globalDistribution.profesional_pct},
      "personal_pct": ${globalDistribution.personal_pct},
      "familiar_pct": ${globalDistribution.familiar_pct}
    }
  },
  "patrones_detectados": [
    { "emoji": "🟢|🟡|🔴", "patron": "nombre", "evidencia": "texto con fecha", "nivel": "verde|amarillo|rojo" }
  ],
  "alertas": [
    { "nivel": "rojo|amarillo", "tipo": "contacto|observacion", "texto": "descripción" }
  ],
  "red_contactos_mencionados": [
    { "nombre": "nombre", "contexto": "rol o relación", "fecha_mencion": "DD/MM", "relacion": "colega|familiar|socio|amigo|decisor|no_determinada", "posible_match": false }
  ],
  "acciones_pendientes": [
    { "accion": "descripción", "origen": "mensaje/fecha", "fecha_sugerida": "YYYY-MM-DD" }
  ],
  "proxima_accion": {
    "que": "descripción", "canal": "whatsapp|email|presencial|llamada",
    "cuando": "fecha", "pretexto": "tema"
  }${ambito === 'profesional' ? `,
  "pipeline": { "oportunidades": [{"descripcion": "...", "estado": "activa|fría|cerrada"}], "probabilidad_cierre": "alta|media|baja" }` : ''}${ambito === 'personal' ? `,
  "termometro_relacion": "frio|tibio|calido|fuerte",
  "reciprocidad": { "usuario_inicia": ${metrics.ratio_iniciativa_usuario}, "contacto_inicia": ${metrics.ratio_iniciativa_contacto}, "evaluacion": "equilibrada|desequilibrada" },
  "gestiones_compartidas": [],
  "dinamica_relacion": { "tono": "...", "uso_humor": "...", "temas_no_laborales": [], "confianza_percibida": "alta|media|baja", "evidencia_confianza": "cita", "ultima_conversacion_personal": { "fecha": "DD/MM", "tema": "..." } }` : ''}${ambito === 'familiar' ? `,
  "bienestar": { "estado_emocional": "descripción", "necesidades": [] },
  "coordinacion": [],
  "desarrollo_bosco": { "hitos": [], "patrones_emocionales": [] }` : ''}
}`;

      const aiResponse = await chat(
        [{ role: "system", content: `Eres un analista de inteligencia relacional para el ámbito "${ambito}".
REGLA CRÍTICA: Cada campo del JSON debe contener SOLO información del ámbito "${ambito}".
Es MEJOR un análisis corto y honesto que uno largo con datos del ámbito equivocado.
Responde SIEMPRE en JSON válido. NUNCA uses markdown. NUNCA inventes datos.
Cada insight debe citar fechas y contenido real. Las alertas son SIEMPRE sobre el CONTACTO.` },
         { role: "user", content: prompt }],
        { model: "gemini-pro", temperature: 0.3, maxTokens: 8192, responseFormat: "json" }
      );

      profileByScope[ambito] = JSON.parse(aiResponse);
    }

    // 13. Post-process: unify red_contactos_mencionados across scopes (Problem 3)
    unifyMentionedContacts(profileByScope);

    // 14. Inject global distribution into all scopes (ensure consistency — Problem 2)
    for (const ambito of scopes) {
      if (profileByScope[ambito]?.metricas_comunicacion) {
        profileByScope[ambito].metricas_comunicacion.distribucion_ambitos = {
          profesional_pct: globalDistribution.profesional_pct,
          personal_pct: globalDistribution.personal_pct,
          familiar_pct: globalDistribution.familiar_pct,
        };
      }
    }

    // 15. Add global_distribution at top level
    const finalProfile = {
      ...profileByScope,
      _global_distribution: globalDistribution,
      _historical_analysis: historicalAnalysis,
    };

    // 16. Save to people_contacts
    const { error: updateErr } = await supabase
      .from("people_contacts")
      .update({
        personality_profile: finalProfile,
        categories: scopes,
      })
      .eq("id", contact_id)
      .eq("user_id", user.id);

    if (updateErr) throw updateErr;

    // 17. Bio-to-Tasks sync: persist acciones_pendientes as tasks
    try {
      let syncedTasks = 0;
      for (const ambito of scopes) {
        const profile = profileByScope[ambito];
        const acciones = profile?.acciones_pendientes;
        if (!Array.isArray(acciones) || acciones.length === 0) continue;

        const taskType = ambito === 'profesional' ? 'work' : 'life';

        for (const accion of acciones) {
          if (!accion?.accion) continue;
          const accionTitle = String(accion.accion).substring(0, 200);
          
          // Check if similar task already exists for this contact
          const { data: existing } = await supabase
            .from("tasks")
            .select("id")
            .eq("user_id", user.id)
            .eq("contact_id", contact_id)
            .eq("completed", false)
            .ilike("title", `%${accionTitle.substring(0, 30)}%`)
            .limit(1);

          if (existing && existing.length > 0) continue;

          const pretexto = profile?.proxima_accion?.pretexto || '';
          
          await supabase.from("tasks").insert({
            user_id: user.id,
            title: accionTitle,
            type: taskType,
            priority: 'P1',
            duration: 15,
            completed: false,
            contact_id: contact_id,
          });
          syncedTasks++;
        }
      }
      if (syncedTasks > 0) {
        console.log(`Synced ${syncedTasks} new tasks from AI analysis for contact ${contact.name}`);
      }
    } catch (syncErr) {
      console.error("Error syncing tasks from profile:", syncErr);
      // Non-fatal: don't block the response
    }

    return new Response(JSON.stringify({ success: true, profile: finalProfile, scopes }), {
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
