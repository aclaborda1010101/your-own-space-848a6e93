import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { userId, timezone = 'Europe/Madrid', type = 'morning' } = await req.json();
    const briefingType = type === 'evening' ? 'evening' : 'morning';

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = new Date().toISOString().split('T')[0];

    // Check if briefing already exists for today + type
    const { data: existingBriefing } = await supabase
      .from('daily_briefings')
      .select('*')
      .eq('user_id', userId)
      .eq('briefing_date', today)
      .eq('briefing_type', briefingType)
      .maybeSingle();

    if (existingBriefing) {
      return new Response(JSON.stringify({
        success: true, briefing: existingBriefing, cached: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[daily-briefing] Generating ${briefingType} briefing for ${userId.substring(0, 8)}... on ${today}`);

    // Gather context data in parallel
    const baseQueries = [
      supabase.from('user_profile')
        .select('name, vital_role, life_goals, professional_goals, family_context, health_profile')
        .eq('user_id', userId).maybeSingle(),
      supabase.from('tasks')
        .select('title, type, priority, duration, due_date')
        .eq('user_id', userId).eq('completed', false)
        .order('priority', { ascending: true }).limit(15),
      supabase.from('events')
        .select('title, start_time, end_time, type, description')
        .eq('user_id', userId)
        .gte('start_time', today).lte('start_time', today + 'T23:59:59')
        .order('start_time', { ascending: true }),
      supabase.from('check_ins')
        .select('energy, mood, focus, notes, date')
        .eq('user_id', userId).order('date', { ascending: false }).limit(1),
      supabase.from('jarvis_memory')
        .select('content, memory_type, importance')
        .eq('user_id', userId).gte('importance', 6)
        .order('last_accessed', { ascending: false }).limit(5),
      supabase.from('daily_briefings')
        .select('summary')
        .eq('user_id', userId).lt('briefing_date', today)
        .order('briefing_date', { ascending: false }).limit(1),
    ];

    // Evening briefing gets extra context
    if (briefingType === 'evening') {
      baseQueries.push(
        supabase.from('transcriptions')
          .select('title, brain, summary')
          .eq('user_id', userId)
          .gte('created_at', today)
          .order('created_at', { ascending: false }).limit(5)
      );
      baseQueries.push(
        supabase.from('tasks')
          .select('title, priority, completed_at')
          .eq('user_id', userId).eq('completed', true)
          .gte('completed_at', today)
      );
    }

    const results = await Promise.all(baseQueries);

    const profile = results[0].data;
    const tasks = results[1].data || [];
    const events = results[2].data || [];
    const checkIn = results[3].data?.[0];
    const memories = results[4].data || [];
    const yesterdayBriefing = results[5].data?.[0];
    const todayTranscriptions = briefingType === 'evening' ? (results[6]?.data || []) : [];
    const todayCompleted = briefingType === 'evening' ? (results[7]?.data || []) : [];

    // Build context
    const p0Tasks = tasks.filter((t: any) => t.priority === 'P0');
    const p1Tasks = tasks.filter((t: any) => t.priority === 'P1');
    const overdueTasks = tasks.filter((t: any) => t.due_date && t.due_date < today);

    const contextParts: string[] = [];

    if (profile?.name) {
      contextParts.push(`Usuario: ${profile.name}${profile.vital_role ? ` (${profile.vital_role})` : ''}`);
    }
    if (checkIn) {
      contextParts.push(`Último check-in (${checkIn.date}): Energía ${checkIn.energy}/10, Ánimo ${checkIn.mood}/10, Foco ${checkIn.focus}/10`);
    }
    if (events.length > 0) {
      contextParts.push(`Eventos hoy (${events.length}):\n${events.map((e: any) =>
        `  - ${e.start_time?.split('T')[1]?.slice(0, 5) || '??'}: ${e.title}${e.type ? ` (${e.type})` : ''}`
      ).join('\n')}`);
    } else {
      contextParts.push('Sin eventos programados hoy.');
    }
    if (p0Tasks.length > 0) contextParts.push(`Tareas P0 (${p0Tasks.length}): ${p0Tasks.map((t: any) => `"${t.title}"`).join(', ')}`);
    if (p1Tasks.length > 0) contextParts.push(`Tareas P1 (${p1Tasks.length}): ${p1Tasks.map((t: any) => `"${t.title}"`).join(', ')}`);
    if (overdueTasks.length > 0) contextParts.push(`⚠️ Tareas vencidas (${overdueTasks.length}): ${overdueTasks.map((t: any) => `"${t.title}" (vencía ${t.due_date})`).join(', ')}`);
    if (memories.length > 0) contextParts.push(`Memorias relevantes:\n${memories.map((m: any) => `  - [${m.memory_type}] ${m.content}`).join('\n')}`);
    if (yesterdayBriefing?.summary) contextParts.push(`Resumen anterior: ${yesterdayBriefing.summary.substring(0, 200)}`);
    if (profile?.life_goals?.length) contextParts.push(`Objetivos vitales: ${profile.life_goals.join(', ')}`);

    // Evening-specific context
    if (briefingType === 'evening') {
      if (todayTranscriptions.length > 0) {
        contextParts.push(`Transcripciones procesadas hoy (${todayTranscriptions.length}):\n${todayTranscriptions.map((t: any) => `  - [${t.brain}] ${t.title}`).join('\n')}`);
      }
      if (todayCompleted.length > 0) {
        contextParts.push(`Tareas completadas hoy: ${todayCompleted.length} — ${todayCompleted.slice(0, 5).map((t: any) => t.title).join(', ')}`);
      }
    }

    const isEvening = briefingType === 'evening';
    const systemPrompt = isEvening
      ? `Eres JARVIS, generando el briefing nocturno para el señor ${profile?.name || ''}.

FORMATO DE RESPUESTA (JSON estricto):
{
  "greeting": "Buenas noches personalizado",
  "summary": "Resumen ejecutivo del día en 2-3 frases",
  "day_review": "Qué se logró hoy vs lo planificado",
  "transcriptions_summary": "Resumen de conversaciones procesadas hoy",
  "open_threads": ["Temas que quedaron abiertos para mañana"],
  "tomorrow_preview": "Anticipación de lo que viene mañana",
  "energy_note": "Observación sobre el estado de energía",
  "motivation": "Reflexión breve de cierre del día",
  "day_score": 8
}

REGLAS:
- Tono formal, elegante, reflexivo
- Conciso: cada campo máx 2 frases
- day_score: 1-10 evaluación real del día`
      : `Eres JARVIS, generando el briefing matutino para el señor ${profile?.name || ''}.

FORMATO DE RESPUESTA (JSON estricto):
{
  "greeting": "Buenos días personalizado y breve",
  "summary": "Resumen ejecutivo del día en 2-3 frases",
  "calendar_summary": "Resumen de eventos del día",
  "task_priorities": ["Lista de las 3 tareas más importantes para hoy"],
  "energy_recommendation": "Recomendación basada en el último check-in",
  "alerts": ["Alertas importantes"],
  "motivation": "Frase motivacional personalizada",
  "weather_tip": "Consejo del día",
  "family_note": "Nota sobre familia si hay contexto",
  "day_score_prediction": 8
}

REGLAS:
- Tono formal, elegante tipo mayordomo
- Conciso: cada campo máx 2 frases
- Proactivo: anticipa necesidades
- day_score_prediction: 1-10 estimación de productividad`;

    const userPrompt = `Genera el briefing ${isEvening ? 'nocturno' : 'matutino'} para hoy ${today}.\n\nCONTEXTO:\n${contextParts.join('\n\n')}`;

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[daily-briefing] Claude error ${response.status}:`, errorText);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.content?.[0]?.text || '{}';

    let briefingContent;
    try {
      const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      briefingContent = JSON.parse(cleaned);
    } catch {
      console.error('[daily-briefing] Failed to parse response:', rawContent);
      briefingContent = {
        greeting: `${isEvening ? 'Buenas noches' : 'Buenos días'}, señor${profile?.name ? ` ${profile.name}` : ''}.`,
        summary: 'No he podido generar el briefing completo.',
        day_score_prediction: 7,
        day_score: 7,
      };
    }

    // Save briefing
    const briefingRecord: Record<string, any> = {
      user_id: userId,
      briefing_date: today,
      briefing_type: briefingType,
      coach_tip: briefingContent.motivation || briefingContent.energy_note || null,
      pending_tasks: briefingContent.task_priorities || briefingContent.open_threads || null,
      calendar_events: briefingContent.calendar_summary ? { summary: briefingContent.calendar_summary } : null,
    };

    const { error: saveError } = await supabase.from('daily_briefings').insert(briefingRecord);
    if (saveError) console.error('[daily-briefing] Save error:', saveError);

    const score = briefingContent.day_score_prediction || briefingContent.day_score || 7;
    console.log(`[daily-briefing] ${briefingType} briefing generated: score ${score}/10`);

    return new Response(JSON.stringify({
      success: true,
      briefing: { ...briefingRecord, full_content: briefingContent },
      cached: false,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[daily-briefing] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
