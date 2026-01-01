import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface CoachStats {
  streak_days: number;
  total_sessions: number;
  total_insights: number;
  goal_90_days: string | null;
  goal_progress: number;
}

interface Habit {
  id: string;
  name: string;
  streak: number;
  target: number;
  last_completed_at: string | null;
}

interface KPI {
  id: string;
  category: string;
  name: string;
  value: number;
  target: number;
  unit: string | null;
}

const DEFAULT_HABITS = [
  { name: 'Meditación', target: 30 },
  { name: 'Ejercicio', target: 7 },
  { name: 'Lectura', target: 14 },
  { name: 'Journaling', target: 7 },
];

const DEFAULT_KPIS = [
  { category: 'negocio', name: 'Leads generados', target: 20, unit: 'leads' },
  { category: 'negocio', name: 'Propuestas enviadas', target: 5, unit: '' },
  { category: 'negocio', name: 'Cierres', target: 2, unit: '' },
  { category: 'contenido', name: 'Stories publicadas', target: 5, unit: '/semana' },
  { category: 'contenido', name: 'Posts LinkedIn', target: 3, unit: '/semana' },
  { category: 'salud', name: 'Días de entreno', target: 4, unit: '/semana' },
  { category: 'salud', name: 'Horas de sueño', target: 7.5, unit: 'h avg' },
];

export function useCoachStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<CoachStats | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);

  const initializeDefaults = useCallback(async () => {
    if (!user) return;

    // Initialize stats if not exists
    const { data: existingStats } = await supabase
      .from('coach_stats')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!existingStats) {
      await supabase.from('coach_stats').insert({
        user_id: user.id,
        streak_days: 0,
        total_sessions: 0,
        total_insights: 0,
        goal_90_days: 'Escalar el negocio a 10k€/mes con sistema de contenido + productos digitales',
        goal_progress: 0,
      });
    }

    // Initialize habits if not exists
    const { data: existingHabits } = await supabase
      .from('coach_habits')
      .select('*')
      .eq('user_id', user.id);

    if (!existingHabits || existingHabits.length === 0) {
      const habitsToInsert = DEFAULT_HABITS.map(h => ({
        user_id: user.id,
        name: h.name,
        streak: 0,
        target: h.target,
      }));
      await supabase.from('coach_habits').insert(habitsToInsert);
    }

    // Initialize KPIs if not exists
    const { data: existingKpis } = await supabase
      .from('coach_kpis')
      .select('*')
      .eq('user_id', user.id);

    if (!existingKpis || existingKpis.length === 0) {
      const kpisToInsert = DEFAULT_KPIS.map(k => ({
        user_id: user.id,
        category: k.category,
        name: k.name,
        value: 0,
        target: k.target,
        unit: k.unit,
      }));
      await supabase.from('coach_kpis').insert(kpisToInsert);
    }
  }, [user]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      await initializeDefaults();

      const [statsRes, habitsRes, kpisRes] = await Promise.all([
        supabase.from('coach_stats').select('*').eq('user_id', user.id).single(),
        supabase.from('coach_habits').select('*').eq('user_id', user.id),
        supabase.from('coach_kpis').select('*').eq('user_id', user.id),
      ]);

      if (statsRes.data) setStats(statsRes.data);
      if (habitsRes.data) setHabits(habitsRes.data);
      if (kpisRes.data) setKpis(kpisRes.data);
    } catch (error) {
      console.error('Error fetching coach stats:', error);
    } finally {
      setLoading(false);
    }
  }, [user, initializeDefaults]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const incrementStreak = async () => {
    if (!user || !stats) return;

    try {
      const { error } = await supabase
        .from('coach_stats')
        .update({ 
          streak_days: stats.streak_days + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;
      setStats(prev => prev ? { ...prev, streak_days: prev.streak_days + 1 } : prev);
    } catch (error) {
      console.error('Error incrementing streak:', error);
    }
  };

  const incrementSessions = async () => {
    if (!user || !stats) return;

    try {
      const { error } = await supabase
        .from('coach_stats')
        .update({ 
          total_sessions: stats.total_sessions + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;
      setStats(prev => prev ? { ...prev, total_sessions: prev.total_sessions + 1 } : prev);
    } catch (error) {
      console.error('Error incrementing sessions:', error);
    }
  };

  const addInsight = async () => {
    if (!user || !stats) return;

    try {
      const { error } = await supabase
        .from('coach_stats')
        .update({ 
          total_insights: stats.total_insights + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;
      setStats(prev => prev ? { ...prev, total_insights: prev.total_insights + 1 } : prev);
      toast.success('Insight guardado');
    } catch (error) {
      console.error('Error adding insight:', error);
    }
  };

  const updateGoalProgress = async (progress: number) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('coach_stats')
        .update({ 
          goal_progress: progress,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;
      setStats(prev => prev ? { ...prev, goal_progress: progress } : prev);
    } catch (error) {
      console.error('Error updating goal progress:', error);
    }
  };

  const completeHabit = async (habitName: string) => {
    if (!user) return;

    const habit = habits.find(h => h.name === habitName);
    if (!habit) return;

    try {
      const { error } = await supabase
        .from('coach_habits')
        .update({ 
          streak: habit.streak + 1,
          last_completed_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('name', habitName);

      if (error) throw error;
      
      setHabits(prev => prev.map(h => 
        h.name === habitName 
          ? { ...h, streak: h.streak + 1, last_completed_at: new Date().toISOString() }
          : h
      ));
      toast.success(`+1 día en ${habitName}`);
    } catch (error) {
      console.error('Error completing habit:', error);
    }
  };

  const updateKPI = async (category: string, name: string, value: number) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('coach_kpis')
        .update({ 
          value,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('category', category)
        .eq('name', name);

      if (error) throw error;
      
      setKpis(prev => prev.map(k => 
        k.category === category && k.name === name 
          ? { ...k, value }
          : k
      ));
    } catch (error) {
      console.error('Error updating KPI:', error);
    }
  };

  const getKPIsByCategory = (category: string) => {
    return kpis.filter(k => k.category === category);
  };

  return {
    stats,
    habits,
    kpis,
    loading,
    incrementStreak,
    incrementSessions,
    addInsight,
    updateGoalProgress,
    completeHabit,
    updateKPI,
    getKPIsByCategory,
    refetch: fetchData,
  };
}
