import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface BoscoActivity {
  id: string;
  user_id: string;
  activity_type: string;
  title: string;
  description: string | null;
  language: string;
  duration_minutes: number;
  energy_level: string;
  completed: boolean;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  date: string;
}

export interface VocabularyWord {
  id: string;
  user_id: string;
  word_en: string;
  word_es: string;
  category: string | null;
  times_practiced: number;
  last_practiced_at: string | null;
  is_mastered: boolean;
  created_at: string;
}

export interface VocabularySession {
  id: string;
  user_id: string;
  date: string;
  words_practiced: string[];
  correct_count: number;
  total_count: number;
  notes: string | null;
  created_at: string;
}

const ACTIVITY_TYPES = [
  'juego_vinculo',
  'lectura',
  'ingles_ludico',
  'ia_ninos',
  'movimiento',
  'cierre_dia'
] as const;

export const useBosco = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<BoscoActivity[]>([]);
  const [vocabulary, setVocabulary] = useState<VocabularyWord[]>([]);
  const [todaySessions, setTodaySessions] = useState<VocabularySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingActivities, setGeneratingActivities] = useState(false);

  useEffect(() => {
    if (user) {
      fetchTodayActivities();
      fetchVocabulary();
      fetchTodaySessions();
    }
  }, [user]);

  const fetchTodayActivities = async () => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const { data, error } = await supabase
        .from('bosco_activities')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setActivities((data as BoscoActivity[]) || []);
    } catch (error) {
      console.error('Error fetching Bosco activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVocabulary = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('bosco_vocabulary')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVocabulary((data as VocabularyWord[]) || []);
    } catch (error) {
      console.error('Error fetching vocabulary:', error);
    }
  };

  const fetchTodaySessions = async () => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const { data, error } = await supabase
        .from('bosco_vocabulary_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today);

      if (error) throw error;
      setTodaySessions((data as VocabularySession[]) || []);
    } catch (error) {
      console.error('Error fetching vocabulary sessions:', error);
    }
  };

  const generateActivities = useCallback(async (activityType?: string) => {
    if (!user) return;
    setGeneratingActivities(true);

    try {
      const { data, error } = await supabase.functions.invoke('bosco-activities', {
        body: { 
          activityType: activityType || 'all',
          existingActivities: activities.map(a => a.title)
        }
      });

      if (error) throw error;

      const today = new Date().toISOString().split('T')[0];
      const newActivities = data.activities || [];

      for (const activity of newActivities) {
        const { error: insertError } = await supabase
          .from('bosco_activities')
          .insert({
            user_id: user.id,
            activity_type: activity.type,
            title: activity.title,
            description: activity.description,
            notes: activity.instructions || null,
            language: activity.language || 'es',
            duration_minutes: activity.duration || 15,
            energy_level: activity.energy_level || 'medium',
            date: today
          });

        if (insertError) throw insertError;
      }

      await fetchTodayActivities();
      toast.success('Actividades generadas');
    } catch (error) {
      console.error('Error generating activities:', error);
      toast.error('Error al generar actividades');
    } finally {
      setGeneratingActivities(false);
    }
  }, [user, activities]);

  const generateVocabularySuggestions = useCallback(async () => {
    if (!user) return [];

    try {
      const { data, error } = await supabase.functions.invoke('bosco-activities', {
        body: { 
          generateVocabulary: true,
          existingWords: vocabulary.map(w => w.word_en)
        }
      });

      if (error) throw error;
      return data.vocabulary || [];
    } catch (error) {
      console.error('Error generating vocabulary:', error);
      toast.error('Error al generar vocabulario');
      return [];
    }
  }, [user, vocabulary]);

  const completeActivity = useCallback(async (activityId: string, notes?: string) => {
    try {
      const { error } = await supabase
        .from('bosco_activities')
        .update({ 
          completed: true, 
          completed_at: new Date().toISOString(),
          notes 
        })
        .eq('id', activityId);

      if (error) throw error;
      setActivities(prev => prev.map(a => 
        a.id === activityId ? { ...a, completed: true, completed_at: new Date().toISOString(), notes: notes || null } : a
      ));
      toast.success('Actividad completada');
    } catch (error) {
      console.error('Error completing activity:', error);
      toast.error('Error al completar actividad');
    }
  }, []);

  const deleteActivity = useCallback(async (activityId: string) => {
    try {
      const { error } = await supabase
        .from('bosco_activities')
        .delete()
        .eq('id', activityId);

      if (error) throw error;
      setActivities(prev => prev.filter(a => a.id !== activityId));
    } catch (error) {
      console.error('Error deleting activity:', error);
      toast.error('Error al eliminar actividad');
    }
  }, []);

  const addWord = useCallback(async (wordEn: string, wordEs: string, category?: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('bosco_vocabulary')
        .insert({
          user_id: user.id,
          word_en: wordEn.toLowerCase().trim(),
          word_es: wordEs.toLowerCase().trim(),
          category: category || null
        })
        .select()
        .single();

      if (error) throw error;
      setVocabulary(prev => [data as VocabularyWord, ...prev]);
      toast.success('Palabra añadida');
      return data;
    } catch (error) {
      console.error('Error adding word:', error);
      toast.error('Error al añadir palabra');
    }
  }, [user]);

  const practiceWord = useCallback(async (wordId: string, correct: boolean) => {
    try {
      const word = vocabulary.find(w => w.id === wordId);
      if (!word) return;

      const newTimesPracticed = word.times_practiced + 1;
      const isMastered = correct && newTimesPracticed >= 5;

      const { error } = await supabase
        .from('bosco_vocabulary')
        .update({
          times_practiced: newTimesPracticed,
          last_practiced_at: new Date().toISOString(),
          is_mastered: isMastered
        })
        .eq('id', wordId);

      if (error) throw error;

      setVocabulary(prev => prev.map(w => 
        w.id === wordId 
          ? { ...w, times_practiced: newTimesPracticed, last_practiced_at: new Date().toISOString(), is_mastered: isMastered }
          : w
      ));

      if (isMastered) {
        toast.success(`¡"${word.word_en}" dominada!`);
      }
    } catch (error) {
      console.error('Error practicing word:', error);
    }
  }, [vocabulary]);

  const deleteWord = useCallback(async (wordId: string) => {
    try {
      const { error } = await supabase
        .from('bosco_vocabulary')
        .delete()
        .eq('id', wordId);

      if (error) throw error;
      setVocabulary(prev => prev.filter(w => w.id !== wordId));
      toast.success('Palabra eliminada');
    } catch (error) {
      console.error('Error deleting word:', error);
      toast.error('Error al eliminar palabra');
    }
  }, []);

  const saveSession = useCallback(async (wordsPracticed: string[], correctCount: number, totalCount: number) => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];

    try {
      const { data, error } = await supabase
        .from('bosco_vocabulary_sessions')
        .insert({
          user_id: user.id,
          date: today,
          words_practiced: wordsPracticed,
          correct_count: correctCount,
          total_count: totalCount
        })
        .select()
        .single();

      if (error) throw error;
      setTodaySessions(prev => [...prev, data as VocabularySession]);
      toast.success('Sesión guardada');
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }, [user]);

  const getRandomWords = useCallback((count: number = 5) => {
    const notMastered = vocabulary.filter(w => !w.is_mastered);
    const shuffled = [...notMastered].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }, [vocabulary]);

  return {
    activities,
    vocabulary,
    todaySessions,
    loading,
    generatingActivities,
    generateActivities,
    generateVocabularySuggestions,
    completeActivity,
    deleteActivity,
    addWord,
    practiceWord,
    deleteWord,
    saveSession,
    getRandomWords,
    refetchActivities: fetchTodayActivities,
    refetchVocabulary: fetchVocabulary,
    ACTIVITY_TYPES
  };
};
