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
      console.error('Missing API keys:', { GROQ: !!GROQ_API_KEY, ELEVENLABS: !!ELEVENLABS_API_KEY, OPENAI: !!OPENAI_API_KEY });
      throw new Error('Missing API keys');
    }

    // Función pública - no requiere autenticación
    const { action, audioBlob } = await req.json();
    console.log('Action:', action, 'Audio blob length:', audioBlob?.length);

    if (action === 'process_voice') {
      // PASO 1: Transcribir con Groq Whisper (ultrarrápido)
      console.log('Starting transcription...');
      
      // Decode base64 to binary de forma más robusta
      const cleanedBase64 = audioBlob.replace(/\s/g, ''); // Remove whitespace
      let bytes;
      
      try {
        // Método 1: atob() nativo (rápido)
        const binaryString = atob(cleanedBase64);
        bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
      } catch (e) {
        console.error('atob failed, using fallback:', e);
        // Método 2: Decode manual (fallback)
        const decoder = new TextDecoder();
        bytes = Uint8Array.from(cleanedBase64, c => c.charCodeAt(0));
      }
      
      console.log('Audio bytes:', bytes.length);
      
      const formData = new FormData();
      const audioBlob2 = new Blob([bytes], { type: 'audio/webm' });
      formData.append('file', audioBlob2, 'audio.webm');
      formData.append('model', 'whisper-large-v3');
      formData.append('language', 'es');
      
      console.log('Calling Groq API...');
      const transcriptionResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: formData,
      });

      if (!transcriptionResponse.ok) {
        const errorText = await transcriptionResponse.text();
        console.error('Groq API error:', transcriptionResponse.status, errorText);
        throw new Error(`Transcription failed: ${transcriptionResponse.status}`);
      }

      const { text: transcript } = await transcriptionResponse.json();
      console.log('Transcription:', transcript);

      // PASO 2: Procesar con GPT-4o-mini
      console.log('Calling OpenAI API...');
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

      if (!llmResponse.ok) {
        const errorText = await llmResponse.text();
        console.error('OpenAI API error:', llmResponse.status, errorText);
        throw new Error(`LLM failed: ${llmResponse.status}`);
      }

      const llmData = await llmResponse.json();
      const responseText = llmData.choices[0].message.content;
      console.log('LLM response:', responseText);
      
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
      console.log('Calling ElevenLabs API...');
      
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
        const errorText = await ttsResponse.text();
        console.error('ElevenLabs API error:', ttsResponse.status, errorText);
        throw new Error(`TTS failed: ${ttsResponse.status}`);
      }

      const audioArrayBuffer = await ttsResponse.arrayBuffer();
      const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioArrayBuffer)));

      console.log('Success! Returning response.');
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
    console.error('Error in jarvis-hybrid-voice:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Stack:', errorStack);
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: errorStack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
