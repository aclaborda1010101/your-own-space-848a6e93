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
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { userId, timezone = 'Europe/Madrid' } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = new Date().toISOString().split('T')[0];

    // Check if briefing already exists for today
    const { data: existingBriefing } = await supabase
      .from('daily_briefings')
      .select('*')
      .eq('user_id', userId)
      .eq('briefing_date', today)
      .maybeSingle();

    if (existingBriefing) {
      return new Response(JSON.stringify({
        success: true,
        briefing: existingBriefing,
        cached: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[daily-briefing] Generating briefing for ${userId.substring(0, 8)}... on ${today}`);

    // Gather all context data in parallel
    const [
      profileResult,
      tasksResult,
      eventsResult,
      checkInResult,
      memoriesResult,
      yesterdayBriefingResult,
    ] = await Promise.all([
      // User profile
      supabase.from('user_profile')
        .select('name, vital_role, life_goals, professional_goals, family_context, health_profile')
        .eq('user_id', userId)
        .maybeSingle(),
      // Pending tasks
      supabase.from('tasks')
        .select('title, type, priority, duration, due_date')
        .eq('user_id', userId)
        .eq('completed', false)
        .order('priority', { ascending: true })
        .limit(15),
      // Today's calendar events
      supabase.from('events')
        .select('title, start_time, end_time, type, description')
        .eq('user_id', userId)
        .gte('start_time', today)
        .lte('start_time', today + 'T23:59:59')
        .order('start_time', { ascending: true }),
      // Latest check-in
      supabase.from('check_ins')
        .select('energy, mood, focus, notes, date')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(1),
      // Recent important memories
      supabase.from('jarvis_memory')
        .select('content, memory_type, importance')
        .eq('user_id', userId)
        .gte('importance', 6)
        .order('last_accessed', { ascending: false })
        .limit(5),
      // Yesterday's briefing for continuity
      supabase.from('daily_briefings')
        .select('summary')
        .eq('user_id', userId)
        .lt('briefing_date', today)
        .order('briefing_date', { ascending: false })
        .limit(1),
    ]);

    const profile = profileResult.data;
    const tasks = tasksResult.data || [];
    const events = eventsResult.data || [];
    const checkIn = checkInResult.data?.[0];
    const memories = memoriesResult.data || [];
    const yesterdayBriefing = yesterdayBriefingResult.data?.[0];

    // Build context
    const p0Tasks = tasks.filter(t => t.priority === 'P0');
    const p1Tasks = tasks.filter(t => t.priority === 'P1');
    const overdueTasks = tasks.filter(t => t.due_date && t.due_date < today);

    const contextParts: string[] = [];

    if (profile?.name) {
      contextParts.push(`Usuario: ${profile.name}${profile.vital_role ? ` (${profile.vital_role})` : ''}`);
    }

    if (checkIn) {
      contextParts.push(`Último check-in (${checkIn.date}): Energía ${checkIn.energy}/10, Ánimo ${checkIn.mood}/10, Foco ${checkIn.focus}/10`);
    }

    if (events.length > 0) {
      contextParts.push(`Eventos hoy (${events.length}):\n${events.map(e =>
        `  - ${e.start_time?.split('T')[1]?.slice(0, 5) || '??'}: ${e.title}${e.type ? ` (${e.type})` : ''}`
      ).join('\n')}`);
    } else {
      contextParts.push('Sin eventos programados hoy.');
    }

    if (p0Tasks.length > 0) {
      contextParts.push(`Tareas P0 (${p0Tasks.length}): ${p0Tasks.map(t => `"${t.title}" (${t.duration || '?'}min)`).join(', ')}`);
    }
    if (p1Tasks.length > 0) {
      contextParts.push(`Tareas P1 (${p1Tasks.length}): ${p1Tasks.map(t => `"${t.title}"`).join(', ')}`);
    }
    if (overdueTasks.length > 0) {
      contextParts.push(`⚠️ Tareas vencidas (${overdueTasks.length}): ${overdueTasks.map(t => `"${t.title}" (vencía ${t.due_date})`).join(', ')}`);
    }

    if (memories.length > 0) {
      contextParts.push(`Memorias relevantes:\n${memories.map(m => `  - [${m.memory_type}] ${m.content}`).join('\n')}`);
    }

    if (yesterdayBriefing?.summary) {
      contextParts.push(`Resumen de ayer: ${yesterdayBriefing.summary.substring(0, 200)}`);
    }

    if (profile?.life_goals?.length) {
      contextParts.push(`Objetivos vitales: ${profile.life_goals.join(', ')}`);
    }

    const systemPrompt = `Eres JARVIS, generando el briefing matutino para el señor ${profile?.name || ''}.

FORMATO DE RESPUESTA (JSON estricto):
{
  "greeting": "Buenos días personalizado y breve",
  "summary": "Resumen ejecutivo del día en 2-3 frases",
  "calendar_summary": "Resumen de eventos del día",
  "task_priorities": ["Lista de las 3 tareas más importantes para hoy, en orden"],
  "energy_recommendation": "Recomendación basada en el último check-in de energía",
  "alerts": ["Alertas importantes: tareas vencidas, conflictos de agenda, etc."],
  "motivation": "Frase motivacional breve y personalizada basada en los objetivos del usuario",
  "weather_tip": "Consejo del día relacionado con bienestar",
  "family_note": "Nota sobre familia si hay contexto relevante (Bosco, etc.)",
  "day_score_prediction": 8
}

REGLAS:
- Tono formal, elegante tipo mayordomo
- Conciso: cada campo máx 2 frases
- Proactivo: anticipa necesidades
- Si hay tareas vencidas, alerta con urgencia
- Si no hay check-in reciente, sugiere hacer uno
- day_score_prediction: 1-10 estimación de productividad potencial`;

    const userPrompt = `Genera el briefing matutino para hoy ${today}.\n\nCONTEXTO:\n${contextParts.join('\n\n')}`;

    // Call Claude
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

    // Parse the briefing
    let briefingContent;
    try {
      // Clean potential markdown wrapping
      const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      briefingContent = JSON.parse(cleaned);
    } catch {
      console.error('[daily-briefing] Failed to parse response:', rawContent);
      briefingContent = {
        greeting: `Buenos días, señor${profile?.name ? ` ${profile.name}` : ''}.`,
        summary: 'No he podido generar el briefing completo. Revisar configuración.',
        calendar_summary: events.length > 0 ? `Tiene ${events.length} evento(s) hoy.` : 'Sin eventos.',
        task_priorities: p0Tasks.slice(0, 3).map(t => t.title),
        alerts: overdueTasks.length > 0 ? [`${overdueTasks.length} tarea(s) vencida(s)`] : [],
        motivation: 'Un paso a la vez, señor.',
        day_score_prediction: 7,
      };
    }

    // Save briefing to database
    const briefingRecord = {
      user_id: userId,
      briefing_date: today,
      summary: briefingContent.summary || '',
      calendar_summary: briefingContent.calendar_summary || null,
      task_summary: briefingContent.task_priorities?.join('; ') || null,
      ai_news_summary: null, // Can be populated separately
      world_news_summary: null,
      email_summary: null,
      motivation_quote: briefingContent.motivation || null,
      energy_recommendation: briefingContent.energy_recommendation || null,
      day_score_prediction: briefingContent.day_score_prediction || null,
      full_content: briefingContent,
    };

    const { error: saveError } = await supabase
      .from('daily_briefings')
      .insert(briefingRecord);

    if (saveError) {
      console.error('[daily-briefing] Save error:', saveError);
    }

    console.log(`[daily-briefing] Briefing generated for ${today}: score ${briefingContent.day_score_prediction}/10`);

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
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
