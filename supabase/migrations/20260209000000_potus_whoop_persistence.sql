-- =====================================================
-- JARVIS POTUS + WHOOP + PERSISTENCIA - 2026-02-09
-- =====================================================

-- 1. ACTUALIZAR whoop_data para histórico (cambiar UNIQUE constraint)
-- Drop existing unique constraint and add new one with date
DO $$ 
BEGIN
  -- Remove old unique constraint on user_id only
  ALTER TABLE public.whoop_data DROP CONSTRAINT IF EXISTS whoop_data_user_id_key;
  
  -- Add new unique constraint on user_id + date
  ALTER TABLE public.whoop_data 
  ADD CONSTRAINT whoop_data_user_date_unique UNIQUE (user_id, data_date);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Constraint already exists or table structure different';
END $$;

-- Add raw_data column if not exists
ALTER TABLE public.whoop_data ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}';

-- 2. TABLA user_profile_extended
CREATE TABLE IF NOT EXISTS public.user_profile_extended (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  
  -- Preferencias generales
  preferences JSONB DEFAULT '{}',
  goals JSONB DEFAULT '{}',
  
  -- Notas de especialistas
  coach_notes JSONB DEFAULT '[]',
  nutrition_notes JSONB DEFAULT '[]',
  english_notes JSONB DEFAULT '[]',
  
  -- Preferencias por área
  nutrition_preferences JSONB DEFAULT '{}',
  workout_preferences JSONB DEFAULT '{}',
  
  -- Inglés
  english_level TEXT DEFAULT 'intermediate',
  english_progress JSONB DEFAULT '{}',
  
  -- Bosco (hijo)
  bosco_child_info JSONB DEFAULT '{}',
  
  -- Stats coaching
  last_coach_session TIMESTAMPTZ,
  total_coach_sessions INT DEFAULT 0,
  
  -- POTUS insights
  potus_insights JSONB DEFAULT '[]',
  last_potus_analysis TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para user_profile_extended
ALTER TABLE public.user_profile_extended ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own extended profile"
ON public.user_profile_extended FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own extended profile"
ON public.user_profile_extended FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own extended profile"
ON public.user_profile_extended FOR UPDATE
USING (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "Service role full access to user_profile_extended"
ON public.user_profile_extended FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- 3. TABLA coach_sessions
CREATE TABLE IF NOT EXISTS public.coach_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  session_type TEXT DEFAULT 'daily', -- daily, weekly, crisis, celebration
  
  -- Resumen
  summary TEXT,
  key_insights JSONB DEFAULT '[]',
  action_items JSONB DEFAULT '[]',
  
  -- Estado emocional
  emotional_state_start JSONB,
  emotional_state_end JSONB,
  protocol_used TEXT,
  
  -- Duración y transcripción
  duration_minutes INT,
  transcript JSONB DEFAULT '[]',
  message_count INT DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- RLS para coach_sessions
ALTER TABLE public.coach_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own coach sessions"
ON public.coach_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own coach sessions"
ON public.coach_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own coach sessions"
ON public.coach_sessions FOR UPDATE
USING (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "Service role full access to coach_sessions"
ON public.coach_sessions FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Indices
CREATE INDEX IF NOT EXISTS idx_coach_sessions_user_id ON public.coach_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_sessions_date ON public.coach_sessions(session_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_profile_extended_user_id ON public.user_profile_extended(user_id);

-- 4. TABLA specialist_memory (memoria compartida entre especialistas)
CREATE TABLE IF NOT EXISTS public.specialist_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  specialist TEXT NOT NULL, -- coach, nutrition, english, potus, bosco
  memory_type TEXT NOT NULL, -- fact, preference, insight, goal, concern
  
  content TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  
  importance INT DEFAULT 5, -- 1-10
  expires_at TIMESTAMPTZ, -- NULL = never expires
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para specialist_memory
ALTER TABLE public.specialist_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own specialist memory"
ON public.specialist_memory FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own specialist memory"
ON public.specialist_memory FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own specialist memory"
ON public.specialist_memory FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own specialist memory"
ON public.specialist_memory FOR DELETE
USING (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "Service role full access to specialist_memory"
ON public.specialist_memory FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

CREATE INDEX IF NOT EXISTS idx_specialist_memory_user_specialist 
ON public.specialist_memory(user_id, specialist);
CREATE INDEX IF NOT EXISTS idx_specialist_memory_importance 
ON public.specialist_memory(importance DESC);

-- 5. TABLA potus_daily_summary (resumen diario de POTUS)
CREATE TABLE IF NOT EXISTS public.potus_daily_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  summary_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Datos agregados
  whoop_summary JSONB, -- recovery, strain, sleep
  tasks_summary JSONB, -- completed, pending, overdue
  sessions_summary JSONB, -- coach, english, nutrition
  
  -- Insights generados por POTUS
  daily_insight TEXT,
  recommendations JSONB DEFAULT '[]',
  
  -- Correlaciones detectadas
  correlations JSONB DEFAULT '[]',
  
  -- Score del día
  productivity_score INT,
  wellbeing_score INT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, summary_date)
);

-- RLS para potus_daily_summary
ALTER TABLE public.potus_daily_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own POTUS summaries"
ON public.potus_daily_summary FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to potus_daily_summary"
ON public.potus_daily_summary FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

CREATE INDEX IF NOT EXISTS idx_potus_daily_user_date 
ON public.potus_daily_summary(user_id, summary_date DESC);

-- 6. Función helper para obtener memoria de un especialista
CREATE OR REPLACE FUNCTION get_specialist_memories(
  p_user_id UUID,
  p_specialist TEXT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  memory_type TEXT,
  content TEXT,
  context JSONB,
  importance INT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sm.memory_type,
    sm.content,
    sm.context,
    sm.importance,
    sm.created_at
  FROM specialist_memory sm
  WHERE sm.user_id = p_user_id
    AND sm.specialist = p_specialist
    AND (sm.expires_at IS NULL OR sm.expires_at > NOW())
  ORDER BY sm.importance DESC, sm.last_used DESC
  LIMIT p_limit;
END;
$$;

-- 7. Función helper para obtener datos WHOOP recientes
CREATE OR REPLACE FUNCTION get_recent_whoop_data(
  p_user_id UUID,
  p_days INT DEFAULT 7
)
RETURNS TABLE (
  data_date DATE,
  recovery_score INT,
  hrv INT,
  strain NUMERIC,
  sleep_hours NUMERIC,
  resting_hr INT,
  sleep_performance INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wd.data_date,
    wd.recovery_score,
    wd.hrv,
    wd.strain,
    wd.sleep_hours,
    wd.resting_hr,
    wd.sleep_performance
  FROM whoop_data wd
  WHERE wd.user_id = p_user_id
    AND wd.data_date >= CURRENT_DATE - p_days
  ORDER BY wd.data_date DESC;
END;
$$;

-- 8. Función para obtener contexto completo para POTUS
CREATE OR REPLACE FUNCTION get_potus_context(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  v_profile RECORD;
  v_whoop RECORD;
  v_last_session RECORD;
  v_memories JSONB;
BEGIN
  -- Get extended profile
  SELECT * INTO v_profile FROM user_profile_extended WHERE user_id = p_user_id;
  
  -- Get today's WHOOP data
  SELECT * INTO v_whoop FROM whoop_data 
  WHERE user_id = p_user_id AND data_date = CURRENT_DATE;
  
  -- Get last coach session
  SELECT * INTO v_last_session FROM coach_sessions 
  WHERE user_id = p_user_id 
  ORDER BY session_date DESC LIMIT 1;
  
  -- Get recent memories (top 5 most important)
  SELECT jsonb_agg(row_to_json(m))
  INTO v_memories
  FROM (
    SELECT specialist, memory_type, content, importance
    FROM specialist_memory 
    WHERE user_id = p_user_id
    ORDER BY importance DESC, last_used DESC
    LIMIT 5
  ) m;
  
  result := jsonb_build_object(
    'profile', CASE WHEN v_profile IS NULL THEN '{}'::jsonb 
      ELSE jsonb_build_object(
        'goals', v_profile.goals,
        'preferences', v_profile.preferences,
        'english_level', v_profile.english_level,
        'total_coach_sessions', v_profile.total_coach_sessions
      )
    END,
    'whoop_today', CASE WHEN v_whoop IS NULL THEN NULL
      ELSE jsonb_build_object(
        'recovery', v_whoop.recovery_score,
        'hrv', v_whoop.hrv,
        'strain', v_whoop.strain,
        'sleep_hours', v_whoop.sleep_hours,
        'resting_hr', v_whoop.resting_hr
      )
    END,
    'last_session', CASE WHEN v_last_session IS NULL THEN NULL
      ELSE jsonb_build_object(
        'date', v_last_session.session_date,
        'type', v_last_session.session_type,
        'summary', v_last_session.summary,
        'action_items', v_last_session.action_items
      )
    END,
    'key_memories', COALESCE(v_memories, '[]'::jsonb)
  );
  
  RETURN result;
END;
$$;

COMMENT ON TABLE user_profile_extended IS 'Extended user profile with specialist notes and preferences';
COMMENT ON TABLE coach_sessions IS 'Coach session records with transcripts and insights';
COMMENT ON TABLE specialist_memory IS 'Shared memory store for all specialists';
COMMENT ON TABLE potus_daily_summary IS 'Daily summary generated by POTUS';
