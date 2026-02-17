
-- Table for individual observations extracted from transcriptions
CREATE TABLE public.bosco_observations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  transcription_id UUID REFERENCES public.transcriptions(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  area TEXT NOT NULL CHECK (area IN ('cognitive', 'linguistic', 'motor', 'social_emotional', 'creative')),
  observation TEXT NOT NULL,
  theory_reference TEXT,
  tags TEXT[] DEFAULT '{}',
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'concern')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table for the evolving intelligent bio/profile
CREATE TABLE public.bosco_profile (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  bio_narrative TEXT,
  gardner_scores JSONB DEFAULT '{"linguistic": 5, "logical_mathematical": 5, "spatial": 5, "musical": 5, "bodily_kinesthetic": 5, "interpersonal": 5, "intrapersonal": 5, "naturalist": 5}',
  personality_traits TEXT[] DEFAULT '{}',
  development_areas JSONB DEFAULT '{"cognitive": {"level": 5, "trend": "stable", "last_milestone": ""}, "linguistic": {"level": 5, "trend": "stable", "last_milestone": ""}, "motor": {"level": 5, "trend": "stable", "last_milestone": ""}, "social_emotional": {"level": 5, "trend": "stable", "last_milestone": ""}, "creative": {"level": 5, "trend": "stable", "last_milestone": ""}}',
  emotional_map JSONB DEFAULT '{"frustrations": [], "joys": [], "fears": []}',
  ai_recommendations JSONB DEFAULT '[]',
  focus_areas JSONB DEFAULT '[]',
  last_analysis_at TIMESTAMPTZ,
  observation_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bosco_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bosco_profile ENABLE ROW LEVEL SECURITY;

-- Policies for bosco_observations
CREATE POLICY "Users can view their own observations"
  ON public.bosco_observations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own observations"
  ON public.bosco_observations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own observations"
  ON public.bosco_observations FOR DELETE USING (auth.uid() = user_id);

-- Policies for bosco_profile
CREATE POLICY "Users can view their own profile"
  ON public.bosco_profile FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile"
  ON public.bosco_profile FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile"
  ON public.bosco_profile FOR UPDATE USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_bosco_observations_user_date ON public.bosco_observations(user_id, date DESC);
CREATE INDEX idx_bosco_observations_area ON public.bosco_observations(user_id, area);
