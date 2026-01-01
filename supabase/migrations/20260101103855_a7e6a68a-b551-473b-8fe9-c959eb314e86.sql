-- Tabla para actividades de Bosco generadas
CREATE TABLE public.bosco_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL, -- juego_vinculo, lectura, ingles_ludico, ia_ninos, movimiento, cierre_dia
  title TEXT NOT NULL,
  description TEXT,
  language TEXT DEFAULT 'es', -- es, en, mixed
  duration_minutes INTEGER DEFAULT 15,
  energy_level TEXT DEFAULT 'medium', -- low, medium, high
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Tabla para vocabulario inglés de Bosco
CREATE TABLE public.bosco_vocabulary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  word_en TEXT NOT NULL,
  word_es TEXT NOT NULL,
  category TEXT, -- animales, colores, numeros, objetos, acciones, etc
  times_practiced INTEGER DEFAULT 0,
  last_practiced_at TIMESTAMP WITH TIME ZONE,
  is_mastered BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla para sesiones del juego de vocabulario
CREATE TABLE public.bosco_vocabulary_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  words_practiced UUID[] DEFAULT '{}',
  correct_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Añadir campos al user_profile para modos especiales y configuración Bosco
ALTER TABLE public.user_profile 
ADD COLUMN IF NOT EXISTS current_mode TEXT DEFAULT 'normal', -- normal, vacation, crisis
ADD COLUMN IF NOT EXISTS mode_activated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS daily_routine JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS special_days JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS rest_rules JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS bosco_settings JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS planning_rules JSONB DEFAULT '{}';

-- Enable RLS
ALTER TABLE public.bosco_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bosco_vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bosco_vocabulary_sessions ENABLE ROW LEVEL SECURITY;

-- Policies para bosco_activities
CREATE POLICY "Users can view their own bosco activities" 
ON public.bosco_activities FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bosco activities" 
ON public.bosco_activities FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bosco activities" 
ON public.bosco_activities FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bosco activities" 
ON public.bosco_activities FOR DELETE USING (auth.uid() = user_id);

-- Policies para bosco_vocabulary
CREATE POLICY "Users can view their own bosco vocabulary" 
ON public.bosco_vocabulary FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bosco vocabulary" 
ON public.bosco_vocabulary FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bosco vocabulary" 
ON public.bosco_vocabulary FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bosco vocabulary" 
ON public.bosco_vocabulary FOR DELETE USING (auth.uid() = user_id);

-- Policies para bosco_vocabulary_sessions
CREATE POLICY "Users can view their own vocabulary sessions" 
ON public.bosco_vocabulary_sessions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own vocabulary sessions" 
ON public.bosco_vocabulary_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vocabulary sessions" 
ON public.bosco_vocabulary_sessions FOR UPDATE USING (auth.uid() = user_id);