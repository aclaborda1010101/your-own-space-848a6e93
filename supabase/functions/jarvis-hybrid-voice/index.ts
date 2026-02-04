import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!GROQ_API_KEY || !ELEVENLABS_API_KEY || !OPENAI_API_KEY) {
      throw new Error('Missing API keys');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Invalid user');

    const { action, audioBlob } = await req.json();

    if (action === 'process_voice') {
      // PASO 1: Transcribir con Groq Whisper (ultrarrápido)
      const formData = new FormData();
      const audioBuffer = Uint8Array.from(atob(audioBlob), c => c.charCodeAt(0));
      formData.append('file', new Blob([audioBuffer], { type: 'audio/webm' }), 'audio.webm');
      formData.append('model', 'whisper-large-v3');
      formData.append('language', 'es');
      
      const transcriptionResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: formData,
      });

      if (!transcriptionResponse.ok) {
        throw new Error('Transcription failed');
      }

      const { text: transcript } = await transcriptionResponse.json();
      console.log('Transcription:', transcript);

      // PASO 2: Procesar con GPT-4o (más rápido que Claude para esto)
      const llmResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Eres JARVIS, el asistente personal de IA. Respondes en español con tono profesional tipo mayordomo británico.
              
Tienes acceso a las siguientes funciones:
- create_task(title, type, priority, duration)
- complete_task(task_title)
- list_pending_tasks()
- get_today_summary()
- create_event(title, time, duration, description)
- delete_event(event_title)
- log_observation(observation)
- get_my_stats()

Cuando el usuario pida algo que requiera una función, responde en formato JSON:
{"action": "function_name", "params": {...}, "response": "Confirmación para el usuario"}

Si es conversación normal, responde en formato JSON:
{"response": "Tu respuesta al usuario"}

Sé breve (máximo 2 frases).`
            },
            {
              role: 'user',
              content: transcript
            }
          ],
          temperature: 0.7,
          max_tokens: 150
        }),
      });

      const llmData = await llmResponse.json();
      const responseText = llmData.choices[0].message.content;
      
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseText);
      } catch {
        parsedResponse = { response: responseText };
      }

      // PASO 3: Ejecutar función si se requiere
      if (parsedResponse.action) {
        // TODO: Implementar ejecución de funciones
        console.log('Function call:', parsedResponse.action, parsedResponse.params);
      }

      // PASO 4: Generar audio con ElevenLabs (voz JARVIS)
      const textToSpeak = parsedResponse.response;
      
      const ttsResponse = await fetch('https://api.elevenlabs.io/v1/text-to-speech/QvEUryiZK2HehvWPsmiL', {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: textToSpeak,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.7,
            similarity_boost: 0.85,
          },
        }),
      });

      if (!ttsResponse.ok) {
        throw new Error('TTS failed');
      }

      const audioArrayBuffer = await ttsResponse.arrayBuffer();
      const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioArrayBuffer)));

      return new Response(JSON.stringify({
        transcript,
        response: textToSpeak,
        audioBase64,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');
  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
