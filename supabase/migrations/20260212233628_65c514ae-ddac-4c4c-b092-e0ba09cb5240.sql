
-- Pipeline tables for multi-model AI project analysis

CREATE TABLE public.project_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  idea_description TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','paused','error')),
  current_step INTEGER DEFAULT 0,
  final_document TEXT,
  lovable_prompt TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.pipeline_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID REFERENCES public.project_pipelines(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL CHECK (step_number BETWEEN 1 AND 4),
  model_name TEXT NOT NULL,
  role_description TEXT,
  input_content TEXT,
  output_content TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','error')),
  tokens_used INTEGER,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.project_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_pipelines" ON public.project_pipelines
  FOR ALL USING (auth.uid() = user_id);

-- Security definer function to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.user_owns_pipeline(p_pipeline_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_pipelines
    WHERE id = p_pipeline_id AND user_id = auth.uid()
  );
$$;

CREATE POLICY "users_view_steps" ON public.pipeline_steps
  FOR ALL USING (public.user_owns_pipeline(pipeline_id));

-- Trigger for updated_at
CREATE TRIGGER update_project_pipelines_updated_at
  BEFORE UPDATE ON public.project_pipelines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
