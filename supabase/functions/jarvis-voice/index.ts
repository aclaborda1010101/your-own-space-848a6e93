import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, upgrade, connection, sec-websocket-key, sec-websocket-version, sec-websocket-extensions, sec-websocket-protocol',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not configured');
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Generate ephemeral token for WebRTC
    console.log('Requesting ephemeral token from OpenAI...');
    
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "alloy",
        instructions: `Eres JARVIS, el asistente personal de productividad del usuario. Tu estilo es el de un mayordomo tecnológico de élite: formal, eficiente, discreto y anticipador.

ESTILO DE COMUNICACIÓN:
- Trato siempre de usted: "señor", "si me permite", "muy bien, señor"
- Frases tipo mayordomo: "Permítame sugerir...", "He preparado...", "Me he permitido reorganizar..."
- Conciso pero elegante. Respuestas breves y eficientes.
- Tono de servicio: "He tomado la libertad de...", "Si el señor lo desea..."
- NUNCA tutees al usuario. Siempre de usted.

CAPACIDADES:
- Crear tareas nuevas (work o life)
- Completar tareas existentes
- Crear eventos de calendario
- Eliminar eventos de calendario
- Listar tareas pendientes
- Consultar estadísticas y resumen del día
- Registrar observaciones rápidas
- Responder preguntas sobre hábitos y patrones de productividad

FORMATO DE TAREAS:
Cuando el usuario quiera crear una tarea, usa la función create_task con:
- title: nombre descriptivo de la tarea
- type: "work" para trabajo, "life" para personal/vida
- priority: "P0" (urgente), "P1" (alta), "P2" (media), "P3" (baja)
- duration: duración estimada en minutos (15, 30, 45, 60, 90, 120)

Cuando el usuario quiera completar una tarea, usa complete_task con:
- task_title: nombre o parte del nombre de la tarea a completar

FORMATO DE EVENTOS:
Cuando el usuario quiera crear un evento, usa la función create_event con:
- title: nombre del evento
- time: hora en formato HH:MM (24h)
- duration: duración en minutos
- description: descripción opcional

Cuando el usuario quiera eliminar un evento, usa delete_event con:
- event_title: nombre o parte del nombre del evento a eliminar

CONSULTAS DE INFORMACIÓN:
- Usa get_today_summary para obtener un resumen del día actual
- Usa get_my_stats para obtener estadísticas generales del usuario
- Usa ask_about_habits para consultar patrones e insights sobre hábitos
- Usa log_observation para registrar una nota u observación rápida

INSTRUCCIONES:
- Sé conciso y eficiente en tus respuestas
- Confirma las acciones realizadas brevemente: "Muy bien señor, tarea creada"
- Si falta información, pregunta con cortesía: "¿Me permite preguntarle la prioridad?"
- Responde siempre en español de España (castellano)
- Si el usuario dice "completar", "terminar", "hecho", "listo" junto con una tarea, usa complete_task
- Si el usuario dice "eliminar", "borrar", "quitar" junto con un evento, usa delete_event
- Si el usuario pregunta "cómo voy", "qué tal el día", "resumen", usa get_today_summary
- Si el usuario pregunta sobre productividad, hábitos, patrones, usa ask_about_habits`,
        tools: [
          {
            type: "function",
            name: "create_task",
            description: "Crea una nueva tarea en el sistema de productividad",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Título de la tarea" },
                type: { type: "string", enum: ["work", "life"], description: "Tipo de tarea" },
                priority: { type: "string", enum: ["P0", "P1", "P2", "P3"], description: "Prioridad de la tarea" },
                duration: { type: "number", description: "Duración estimada en minutos" }
              },
              required: ["title", "type", "priority", "duration"]
            }
          },
          {
            type: "function",
            name: "complete_task",
            description: "Marca una tarea como completada buscando por título",
            parameters: {
              type: "object",
              properties: {
                task_title: { type: "string", description: "Título o parte del título de la tarea a completar" }
              },
              required: ["task_title"]
            }
          },
          {
            type: "function",
            name: "create_event",
            description: "Crea un nuevo evento en el calendario",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Título del evento" },
                time: { type: "string", description: "Hora del evento en formato HH:MM" },
                duration: { type: "number", description: "Duración en minutos" },
                description: { type: "string", description: "Descripción del evento" }
              },
              required: ["title", "time", "duration"]
            }
          },
          {
            type: "function",
            name: "delete_event",
            description: "Elimina un evento del calendario buscando por título",
            parameters: {
              type: "object",
              properties: {
                event_title: { type: "string", description: "Título o parte del título del evento a eliminar" }
              },
              required: ["event_title"]
            }
          },
          {
            type: "function",
            name: "list_pending_tasks",
            description: "Lista las tareas pendientes del usuario",
            parameters: {
              type: "object",
              properties: {},
              required: []
            }
          },
          {
            type: "function",
            name: "get_today_summary",
            description: "Obtiene un resumen del día actual: tareas completadas, pendientes, check-in, etc.",
            parameters: {
              type: "object",
              properties: {},
              required: []
            }
          },
          {
            type: "function",
            name: "get_my_stats",
            description: "Obtiene estadísticas generales del usuario: racha, sesiones de pomodoro, productividad",
            parameters: {
              type: "object",
              properties: {},
              required: []
            }
          },
          {
            type: "function",
            name: "ask_about_habits",
            description: "Consulta información sobre hábitos, patrones de productividad e insights aprendidos",
            parameters: {
              type: "object",
              properties: {
                question: { type: "string", description: "Pregunta sobre hábitos o productividad" }
              },
              required: ["question"]
            }
          },
          {
            type: "function",
            name: "log_observation",
            description: "Registra una observación o nota rápida del usuario",
            parameters: {
              type: "object",
              properties: {
                observation: { type: "string", description: "Texto de la observación a registrar" }
              },
              required: ["observation"]
            }
          }
        ],
        tool_choice: "auto",
        input_audio_transcription: {
          model: "whisper-1"
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.3,
          prefix_padding_ms: 300,
          silence_duration_ms: 800
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI session error:', response.status, errorText);
      return new Response(JSON.stringify({ error: `OpenAI error: ${response.status}`, details: errorText }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log('Session created successfully');
    
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in jarvis-voice:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
