
-- ============================================================================
-- FASE 1: AI Business Leverage — Schema
-- ============================================================================

-- 1. Add columns to business_projects
ALTER TABLE public.business_projects
  ADD COLUMN IF NOT EXISTS sector TEXT,
  ADD COLUMN IF NOT EXISTS business_size TEXT,
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS time_horizon TEXT;

-- 2. Questionnaire Templates (public read, user-managed)
CREATE TABLE public.bl_questionnaire_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector TEXT NOT NULL,
  business_size TEXT NOT NULL,
  max_questions INT NOT NULL,
  questions JSONB NOT NULL,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bl_questionnaire_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read questionnaire templates"
  ON public.bl_questionnaire_templates FOR SELECT USING (true);

-- 3. Questionnaire Responses
CREATE TABLE public.bl_questionnaire_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.business_projects(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.bl_questionnaire_templates(id),
  responses JSONB NOT NULL DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bl_quest_responses_project ON public.bl_questionnaire_responses(project_id);
ALTER TABLE public.bl_questionnaire_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own questionnaire responses"
  ON public.bl_questionnaire_responses FOR ALL
  USING (public.user_owns_business_project(project_id))
  WITH CHECK (public.user_owns_business_project(project_id));

-- 4. Business Diagnostics
CREATE TABLE public.bl_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.business_projects(id) ON DELETE CASCADE,
  digital_maturity_score INT CHECK (digital_maturity_score BETWEEN 0 AND 100),
  automation_level INT CHECK (automation_level BETWEEN 0 AND 100),
  data_readiness INT CHECK (data_readiness BETWEEN 0 AND 100),
  ai_opportunity_score INT CHECK (ai_opportunity_score BETWEEN 0 AND 100),
  manual_processes JSONB DEFAULT '[]',
  time_leaks JSONB DEFAULT '[]',
  person_dependencies JSONB DEFAULT '[]',
  bottlenecks JSONB DEFAULT '[]',
  quick_wins JSONB DEFAULT '[]',
  underused_tools JSONB DEFAULT '[]',
  data_gaps JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bl_diagnostics_project ON public.bl_diagnostics(project_id);
ALTER TABLE public.bl_diagnostics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own diagnostics"
  ON public.bl_diagnostics FOR ALL
  USING (public.user_owns_business_project(project_id))
  WITH CHECK (public.user_owns_business_project(project_id));

-- 5. Recommendations
CREATE TABLE public.bl_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.business_projects(id) ON DELETE CASCADE,
  layer INT NOT NULL CHECK (layer BETWEEN 1 AND 5),
  title TEXT NOT NULL,
  description TEXT,
  time_saved_hours_week_min NUMERIC(5,1),
  time_saved_hours_week_max NUMERIC(5,1),
  productivity_uplift_pct_min NUMERIC(5,1),
  productivity_uplift_pct_max NUMERIC(5,1),
  revenue_impact_month_min NUMERIC(10,2),
  revenue_impact_month_max NUMERIC(10,2),
  investment_month_min NUMERIC(10,2),
  investment_month_max NUMERIC(10,2),
  difficulty TEXT NOT NULL DEFAULT 'medium',
  difficulty_score INT CHECK (difficulty_score BETWEEN 1 AND 5),
  implementation_time TEXT,
  confidence_display TEXT NOT NULL DEFAULT 'medium',
  confidence_score_internal NUMERIC(3,2) CHECK (confidence_score_internal BETWEEN 0 AND 1),
  estimation_source TEXT NOT NULL DEFAULT 'logical_estimation',
  priority_score NUMERIC(6,3),
  implementable_under_14_days BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bl_recommendations_project ON public.bl_recommendations(project_id);
CREATE INDEX idx_bl_recommendations_priority ON public.bl_recommendations(priority_score DESC);
ALTER TABLE public.bl_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own recommendations"
  ON public.bl_recommendations FOR ALL
  USING (public.user_owns_business_project(project_id))
  WITH CHECK (public.user_owns_business_project(project_id));

-- 6. Roadmaps
CREATE TABLE public.bl_roadmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.business_projects(id) ON DELETE CASCADE,
  version INT DEFAULT 1,
  executive_summary TEXT,
  quick_wins_plan JSONB,
  plan_90_days JSONB,
  plan_12_months JSONB,
  economic_impact JSONB,
  implementation_model TEXT,
  pricing_recommendation JSONB,
  full_document_md TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bl_roadmaps_project ON public.bl_roadmaps(project_id);
ALTER TABLE public.bl_roadmaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own roadmaps"
  ON public.bl_roadmaps FOR ALL
  USING (public.user_owns_business_project(project_id))
  WITH CHECK (public.user_owns_business_project(project_id));

-- 7. Client Proposals
CREATE TABLE public.bl_client_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.business_projects(id) ON DELETE CASCADE,
  roadmap_id UUID REFERENCES public.bl_roadmaps(id),
  client_name TEXT,
  client_email TEXT,
  status TEXT DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bl_proposals_project ON public.bl_client_proposals(project_id);
ALTER TABLE public.bl_client_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own proposals"
  ON public.bl_client_proposals FOR ALL
  USING (public.user_owns_business_project(project_id))
  WITH CHECK (public.user_owns_business_project(project_id));
