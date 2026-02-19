
-- =============================================
-- BUSINESS PROJECTS MODULE - Phase 1
-- =============================================

-- 1. Main projects table
CREATE TABLE public.business_projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'nuevo',
  origin text,
  origin_source_id text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  primary_contact_id uuid REFERENCES public.people_contacts(id) ON DELETE SET NULL,
  company text,
  estimated_value numeric,
  close_probability text DEFAULT 'media',
  need_summary text,
  need_why text,
  need_deadline text,
  need_budget text,
  need_decision_maker text,
  need_source_url text,
  analysis jsonb,
  closed_at timestamptz,
  close_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own business_projects" ON public.business_projects
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_business_projects_updated_at
  BEFORE UPDATE ON public.business_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_business_projects_user_status ON public.business_projects(user_id, status);

-- 2. Project contacts (roles)
CREATE TABLE public.business_project_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.business_projects(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.people_contacts(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'cliente',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, contact_id)
);

ALTER TABLE public.business_project_contacts ENABLE ROW LEVEL SECURITY;

-- Security definer function to check project ownership
CREATE OR REPLACE FUNCTION public.user_owns_business_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_projects
    WHERE id = p_project_id AND user_id = auth.uid()
  );
$$;

CREATE POLICY "Users manage own project contacts" ON public.business_project_contacts
  FOR ALL USING (public.user_owns_business_project(project_id))
  WITH CHECK (public.user_owns_business_project(project_id));

-- 3. Project timeline
CREATE TABLE public.business_project_timeline (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.business_projects(id) ON DELETE CASCADE,
  event_date timestamptz NOT NULL,
  channel text NOT NULL,
  title text NOT NULL,
  description text,
  source_id text,
  contact_id uuid REFERENCES public.people_contacts(id) ON DELETE SET NULL,
  auto_detected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_project_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own project timeline" ON public.business_project_timeline
  FOR ALL USING (public.user_owns_business_project(project_id))
  WITH CHECK (public.user_owns_business_project(project_id));

CREATE INDEX idx_bpt_project_date ON public.business_project_timeline(project_id, event_date DESC);
CREATE INDEX idx_bpt_project_channel ON public.business_project_timeline(project_id, channel);

-- 4. Add project_id to tasks
ALTER TABLE public.tasks ADD COLUMN project_id uuid REFERENCES public.business_projects(id) ON DELETE SET NULL;
CREATE INDEX idx_tasks_project ON public.tasks(project_id) WHERE project_id IS NOT NULL;
