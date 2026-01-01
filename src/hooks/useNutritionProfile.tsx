import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

export interface NutritionProfile {
  id: string;
  user_id: string;
  eating_style: string;
  max_complexity: string;
  decision_fatigue: string;
  intermittent_fasting: boolean;
  first_meal_time: string;
  main_meal_time: string;
  dinner_time: string;
  preferred_foods: string[];
  tolerated_foods: string[];
  rejected_foods: string[];
  active_diet: string;
  training_frequency: string;
  training_type: string;
  nutritional_goal: string;
  personal_rules: string[];
  supplements: Supplement[];
  menu_templates: MenuTemplates;
  learned_patterns: Record<string, any>;
}

export interface Supplement {
  name: string;
  dose: string;
  moment: string;
  alarm: boolean;
}

export interface MenuTemplates {
  normal: { breakfast: string; lunch: string; dinner: string };
  keto: { breakfast: string; lunch: string; dinner: string };
  stress: { breakfast: string; lunch: string; dinner: string };
}

export interface SupplementLog {
  id: string;
  supplement_name: string;
  taken_at: string;
  date: string;
}

const defaultMenuTemplates: MenuTemplates = {
  normal: { breakfast: "Atún + lechuga + aceite", lunch: "Carne + arroz blanco", dinner: "Crema suave + embutido" },
  keto: { breakfast: "Huevos + embutido", lunch: "Carne + queso", dinner: "Atún o tortilla francesa" },
  stress: { breakfast: "Atún solo", lunch: "Plato repetido favorito", dinner: "Cena ligera sin pensar" },
};

export const useNutritionProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<NutritionProfile | null>(null);
  const [supplementLogs, setSupplementLogs] = useState<SupplementLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchTodaySupplementLogs();
    }
  }, [user]);

  const parseProfile = (data: any): NutritionProfile => ({
    ...data,
    preferred_foods: (data.preferred_foods as string[]) || [],
    tolerated_foods: (data.tolerated_foods as string[]) || [],
    rejected_foods: (data.rejected_foods as string[]) || [],
    personal_rules: (data.personal_rules as string[]) || [],
    supplements: (data.supplements as unknown as Supplement[]) || [],
    menu_templates: (data.menu_templates as unknown as MenuTemplates) || defaultMenuTemplates,
    learned_patterns: (data.learned_patterns as Record<string, any>) || {},
  });

  const fetchProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('nutrition_profile')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile(parseProfile(data));
      } else {
        const { data: newProfile, error: insertError } = await supabase
          .from('nutrition_profile')
          .insert({ user_id: user.id })
          .select()
          .single();

        if (insertError) throw insertError;
        setProfile(parseProfile(newProfile));
      }
    } catch (error) {
      console.error('Error fetching nutrition profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTodaySupplementLogs = async () => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    
    try {
      const { data, error } = await supabase
        .from('supplement_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today);

      if (error) throw error;
      setSupplementLogs(data || []);
    } catch (error) {
      console.error('Error fetching supplement logs:', error);
    }
  };

  const updateProfile = useCallback(async (updates: Partial<NutritionProfile>) => {
    if (!user || !profile) return;

    // Convert arrays to JSON-compatible format
    const dbUpdates: Record<string, Json | undefined> = {};
    for (const [key, value] of Object.entries(updates)) {
      dbUpdates[key] = value as Json;
    }

    try {
      const { error } = await supabase
        .from('nutrition_profile')
        .update(dbUpdates)
        .eq('user_id', user.id);

      if (error) throw error;
      setProfile((prev) => prev ? { ...prev, ...updates } : null);
      toast.success('Perfil actualizado');
    } catch (error) {
      console.error('Error updating nutrition profile:', error);
      toast.error('Error al actualizar perfil');
    }
  }, [user, profile]);

  const logSupplement = useCallback(async (supplementName: string) => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    
    try {
      const { data, error } = await supabase
        .from('supplement_logs')
        .insert({
          user_id: user.id,
          supplement_name: supplementName,
          date: today,
        })
        .select()
        .single();

      if (error) throw error;
      setSupplementLogs((prev) => [...prev, data]);
      toast.success(`${supplementName} registrado`);
    } catch (error) {
      console.error('Error logging supplement:', error);
      toast.error('Error al registrar suplemento');
    }
  }, [user]);

  const removeSupplementLog = useCallback(async (logId: string) => {
    try {
      const { error } = await supabase
        .from('supplement_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;
      setSupplementLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch (error) {
      console.error('Error removing supplement log:', error);
    }
  }, []);

  return {
    profile,
    supplementLogs,
    loading,
    updateProfile,
    logSupplement,
    removeSupplementLog,
    refetch: fetchProfile,
  };
};
