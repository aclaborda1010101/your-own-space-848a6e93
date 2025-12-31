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
        instructions: `Eres JARVIS, el asistente de productividad personal del usuario. Tu objetivo es ayudar a gestionar tareas y eventos de calendario mediante comandos de voz.

CAPACIDADES:
- Crear tareas nuevas (work o life)
- Crear eventos de calendario

FORMATO DE TAREAS:
Cuando el usuario quiera crear una tarea, usa la función create_task con:
- title: nombre descriptivo de la tarea
- type: "work" para trabajo, "life" para personal/vida
- priority: "P0" (urgente), "P1" (alta), "P2" (media), "P3" (baja)
- duration: duración estimada en minutos (15, 30, 45, 60, 90, 120)

FORMATO DE EVENTOS:
Cuando el usuario quiera crear un evento, usa la función create_event con:
- title: nombre del evento
- time: hora en formato HH:MM (24h)
- duration: duración en minutos
- description: descripción opcional

INSTRUCCIONES:
- Sé conciso y eficiente en tus respuestas
- Confirma las acciones realizadas brevemente
- Si falta información, pregunta lo necesario
- Responde siempre en español
- Usa un tono profesional pero amigable`,
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
          }
        ],
        tool_choice: "auto",
        input_audio_transcription: {
          model: "whisper-1"
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 800
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI session error:', response.status, errorText);
      return new Response(JSON.stringify({ error: `OpenAI error: ${response.status}` }), {
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
