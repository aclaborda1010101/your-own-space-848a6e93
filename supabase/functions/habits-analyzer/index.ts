import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { chat, ChatMessage } from "../_shared/ai-client.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface CheckIn {
  date: string;
  energy: number;
  mood: number;
  focus: number;
  day_mode: string;
}

interface Task {
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  type: string;
  priority: string;
}

interface PomodoroSession {
  completed_at: string;
  duration: number;
  type: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, question } = await req.json();

    if (action === 'analyze') {
      // Fetch last 30 days of data
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

      const [checkInsRes, tasksRes, pomodoroRes, dailyLogsRes] = await Promise.all([
        supabase.from('check_ins').select('*').gte('date', dateStr).order('date', { ascending: false }),
        supabase.from('tasks').select('*').gte('created_at', thirtyDaysAgo.toISOString()),
        supabase.from('pomodoro_sessions').select('*').gte('completed_at', thirtyDaysAgo.toISOString()),
        supabase.from('daily_logs').select('*').gte('date', dateStr),
      ]);

      const checkIns = (checkInsRes.data || []) as CheckIn[];
      const tasks = (tasksRes.data || []) as Task[];
      const pomodoros = (pomodoroRes.data || []) as PomodoroSession[];
      const dailyLogs = dailyLogsRes.data || [];

      // Calculate patterns
      const patterns = analyzePatterns(checkIns, tasks, pomodoros, dailyLogs);
      
      // Generate insights using AI
      let insights: { title: string; description: string; category: string; insight_type: string; confidence_score: number }[] = [];
      
      if (checkIns.length > 5) {
        const prompt = `Analiza estos datos de productividad de un usuario y genera 3-5 insights accionables en español.

DATOS:
- Promedio de energía: ${patterns.avgEnergy.toFixed(1)}/10
- Promedio de enfoque: ${patterns.avgFocus.toFixed(1)}/10
- Promedio de ánimo: ${patterns.avgMood.toFixed(1)}/10
- Tareas completadas: ${patterns.tasksCompleted}/${patterns.totalTasks} (${patterns.completionRate}%)
- Sesiones pomodoro: ${patterns.pomodoroCount}
- Día más productivo: ${patterns.bestDay}
- Hora típica de mayor actividad: ${patterns.peakHour}
- Modo de día más frecuente: ${patterns.commonDayMode}

Genera un JSON array con insights. Cada insight debe tener:
- title: título corto (máx 50 chars)
- description: descripción accionable (máx 150 chars)
- category: 'energy' | 'productivity' | 'mood' | 'schedule'
- insight_type: 'pattern' | 'recommendation' | 'correlation'
- confidence_score: 0.5-0.95

Solo responde con el JSON array, sin explicación adicional.`;

        try {
          const content = await chat(
            [{ role: 'user', content: prompt }],
            { model: 'gemini-flash', responseFormat: 'json' }
          );
          
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            insights = JSON.parse(jsonMatch[0]);
          }
        } catch (aiError) {
          console.error('AI analysis error:', aiError);
        }
      }

      // Fallback insights if AI fails or not enough data
      if (insights.length === 0) {
        insights = generateFallbackInsights(patterns);
      }

      // Save insights to database
      for (const insight of insights) {
        await supabase.from('habit_insights').upsert({
          user_id: user.id,
          title: insight.title,
          description: insight.description,
          category: insight.category,
          insight_type: insight.insight_type,
          confidence_score: insight.confidence_score,
          evidence: patterns,
          is_active: true,
        }, { onConflict: 'user_id,title' });
      }

      // Save weekly pattern
      const weekStart = getWeekStart(new Date());
      await supabase.from('weekly_patterns').upsert({
        user_id: user.id,
        week_start: weekStart,
        patterns: patterns,
        metrics: {
          avgEnergy: patterns.avgEnergy,
          avgFocus: patterns.avgFocus,
          avgMood: patterns.avgMood,
          completionRate: patterns.completionRate,
        },
        summary: `Semana con ${patterns.completionRate}% de tareas completadas. Energía promedio: ${patterns.avgEnergy.toFixed(1)}/10.`,
      }, { onConflict: 'user_id,week_start' });

      return new Response(JSON.stringify({ 
        success: true, 
        insights,
        patterns 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'query' && question) {
      // Fetch insights and patterns for this user
      const [insightsRes, patternsRes] = await Promise.all([
        supabase.from('habit_insights').select('*').eq('is_active', true).order('confidence_score', { ascending: false }).limit(10),
        supabase.from('weekly_patterns').select('*').order('week_start', { ascending: false }).limit(4),
      ]);

      const insights = insightsRes.data || [];
      const patterns = patternsRes.data || [];

      // Build context for answering
      const context = {
        insights: insights.map(i => `${i.title}: ${i.description}`).join('\n'),
        recentPatterns: patterns.length > 0 ? JSON.stringify(patterns[0]?.metrics) : 'Sin datos suficientes',
      };

      return new Response(JSON.stringify({
        success: true,
        answer: buildHabitAnswer(question, context, insights, patterns),
        insights,
        patterns,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in habits-analyzer:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function analyzePatterns(checkIns: CheckIn[], tasks: Task[], pomodoros: PomodoroSession[], dailyLogs: any[]) {
  // Energy, focus, mood averages
  const avgEnergy = checkIns.length > 0 
    ? checkIns.reduce((sum, c) => sum + c.energy, 0) / checkIns.length 
    : 5;
  const avgFocus = checkIns.length > 0 
    ? checkIns.reduce((sum, c) => sum + c.focus, 0) / checkIns.length 
    : 5;
  const avgMood = checkIns.length > 0 
    ? checkIns.reduce((sum, c) => sum + c.mood, 0) / checkIns.length 
    : 5;

  // Task completion
  const completedTasks = tasks.filter(t => t.completed);
  const tasksCompleted = completedTasks.length;
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((tasksCompleted / totalTasks) * 100) : 0;

  // Pomodoro stats
  const pomodoroCount = pomodoros.length;
  const totalPomodoroMinutes = pomodoros.reduce((sum, p) => sum + p.duration, 0);

  // Best day analysis
  const dayCompletions: Record<string, number> = {};
  completedTasks.forEach(t => {
    if (t.completed_at) {
      const day = new Date(t.completed_at).toLocaleDateString('es-ES', { weekday: 'long' });
      dayCompletions[day] = (dayCompletions[day] || 0) + 1;
    }
  });
  const bestDay = Object.entries(dayCompletions).sort((a, b) => b[1] - a[1])[0]?.[0] || 'No hay datos';

  // Peak hour
  const hourCompletions: Record<number, number> = {};
  completedTasks.forEach(t => {
    if (t.completed_at) {
      const hour = new Date(t.completed_at).getHours();
      hourCompletions[hour] = (hourCompletions[hour] || 0) + 1;
    }
  });
  const peakHour = Object.entries(hourCompletions).sort((a, b) => b[1] - a[1])[0]?.[0] || '10';

  // Common day mode
  const dayModes: Record<string, number> = {};
  checkIns.forEach(c => {
    dayModes[c.day_mode] = (dayModes[c.day_mode] || 0) + 1;
  });
  const commonDayMode = Object.entries(dayModes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'balanced';

  return {
    avgEnergy,
    avgFocus,
    avgMood,
    tasksCompleted,
    totalTasks,
    completionRate,
    pomodoroCount,
    totalPomodoroMinutes,
    bestDay,
    peakHour: `${peakHour}:00`,
    commonDayMode,
    checkInDays: checkIns.length,
  };
}

function generateFallbackInsights(patterns: any) {
  const insights = [];

  if (patterns.avgEnergy < 5) {
    insights.push({
      title: 'Energía por debajo del promedio',
      description: 'Considera revisar tu descanso y alimentación para mejorar tus niveles de energía.',
      category: 'energy',
      insight_type: 'recommendation',
      confidence_score: 0.7,
    });
  }

  if (patterns.completionRate > 70) {
    insights.push({
      title: 'Excelente tasa de completado',
      description: `Completas el ${patterns.completionRate}% de tus tareas. ¡Mantén el ritmo!`,
      category: 'productivity',
      insight_type: 'pattern',
      confidence_score: 0.85,
    });
  } else if (patterns.completionRate < 50) {
    insights.push({
      title: 'Oportunidad de mejora',
      description: 'Intenta reducir el número de tareas diarias para aumentar tu tasa de completado.',
      category: 'productivity',
      insight_type: 'recommendation',
      confidence_score: 0.75,
    });
  }

  if (patterns.bestDay !== 'No hay datos') {
    insights.push({
      title: `${patterns.bestDay} es tu mejor día`,
      description: `Tiendes a completar más tareas los ${patterns.bestDay}. Aprovecha ese momentum.`,
      category: 'schedule',
      insight_type: 'pattern',
      confidence_score: 0.8,
    });
  }

  return insights;
}

function buildHabitAnswer(question: string, context: any, insights: any[], patterns: any[]) {
  const q = question.toLowerCase();
  
  if (q.includes('productiv') || q.includes('cómo voy') || q.includes('rendimiento')) {
    const latestPattern = patterns[0];
    if (latestPattern?.metrics) {
      return `Según tus datos recientes, tu tasa de completado de tareas es del ${latestPattern.metrics.completionRate}%. Tu energía promedio es ${latestPattern.metrics.avgEnergy?.toFixed(1) || 'N/A'}/10 y tu enfoque ${latestPattern.metrics.avgFocus?.toFixed(1) || 'N/A'}/10.`;
    }
    return 'Aún no tengo suficientes datos para analizar tu productividad. Continúa registrando tus check-ins diarios.';
  }

  if (q.includes('energía') || q.includes('energy')) {
    const energyInsight = insights.find(i => i.category === 'energy');
    if (energyInsight) {
      return `${energyInsight.title}: ${energyInsight.description}`;
    }
    return 'No tengo suficientes datos sobre tu energía todavía.';
  }

  if (q.includes('mejor día') || q.includes('cuándo soy')) {
    const scheduleInsight = insights.find(i => i.category === 'schedule');
    if (scheduleInsight) {
      return scheduleInsight.description;
    }
    return 'Necesito más datos para determinar tus mejores días de productividad.';
  }

  // Default response with available insights
  if (insights.length > 0) {
    return `Basándome en tus datos: ${insights.slice(0, 2).map(i => i.description).join(' ')}`;
  }

  return 'Continúa usando la app para que pueda aprender más sobre tus patrones y darte insights personalizados.';
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}
