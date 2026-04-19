
-- Tabla de feedback bruto
CREATE TABLE public.jarvis_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  feedback_type TEXT NOT NULL, -- 'suggestion_accept', 'suggestion_reject', 'classification_correct', 'priority_change'
  suggestion_type TEXT, -- 'task_from_plaud', 'classification_from_plaud', etc.
  source_id UUID, -- id de la sugerencia, tarea, transcripción, etc.
  initial_confidence NUMERIC,
  initial_value JSONB, -- valor sugerido por JARVIS
  corrected_value JSONB, -- valor corregido por el usuario (si aplica)
  context JSONB, -- proyecto_id, contact_ids, excerpt, etc.
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_jarvis_feedback_user_type ON public.jarvis_feedback(user_id, suggestion_type, created_at DESC);
CREATE INDEX idx_jarvis_feedback_user_action ON public.jarvis_feedback(user_id, feedback_type, created_at DESC);

ALTER TABLE public.jarvis_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own feedback" ON public.jarvis_feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own feedback" ON public.jarvis_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own feedback" ON public.jarvis_feedback FOR DELETE USING (auth.uid() = user_id);

-- Tabla de patrones aprendidos
CREATE TABLE public.jarvis_learned_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pattern_type TEXT NOT NULL, -- 'priority_boost', 'classification_hint', 'suggestion_threshold'
  pattern_key TEXT NOT NULL, -- ej: 'task_type:bosco', 'project:centros_comerciales'
  pattern_data JSONB NOT NULL DEFAULT '{}'::jsonb, -- detalles del patrón
  evidence_count INTEGER NOT NULL DEFAULT 1,
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'rejected'
  description TEXT,
  applied_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, pattern_type, pattern_key)
);

CREATE INDEX idx_jarvis_patterns_user_status ON public.jarvis_learned_patterns(user_id, status);

ALTER TABLE public.jarvis_learned_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own patterns" ON public.jarvis_learned_patterns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own patterns" ON public.jarvis_learned_patterns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own patterns" ON public.jarvis_learned_patterns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own patterns" ON public.jarvis_learned_patterns FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_jarvis_patterns_updated_at
  BEFORE UPDATE ON public.jarvis_learned_patterns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabla de salud por tipo de sugerencia
CREATE TABLE public.jarvis_suggestion_health (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  suggestion_type TEXT NOT NULL,
  total_count INTEGER NOT NULL DEFAULT 0,
  accepted_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  recent_reject_rate NUMERIC NOT NULL DEFAULT 0, -- ratio últimas 10
  threshold_adjustment NUMERIC NOT NULL DEFAULT 0, -- delta aplicado a la confianza mínima
  status TEXT NOT NULL DEFAULT 'healthy', -- 'healthy', 'warning', 'degraded'
  last_alert_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, suggestion_type)
);

ALTER TABLE public.jarvis_suggestion_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own health" ON public.jarvis_suggestion_health FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own health" ON public.jarvis_suggestion_health FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own health" ON public.jarvis_suggestion_health FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_jarvis_health_updated_at
  BEFORE UPDATE ON public.jarvis_suggestion_health
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Función para refrescar la salud de una sugerencia
CREATE OR REPLACE FUNCTION public.refresh_jarvis_suggestion_health(p_user_id UUID, p_suggestion_type TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
  v_accepted INTEGER;
  v_rejected INTEGER;
  v_recent_rejects INTEGER;
  v_recent_total INTEGER;
  v_reject_rate NUMERIC;
  v_status TEXT;
  v_adjust NUMERIC;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE feedback_type IN ('suggestion_accept','suggestion_reject')),
    COUNT(*) FILTER (WHERE feedback_type = 'suggestion_accept'),
    COUNT(*) FILTER (WHERE feedback_type = 'suggestion_reject')
  INTO v_total, v_accepted, v_rejected
  FROM jarvis_feedback
  WHERE user_id = p_user_id AND suggestion_type = p_suggestion_type;

  WITH last10 AS (
    SELECT feedback_type FROM jarvis_feedback
    WHERE user_id = p_user_id 
      AND suggestion_type = p_suggestion_type
      AND feedback_type IN ('suggestion_accept','suggestion_reject')
    ORDER BY created_at DESC LIMIT 10
  )
  SELECT
    COUNT(*) FILTER (WHERE feedback_type = 'suggestion_reject'),
    COUNT(*)
  INTO v_recent_rejects, v_recent_total
  FROM last10;

  v_reject_rate := CASE WHEN v_recent_total > 0 THEN v_recent_rejects::NUMERIC / v_recent_total ELSE 0 END;
  
  IF v_recent_total >= 5 AND v_reject_rate > 0.7 THEN
    v_status := 'degraded';
    v_adjust := 0.15; -- subir umbral
  ELSIF v_recent_total >= 5 AND v_reject_rate > 0.5 THEN
    v_status := 'warning';
    v_adjust := 0.05;
  ELSE
    v_status := 'healthy';
    v_adjust := 0;
  END IF;

  INSERT INTO jarvis_suggestion_health (user_id, suggestion_type, total_count, accepted_count, rejected_count, recent_reject_rate, threshold_adjustment, status, last_alert_at)
  VALUES (p_user_id, p_suggestion_type, v_total, v_accepted, v_rejected, v_reject_rate, v_adjust, v_status,
    CASE WHEN v_status = 'degraded' THEN now() ELSE NULL END)
  ON CONFLICT (user_id, suggestion_type) DO UPDATE
  SET total_count = EXCLUDED.total_count,
      accepted_count = EXCLUDED.accepted_count,
      rejected_count = EXCLUDED.rejected_count,
      recent_reject_rate = EXCLUDED.recent_reject_rate,
      threshold_adjustment = EXCLUDED.threshold_adjustment,
      status = EXCLUDED.status,
      last_alert_at = CASE WHEN EXCLUDED.status = 'degraded' AND jarvis_suggestion_health.status <> 'degraded' THEN now() ELSE jarvis_suggestion_health.last_alert_at END,
      updated_at = now();
END;
$$;
