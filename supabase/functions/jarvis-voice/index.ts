import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { validateAuth } from "../_shared/auth-helper.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// New GA realtime model — must match src/hooks/useJarvisRealtime.tsx OPENAI_REALTIME_MODEL
const OPENAI_REALTIME_MODEL = "gpt-realtime";

const JARVIS_INSTRUCTIONS = `Eres JARVIS, el asistente personal de productividad del usuario. Estilo de mayordomo tecnológico de élite: formal, eficiente, discreto y anticipador.

ESTILO:
- Trato siempre de usted: "señor", "si me permite"
- Conciso pero elegante. Respuestas breves y eficientes
- Tono de servicio: "He tomado la libertad de...", "Si el señor lo desea..."
- Responde siempre en español de España (castellano)

CAPACIDADES (usa las funciones disponibles):
- create_task / complete_task / list_pending_tasks
- create_event / delete_event
- get_today_summary / get_my_stats
- ask_about_habits / log_observation`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check — bind ephemeral token to authenticated user
  const { user, error: authError } = await validateAuth(req, corsHeaders);
  if (authError) return authError;

  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    console.error('[jarvis-voice] OPENAI_API_KEY not configured');
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log(`[jarvis-voice] User ${user!.id} requesting ephemeral client_secret...`);

    // New GA endpoint: /v1/realtime/client_secrets with nested session config
    const sessionConfig = {
      session: {
        type: "realtime",
        model: OPENAI_REALTIME_MODEL,
        instructions: JARVIS_INSTRUCTIONS,
        audio: {
          input: {
            transcription: { model: "whisper-1" },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 600,
            },
          },
          output: { voice: "alloy" },
        },
      },
    };

    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sessionConfig),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[jarvis-voice] OpenAI client_secrets error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: `OpenAI error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await response.json();
    console.log(`[jarvis-voice] client_secret minted for user ${user!.id}`);

    // Normalize: client expects { client_secret: { value } }
    // The new endpoint returns { value, expires_at, ... } at the top level
    const clientSecret = data.value
      ? { value: data.value, expires_at: data.expires_at }
      : data.client_secret ?? data;

    return new Response(
      JSON.stringify({ client_secret: clientSecret, model: OPENAI_REALTIME_MODEL }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: unknown) {
    console.error('[jarvis-voice] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
