
-- =============================================
-- MVP v2: Ideas/Projects, Suggestions, CRM
-- =============================================

-- 1. Table: ideas_projects
CREATE TABLE public.ideas_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  origin TEXT NOT NULL DEFAULT 'manual',
  maturity_state TEXT NOT NULL DEFAULT 'seed',
  category TEXT,
  mention_count INTEGER NOT NULL DEFAULT 1,
  interest_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  related_people JSONB DEFAULT '[]'::jsonb,
  notes JSONB DEFAULT '[]'::jsonb,
  source_transcription_id UUID REFERENCES public.transcriptions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ideas_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ideas" ON public.ideas_projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own ideas" ON public.ideas_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own ideas" ON public.ideas_projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own ideas" ON public.ideas_projects FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_ideas_projects_updated_at
  BEFORE UPDATE ON public.ideas_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Table: suggestions
CREATE TABLE public.suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  suggestion_type TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  source_transcription_id UUID REFERENCES public.transcriptions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own suggestions" ON public.suggestions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own suggestions" ON public.suggestions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own suggestions" ON public.suggestions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own suggestions" ON public.suggestions FOR DELETE USING (auth.uid() = user_id);

-- 3. Extend people_contacts with CRM fields
ALTER TABLE public.people_contacts
  ADD COLUMN IF NOT EXISTS company TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS wa_id TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS scores JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sentiment TEXT;
