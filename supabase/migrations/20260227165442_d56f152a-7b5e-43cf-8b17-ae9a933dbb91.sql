
-- =============================================
-- Sprint 1: Pipeline de Proyectos — Wizard
-- =============================================

-- 1. Añadir campos wizard a business_projects
ALTER TABLE public.business_projects
  ADD COLUMN IF NOT EXISTS current_step INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS input_type TEXT,
  ADD COLUMN IF NOT EXISTS input_content TEXT,
  ADD COLUMN IF NOT EXISTS project_type TEXT DEFAULT 'mixto';

-- 2. Crear project_wizard_steps
CREATE TABLE public.project_wizard_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.business_projects(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  input_data JSONB,
  output_data JSONB,
  model_used TEXT,
  version INT NOT NULL DEFAULT 1,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL
);

ALTER TABLE public.project_wizard_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own wizard steps" ON public.project_wizard_steps
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_wizard_steps_project ON public.project_wizard_steps(project_id, step_number);
CREATE INDEX idx_wizard_steps_user ON public.project_wizard_steps(user_id);

-- 3. Crear project_documents
CREATE TABLE public.project_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.business_projects(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  content TEXT,
  format TEXT DEFAULT 'markdown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL
);

ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own project documents" ON public.project_documents
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_project_docs_project ON public.project_documents(project_id, step_number);

-- 4. Crear project_costs
CREATE TABLE public.project_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.business_projects(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  service TEXT NOT NULL,
  operation TEXT NOT NULL,
  tokens_input INT DEFAULT 0,
  tokens_output INT DEFAULT 0,
  api_calls INT DEFAULT 1,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL
);

ALTER TABLE public.project_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own project costs" ON public.project_costs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role inserts costs" ON public.project_costs
  FOR INSERT WITH CHECK (true);

CREATE INDEX idx_project_costs_project ON public.project_costs(project_id);
CREATE INDEX idx_project_costs_step ON public.project_costs(project_id, step_number);

-- Triggers updated_at
CREATE TRIGGER update_wizard_steps_updated_at
  BEFORE UPDATE ON public.project_wizard_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_documents_updated_at
  BEFORE UPDATE ON public.project_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
