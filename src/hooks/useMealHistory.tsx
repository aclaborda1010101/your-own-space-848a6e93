import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface MealHistoryEntry {
  id: string;
  user_id: string;
  date: string;
  meal_type: string;
  meal_name: string;
  recipe_data: any;
  was_completed: boolean;
  energy_after: number | null;
  notes: string | null;
  created_at: string;
}

export const useMealHistory = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<MealHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

  const fetchHistory = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('meal_history')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setHistory((data || []) as MealHistoryEntry[]);
    } catch (error) {
      console.error('Error fetching meal history:', error);
    } finally {
      setLoading(false);
    }
  };

  const addMealToHistory = useCallback(async (
    mealType: string,
    mealName: string,
    recipeData?: any
  ) => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    
    try {
      const { data, error } = await supabase
        .from('meal_history')
        .insert({
          user_id: user.id,
          date: today,
          meal_type: mealType,
          meal_name: mealName,
          recipe_data: recipeData || null,
        })
        .select()
        .single();

      if (error) throw error;
      setHistory((prev) => [data as MealHistoryEntry, ...prev]);
      toast.success('Comida registrada en historial');
      return data;
    } catch (error) {
      console.error('Error adding meal to history:', error);
      toast.error('Error al registrar comida');
    }
  }, [user]);

  const markMealCompleted = useCallback(async (mealId: string, energyAfter?: number, notes?: string) => {
    try {
      const { error } = await supabase
        .from('meal_history')
        .update({
          was_completed: true,
          energy_after: energyAfter || null,
          notes: notes || null,
        })
        .eq('id', mealId);

      if (error) throw error;
      setHistory((prev) =>
        prev.map((m) =>
          m.id === mealId
            ? { ...m, was_completed: true, energy_after: energyAfter || null, notes: notes || null }
            : m
        )
      );
    } catch (error) {
      console.error('Error updating meal:', error);
    }
  }, []);

  const getRecentMeals = useCallback((days: number = 7) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];
    
    return history.filter((m) => m.date >= cutoffStr);
  }, [history]);

  const getMealFrequency = useCallback(() => {
    const frequency: Record<string, number> = {};
    history.forEach((m) => {
      frequency[m.meal_name] = (frequency[m.meal_name] || 0) + 1;
    });
    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [history]);

  return {
    history,
    loading,
    addMealToHistory,
    markMealCompleted,
    getRecentMeals,
    getMealFrequency,
    refetch: fetchHistory,
  };
};
