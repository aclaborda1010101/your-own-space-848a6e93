-- =============================================================
-- Evolución de Señales por Capa — Fase 1: Schema
-- =============================================================

-- 1. Add trial columns to signal_registry
ALTER TABLE signal_registry ADD COLUMN IF NOT EXISTS trial_status TEXT DEFAULT 'established'
  CHECK (trial_status IN ('established', 'trial', 'graduated', 'rejected'));
ALTER TABLE signal_registry ADD COLUMN IF NOT EXISTS replaces_signal TEXT;
ALTER TABLE signal_registry ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMPTZ;
ALTER TABLE signal_registry ADD COLUMN IF NOT EXISTS trial_min_evaluations INTEGER DEFAULT 10;
ALTER TABLE signal_registry ADD COLUMN IF NOT EXISTS formula TEXT;
ALTER TABLE signal_registry ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES business_projects(id) ON DELETE CASCADE;

-- 2. signal_performance table
CREATE TABLE IF NOT EXISTS signal_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES business_projects(id) ON DELETE CASCADE,
  run_id UUID,
  signal_name TEXT NOT NULL,
  layer_id INTEGER,
  correct_predictions INTEGER DEFAULT 0,
  incorrect_predictions INTEGER DEFAULT 0,
  accuracy NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'degraded', 'disabled', 'promoted', 'trial', 'replaced')),
  last_evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE signal_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view signal_performance for their projects"
  ON signal_performance FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM business_projects WHERE id = project_id AND user_id = auth.uid()));

CREATE POLICY "Users can manage signal_performance for their projects"
  ON signal_performance FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM business_projects WHERE id = project_id AND user_id = auth.uid()));

-- 3. learning_events table
CREATE TABLE IF NOT EXISTS learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES business_projects(id) ON DELETE CASCADE,
  run_id UUID,
  event_type TEXT NOT NULL,
  signals_involved JSONB,
  analysis TEXT,
  action_taken TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE learning_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view learning_events for their projects"
  ON learning_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM business_projects WHERE id = project_id AND user_id = auth.uid()));

CREATE POLICY "Users can manage learning_events for their projects"
  ON learning_events FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM business_projects WHERE id = project_id AND user_id = auth.uid()));

-- 4. improvement_proposals table
CREATE TABLE IF NOT EXISTS improvement_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES business_projects(id) ON DELETE CASCADE,
  run_id UUID,
  proposal_type TEXT NOT NULL DEFAULT 'signal_replacement',
  signal_name TEXT,
  layer_id INTEGER,
  diagnosis JSONB,
  proposed_replacements JSONB,
  recommendation TEXT,
  recommendation_reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'applied')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE improvement_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view improvement_proposals for their projects"
  ON improvement_proposals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM business_projects WHERE id = project_id AND user_id = auth.uid()));

CREATE POLICY "Users can manage improvement_proposals for their projects"
  ON improvement_proposals FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM business_projects WHERE id = project_id AND user_id = auth.uid()));

-- 5. model_change_log table
CREATE TABLE IF NOT EXISTS model_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES business_projects(id) ON DELETE CASCADE,
  version_id INTEGER,
  change_type TEXT NOT NULL,
  signal_name TEXT,
  previous_state JSONB,
  new_state JSONB,
  applied_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE model_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view model_change_log for their projects"
  ON model_change_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM business_projects WHERE id = project_id AND user_id = auth.uid()));

CREATE POLICY "Users can manage model_change_log for their projects"
  ON model_change_log FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM business_projects WHERE id = project_id AND user_id = auth.uid()));
