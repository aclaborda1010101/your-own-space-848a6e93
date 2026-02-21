
-- ============================================
-- Pattern Detector v1 — 6 tables
-- ============================================

-- 1. pattern_detector_runs
CREATE TABLE public.pattern_detector_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.business_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  sector TEXT,
  geography TEXT,
  time_horizon TEXT,
  business_objective TEXT,
  baseline_definition TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  current_phase INT NOT NULL DEFAULT 0,
  phase_results JSONB DEFAULT '{}'::jsonb,
  quality_gate JSONB,
  quality_gate_passed BOOLEAN,
  dashboard_output JSONB,
  model_verdict TEXT DEFAULT 'NOT_RELIABLE_YET',
  tokens_used JSONB DEFAULT '{}'::jsonb,
  error_log TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pattern_detector_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own runs" ON public.pattern_detector_runs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_pattern_detector_runs_updated_at BEFORE UPDATE ON public.pattern_detector_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. data_sources_registry
CREATE TABLE public.data_sources_registry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES public.pattern_detector_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  source_name TEXT NOT NULL,
  url TEXT,
  source_type TEXT DEFAULT 'Web',
  reliability_score INT DEFAULT 5,
  data_type TEXT,
  update_frequency TEXT,
  coverage_period TEXT,
  status TEXT DEFAULT 'active',
  scraped_content TEXT,
  last_accessed TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.data_sources_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sources" ON public.data_sources_registry FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. signal_registry
CREATE TABLE public.signal_registry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES public.pattern_detector_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  layer_id INT NOT NULL,
  layer_name TEXT NOT NULL,
  signal_name TEXT NOT NULL,
  description TEXT,
  confidence NUMERIC DEFAULT 0,
  p_value NUMERIC,
  impact TEXT DEFAULT 'medium',
  trend TEXT DEFAULT 'stable',
  uncertainty_type TEXT DEFAULT 'epistemic',
  devil_advocate_result TEXT,
  contradicting_evidence TEXT,
  data_source TEXT,
  sector TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.signal_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own signals" ON public.signal_registry FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. project_datasets
CREATE TABLE public.project_datasets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES public.pattern_detector_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  source_type TEXT DEFAULT 'user_upload',
  file_url TEXT,
  row_count INT,
  column_count INT,
  quality_report JSONB,
  confidential BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_datasets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own datasets" ON public.project_datasets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. model_backtests
CREATE TABLE public.model_backtests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES public.pattern_detector_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  baseline_rmse NUMERIC,
  naive_rmse NUMERIC,
  model_rmse NUMERIC,
  uplift_vs_naive_pct NUMERIC,
  uplift_vs_baseline_pct NUMERIC,
  complexity_justified BOOLEAN,
  win_rate_pct NUMERIC,
  precision_pct NUMERIC,
  recall_pct NUMERIC,
  false_positives INT DEFAULT 0,
  false_negatives INT DEFAULT 0,
  avg_anticipation_days NUMERIC,
  cost_simulation JSONB,
  retrospective_cases JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.model_backtests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own backtests" ON public.model_backtests FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. rag_quality_logs
CREATE TABLE public.rag_quality_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES public.pattern_detector_runs(id) ON DELETE CASCADE,
  coverage_pct NUMERIC,
  freshness_pct NUMERIC,
  source_diversity INT,
  avg_reliability_score NUMERIC,
  status TEXT DEFAULT 'PASS',
  gap_analysis JSONB,
  self_healing_iterations INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rag_quality_logs ENABLE ROW LEVEL SECURITY;
-- rag_quality_logs needs user_id for RLS - add it
ALTER TABLE public.rag_quality_logs ADD COLUMN user_id UUID NOT NULL;
CREATE POLICY "Users manage own quality logs" ON public.rag_quality_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
