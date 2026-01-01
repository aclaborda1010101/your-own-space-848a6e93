import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface VocabularySession {
  id: string;
  date: string;
  correct_count: number | null;
  total_count: number | null;
  created_at: string;
}

interface VocabularyWord {
  id: string;
  is_mastered: boolean;
  created_at: string;
}

export function useBoscoAnalytics() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<VocabularySession[]>([]);
  const [vocabulary, setVocabulary] = useState<VocabularyWord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch all sessions
        const { data: sessionsData, error: sessionsError } = await supabase
          .from('bosco_vocabulary_sessions')
          .select('id, date, correct_count, total_count, created_at')
          .eq('user_id', user.id)
          .order('date', { ascending: true });

        if (sessionsError) throw sessionsError;
        setSessions(sessionsData || []);

        // Fetch all vocabulary
        const { data: vocabData, error: vocabError } = await supabase
          .from('bosco_vocabulary')
          .select('id, is_mastered, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (vocabError) throw vocabError;
        setVocabulary(vocabData || []);
      } catch (error) {
        console.error('Error fetching Bosco analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  return {
    sessions,
    vocabulary,
    loading
  };
}
