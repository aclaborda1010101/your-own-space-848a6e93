-- Tabla para almacenar insights aprendidos sobre hábitos del usuario
CREATE TABLE public.habit_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  insight_type TEXT NOT NULL, -- 'pattern', 'recommendation', 'correlation'
  category TEXT, -- 'energy', 'productivity', 'mood', 'schedule'
  title TEXT NOT NULL,
  description TEXT,
  evidence JSONB DEFAULT '{}'::jsonb, -- datos que soportan el insight
  confidence_score DECIMAL(3,2) DEFAULT 0.5, -- 0.00 a 1.00
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla para seguimiento de patrones semanales
CREATE TABLE public.weekly_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  patterns JSONB NOT NULL DEFAULT '{}'::jsonb, -- patrones detectados esa semana
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb, -- métricas agregadas
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.habit_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_patterns ENABLE ROW LEVEL SECURITY;

-- RLS policies for habit_insights
CREATE POLICY "Users can view their own habit insights"
ON public.habit_insights FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own habit insights"
ON public.habit_insights FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own habit insights"
ON public.habit_insights FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own habit insights"
ON public.habit_insights FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for weekly_patterns
CREATE POLICY "Users can view their own weekly patterns"
ON public.weekly_patterns FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own weekly patterns"
ON public.weekly_patterns FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weekly patterns"
ON public.weekly_patterns FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own weekly patterns"
ON public.weekly_patterns FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_habit_insights_updated_at
BEFORE UPDATE ON public.habit_insights
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index para búsqueda rápida
CREATE INDEX idx_habit_insights_user_active ON public.habit_insights(user_id, is_active);
CREATE INDEX idx_habit_insights_category ON public.habit_insights(user_id, category);
CREATE INDEX idx_weekly_patterns_user_week ON public.weekly_patterns(user_id, week_start DESC);