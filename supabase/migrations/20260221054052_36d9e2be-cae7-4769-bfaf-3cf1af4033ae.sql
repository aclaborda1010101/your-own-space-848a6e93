
-- Create project_context table for Auto-Research
CREATE TABLE public.project_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.business_projects(id) ON DELETE CASCADE,
  source_url TEXT,
  company_name TEXT,
  company_description TEXT,
  sector_detected TEXT,
  geography_detected TEXT,
  products_services JSONB DEFAULT '[]',
  tech_stack_detected JSONB DEFAULT '[]',
  social_media JSONB DEFAULT '{}',
  competitors JSONB DEFAULT '[]',
  reviews_summary JSONB DEFAULT '{}',
  sector_trends JSONB DEFAULT '[]',
  news_mentions JSONB DEFAULT '[]',
  public_data JSONB DEFAULT '{}',
  raw_research TEXT,
  confidence_score NUMERIC(3,2),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by project
CREATE INDEX idx_project_context_project ON public.project_context(project_id);

-- Enable RLS
ALTER TABLE public.project_context ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own project context"
  ON public.project_context FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own project context"
  ON public.project_context FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own project context"
  ON public.project_context FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own project context"
  ON public.project_context FOR DELETE
  USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_project_context_updated_at
  BEFORE UPDATE ON public.project_context
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
