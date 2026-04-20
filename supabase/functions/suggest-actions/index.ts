// Edge Function: suggest-actions
// Sugerencias proactivas basadas en contexto del usuario

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ContextData {
  time: string;
  day: string;
  recentTasks: any[];
  upcomingEvents: any[];
  habits: any[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)

    if (!user) {
      throw new Error('No user found')
    }

    const { context } = await req.json() as { context?: ContextData }

    const now = new Date()
    const hour = now.getHours()
    const dayOfWeek = now.toLocaleDateString('es-ES', { weekday: 'long' })

    // Fetch user context — calendar comes from iCloud (no existe tabla calendar_events)
    const fetchICloudNext24h = async (): Promise<any[]> => {
      try {
        const startISO = now.toISOString();
        const endISO = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
        const icResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/icloud-calendar`, {
          method: "POST",
          headers: {
            "Authorization": authHeader,
            "Content-Type": "application/json",
            "apikey": Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          },
          body: JSON.stringify({ action: "fetch", startDate: startISO, endDate: endISO }),
        });
        if (!icResp.ok) return [];
        const icData = await icResp.json();
        if (icData?.connected === false) return [];
        return Array.isArray(icData?.events) ? icData.events : [];
      } catch (err) {
        console.error("[suggest-actions] icloud fetch failed", err);
        return [];
      }
    };

    const [tasksData, eventsRaw, habitsData] = await Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('completed', false)
        .order('priority', { ascending: false })
        .limit(5),

      fetchICloudNext24h(),

      supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
    ])

    const tasks = tasksData.data || []
    // iCloud events: { id, title, date: 'YYYY-MM-DD', time: 'HH:MM', duration, location, allDay }
    const eventsRawArr: any[] = Array.isArray(eventsRaw) ? eventsRaw : []
    const toEventDate = (e: any): Date | null => {
      if (!e?.date) return null
      const t = (typeof e.time === 'string' && /^\d{2}:\d{2}/.test(e.time)) ? e.time.slice(0, 5) : '00:00'
      const d = new Date(`${e.date}T${t}:00`)
      return isNaN(d.getTime()) ? null : d
    }
    const events = eventsRawArr
      .filter(e => !e?.allDay)
      .map(e => ({ ...e, _start: toEventDate(e) }))
      .filter(e => e._start)
      .sort((a: any, b: any) => a._start.getTime() - b._start.getTime())
    const habits = habitsData.data || []

    // Generate suggestions based on time and context
    const suggestions: string[] = []

    // Morning suggestions (6-10)
    if (hour >= 6 && hour < 10) {
      if (habits.length > 0) {
        suggestions.push(`☀️ Buenos días! Hora de tus hábitos matutinos: ${habits.slice(0, 2).map(h => h.name).join(', ')}`)
      }
      if (events.length > 0) {
        const nextEvent: any = events[0]
        const eventTime: Date = nextEvent._start
        suggestions.push(`📅 Hoy tienes "${nextEvent.title}" a las ${eventTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`)
      }
    }

    // Workday suggestions (10-18)
    if (hour >= 10 && hour < 18) {
      if (tasks.length > 0) {
        const highPriority = tasks.filter(t => t.priority === 'high')
        if (highPriority.length > 0) {
          suggestions.push(`🎯 Tienes ${highPriority.length} tareas de alta prioridad pendientes`)
        }
      }

      const nextEvent: any = events.find((e: any) => e._start > now)
      if (nextEvent) {
        const timeUntil = (nextEvent._start as Date).getTime() - now.getTime()
        const hoursUntil = Math.floor(timeUntil / (1000 * 60 * 60))
        if (hoursUntil <= 1) {
          suggestions.push(`⏰ Tienes "${nextEvent.title}" en ${hoursUntil === 0 ? 'menos de 1 hora' : '1 hora'}`)
        }
      }
    }

    // Evening suggestions (18-22)
    if (hour >= 18 && hour < 22) {
      const completedToday = tasks.filter(t => {
        const updated = new Date(t.updated_at)
        return updated.toDateString() === now.toDateString() && t.completed
      })
      
      if (completedToday.length > 0) {
        suggestions.push(`✅ Completaste ${completedToday.length} tareas hoy. ¡Buen trabajo!`)
      }
      
      const pendingTasks = tasks.filter(t => !t.completed)
      if (pendingTasks.length > 3) {
        suggestions.push(`📋 Quedan ${pendingTasks.length} tareas pendientes. ¿Planificamos mañana?`)
      }
    }

    // Weekend suggestions
    if (dayOfWeek === 'sábado' || dayOfWeek === 'domingo') {
      if (tasks.some(t => t.category === 'personal')) {
        suggestions.push(`🏡 Fin de semana perfecto para tareas personales`)
      }
    }

    // Search knowledge base for relevant tips
    const { data: knowledgeData, error: knowledgeError } = await supabase
      .rpc('search_knowledge', {
        query_text: `${dayOfWeek} ${hour < 12 ? 'mañana' : hour < 18 ? 'tarde' : 'noche'}`,
        match_count: 2
      })

    if (knowledgeData && knowledgeData.length > 0) {
      suggestions.push(...knowledgeData.map((k: any) => `💡 ${k.content.slice(0, 100)}...`))
    }

    return new Response(
      JSON.stringify({ 
        suggestions,
        context: {
          time: now.toISOString(),
          day: dayOfWeek,
          tasksCount: tasks.length,
          eventsCount: events.length,
          habitsCount: habits.length
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
