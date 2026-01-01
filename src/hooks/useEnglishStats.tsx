import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface EnglishStats {
  streak_days: number;
  total_chunks_learned: number;
  total_practice_minutes: number;
  shadowing_sessions: number;
  roleplay_sessions: number;
  mini_tests_completed: number;
  bosco_games_played: number;
}

interface Chunk {
  id: string;
  phrase_en: string;
  phrase_es: string;
  category: string | null;
  mastered: boolean;
  times_practiced: number;
}

export function useEnglishStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<EnglishStats | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(true);

  const initializeStats = useCallback(async () => {
    if (!user) return;

    const { data: existing } = await supabase
      .from('english_stats')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!existing) {
      await supabase.from('english_stats').insert({
        user_id: user.id,
        streak_days: 0,
        total_chunks_learned: 0,
        total_practice_minutes: 0,
        shadowing_sessions: 0,
        roleplay_sessions: 0,
        mini_tests_completed: 0,
        bosco_games_played: 0,
      });
    }
  }, [user]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      await initializeStats();

      const [statsRes, chunksRes] = await Promise.all([
        supabase.from('english_stats').select('*').eq('user_id', user.id).single(),
        supabase.from('english_chunks').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);

      if (statsRes.data) setStats(statsRes.data);
      if (chunksRes.data) setChunks(chunksRes.data);
    } catch (error) {
      console.error('Error fetching english stats:', error);
    } finally {
      setLoading(false);
    }
  }, [user, initializeStats]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const incrementStat = async (field: keyof EnglishStats, amount: number = 1) => {
    if (!user || !stats) return;

    try {
      const newValue = (stats[field] as number) + amount;
      const { error } = await supabase
        .from('english_stats')
        .update({ 
          [field]: newValue,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;
      setStats(prev => prev ? { ...prev, [field]: newValue } : prev);
    } catch (error) {
      console.error('Error incrementing stat:', error);
    }
  };

  const addChunk = async (phraseEn: string, phraseEs: string, category?: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('english_chunks')
        .insert({
          user_id: user.id,
          phrase_en: phraseEn,
          phrase_es: phraseEs,
          category,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setChunks(prev => [data, ...prev]);
        await incrementStat('total_chunks_learned');
        toast.success('Chunk añadido');
      }
    } catch (error) {
      console.error('Error adding chunk:', error);
      toast.error('Error al añadir chunk');
    }
  };

  const practiceChunk = async (chunkId: string, correct: boolean) => {
    if (!user) return;

    try {
      const chunk = chunks.find(c => c.id === chunkId);
      if (!chunk) return;

      const newTimesPracticed = chunk.times_practiced + 1;
      const shouldMaster = correct && newTimesPracticed >= 5;

      const { error } = await supabase
        .from('english_chunks')
        .update({
          times_practiced: newTimesPracticed,
          mastered: shouldMaster,
          last_practiced_at: new Date().toISOString(),
        })
        .eq('id', chunkId);

      if (error) throw error;
      
      setChunks(prev => prev.map(c => 
        c.id === chunkId 
          ? { ...c, times_practiced: newTimesPracticed, mastered: shouldMaster }
          : c
      ));

      if (shouldMaster) {
        toast.success('¡Chunk dominado!');
      }
    } catch (error) {
      console.error('Error practicing chunk:', error);
    }
  };

  const recordShadowingSession = async (minutes: number) => {
    await incrementStat('shadowing_sessions');
    await incrementStat('total_practice_minutes', minutes);
    await incrementStat('streak_days');
    toast.success('Sesión de shadowing completada');
  };

  const recordRoleplaySession = async (minutes: number) => {
    await incrementStat('roleplay_sessions');
    await incrementStat('total_practice_minutes', minutes);
    await incrementStat('streak_days');
    toast.success('Sesión de roleplay completada');
  };

  const recordMiniTest = async () => {
    await incrementStat('mini_tests_completed');
    await incrementStat('streak_days');
    toast.success('Mini test completado');
  };

  const recordBoscoGame = async (minutes: number) => {
    await incrementStat('bosco_games_played');
    await incrementStat('total_practice_minutes', minutes);
    await incrementStat('streak_days');
    toast.success('Juego con Bosco completado');
  };

  const getRandomChunks = (count: number = 10): Chunk[] => {
    const unmastered = chunks.filter(c => !c.mastered);
    const shuffled = [...unmastered].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  return {
    stats,
    chunks,
    loading,
    addChunk,
    practiceChunk,
    recordShadowingSession,
    recordRoleplaySession,
    recordMiniTest,
    recordBoscoGame,
    getRandomChunks,
    refetch: fetchData,
  };
}
