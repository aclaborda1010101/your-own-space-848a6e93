import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateAuth } from "../_shared/auth-helper.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// New GA realtime model — must match src/hooks/useJarvisRealtime.tsx OPENAI_REALTIME_MODEL
const OPENAI_REALTIME_MODEL = "gpt-realtime";

const BASE_PERSONA = `Eres JARVIS, el SUPERAGENTE PERSONAL de Agustín. No eres un asistente neutro: eres su sistema operativo personal con poderes de superadministrador sobre toda la aplicación.

PERSONALIDAD:
- Mayordomo tecnológico de élite (estilo JARVIS de Iron Man, en castellano).
- Trato de usted: "señor", "si me permite".
- Conciso, eficiente, anticipador. Frases cortas. Sin clichés.
- Opina con criterio cuando proceda. No se esconde tras "depende".

PODERES (eres superadministrador, no preguntas permisos para acciones operativas razonables):
- Acceso COMPLETO a contactos, proyectos, tareas, agenda, emails, WhatsApp, memorias, WHOOP, check-ins, observaciones de Bosco, todo el RAG.
- Puedes BUSCAR, CREAR, ACTUALIZAR, COMPLETAR y ELIMINAR datos vía las funciones disponibles.
- Puedes DELEGAR consultas profundas al gateway de especialistas (coach, nutrición, inglés, finanzas, salud, retail, secretaria, bosco) llamando a 'ask_specialist'.
- Para acciones DESTRUCTIVAS (borrar contactos, cancelar reuniones con clientes, enviar emails) confirma con UNA frase breve antes de ejecutar.

REGLAS DE COMPORTAMIENTO:
- Si te pregunta por una persona y no aparece literal, usa 'search_contacts' (matching difuso) — nunca digas "no encuentro a esa persona" sin haber buscado.
- Si te pregunta por un proyecto/cliente, usa 'search_projects'.
- Si necesita un dato profundo del histórico/memoria, usa 'search_memories'.
- Si la pregunta es de dominio especializado (nutrición, coaching, inglés, finanzas, retail, etc.), llama a 'ask_specialist' con el dominio y obtén la respuesta del experto, luego sintetiza tú.
- Para cualquier acción operativa (crear tarea, agendar, marcar hecho, registrar observación, crear evento), ejecuta directamente la función correspondiente.
- Si necesitas datos genéricos no cubiertos por una función específica, usa 'query_table' con la tabla y filtros.

NUNCA:
- "No tengo acceso a esa información" → falso. Tienes acceso. Usa las funciones.
- "Como modelo de IA no puedo opinar" → prohibido salvo riesgo médico/legal real.
- Saludos largos. Despedidas largas. Disclaimers vacíos.`;

async function loadUserContext(supabase: any, userId: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  const parts: string[] = [];

  try {
    const [
      profileRes,
      memoriesRes,
      contactsRes,
      projectsRes,
      tasksRes,
      checkInRes,
      whoopRes,
      emailsRes,
    ] = await Promise.all([
      supabase.from('user_profile').select('display_name, role, bio, preferences').eq('user_id', userId).maybeSingle(),
      supabase.rpc('get_jarvis_context', { p_user_id: userId, p_limit: 25 }),
      supabase.from('people_contacts').select('name, company, role, last_interaction_at')
        .eq('user_id', userId).order('last_interaction_at', { ascending: false, nullsFirst: false }).limit(20),
      supabase.from('business_projects').select('name, company, status, sector')
        .eq('user_id', userId).neq('status', 'closed').order('updated_at', { ascending: false }).limit(15),
      supabase.from('todos').select('title, priority, due_date').eq('user_id', userId).eq('is_completed', false)
        .order('priority', { ascending: false }).limit(10),
      supabase.from('check_ins').select('energy, mood, focus, day_mode').eq('user_id', userId).eq('date', today)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('whoop_data').select('recovery_score, hrv, strain, sleep_hours').eq('user_id', userId).eq('data_date', today).maybeSingle(),
      supabase.from('jarvis_emails_cache').select('from_addr, subject').eq('user_id', userId).eq('is_read', false)
        .order('synced_at', { ascending: false }).limit(8),
    ]);

    if (profileRes.data) {
      const p = profileRes.data;
      parts.push(`PERFIL: ${p.display_name || 'Agustín'}${p.role ? ` (${p.role})` : ''}.${p.bio ? ' ' + p.bio.substring(0, 200) : ''}`);
    }
    if (whoopRes.data) {
      const w = whoopRes.data;
      parts.push(`WHOOP HOY: Recovery ${w.recovery_score}%, HRV ${w.hrv}ms, Strain ${w.strain}, Sueño ${w.sleep_hours?.toFixed(1) || '?'}h`);
    }
    if (checkInRes.data) {
      const c = checkInRes.data;
      parts.push(`CHECK-IN HOY: Energía ${c.energy}/10, Ánimo ${c.mood}/10, Foco ${c.focus}/10, Modo ${c.day_mode}`);
    }
    if (tasksRes.data?.length) {
      parts.push(`TAREAS PENDIENTES (${tasksRes.data.length}): ${tasksRes.data.map((t: any) => `${t.title}${t.due_date ? ` [${t.due_date}]` : ''}`).join(' | ')}`);
    }
    if (projectsRes.data?.length) {
      parts.push(`PROYECTOS ACTIVOS (${projectsRes.data.length}): ${projectsRes.data.map((p: any) => `${p.name}${p.company ? ` (${p.company})` : ''} [${p.status}]`).join(' | ')}`);
    }
    if (contactsRes.data?.length) {
      parts.push(`CONTACTOS RECIENTES (${contactsRes.data.length}): ${contactsRes.data.map((c: any) => `${c.name}${c.company ? ` @ ${c.company}` : ''}`).join(', ')}`);
    }
    if (emailsRes.data?.length) {
      parts.push(`EMAILS SIN LEER (${emailsRes.data.length}): ${emailsRes.data.map((e: any) => `${e.from_addr}: ${e.subject}`).join(' | ')}`);
    }
    if (memoriesRes.data?.length) {
      parts.push(`MEMORIAS RELEVANTES: ${memoriesRes.data.map((m: any) => m.content).join(' | ')}`);
    }
  } catch (e) {
    console.warn('[jarvis-voice] Context load partial error:', e);
  }

  return parts.length ? `\n\nCONTEXTO ACTUAL DEL SEÑOR (úsalo activamente):\n${parts.join('\n')}` : '';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const contextBlock = await loadUserContext(supabaseAdmin, user!.id);
    const fullInstructions = BASE_PERSONA + contextBlock;

    console.log(`[jarvis-voice] User ${user!.id} → injecting ${contextBlock.length} chars of context`);

    const sessionConfig = {
      session: {
        type: "realtime",
        model: OPENAI_REALTIME_MODEL,
        instructions: fullInstructions,
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

    const clientSecret = data.value
      ? { value: data.value, expires_at: data.expires_at }
      : data.client_secret ?? data;

    return new Response(
      JSON.stringify({
        client_secret: clientSecret,
        model: OPENAI_REALTIME_MODEL,
        instructions: fullInstructions, // client uses these in session.update too
      }),
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
