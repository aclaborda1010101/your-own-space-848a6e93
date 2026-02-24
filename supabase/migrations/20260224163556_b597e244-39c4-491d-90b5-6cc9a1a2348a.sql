
-- 1. Add columns to business_projects
ALTER TABLE public.business_projects
  ADD COLUMN IF NOT EXISTS linked_rag_id UUID,
  ADD COLUMN IF NOT EXISTS auto_patterns BOOLEAN DEFAULT FALSE;

-- 2. Create pattern_detection_runs table
CREATE TABLE public.pattern_detection_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.business_projects(id) ON DELETE CASCADE,
  rag_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  domain_context JSONB,
  detected_sources JSONB,
  patterns JSONB,
  validation_results JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pattern_detection_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pattern runs"
  ON public.pattern_detection_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pattern runs"
  ON public.pattern_detection_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pattern runs"
  ON public.pattern_detection_runs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pattern runs"
  ON public.pattern_detection_runs FOR DELETE
  USING (auth.uid() = user_id);

-- Service role needs access too (for background jobs)
CREATE POLICY "Service role full access pattern runs"
  ON public.pattern_detection_runs FOR ALL
  USING (auth.role() = 'service_role');

-- 3. Create detected_patterns table
CREATE TABLE public.detected_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.pattern_detection_runs(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.business_projects(id) ON DELETE CASCADE,
  rag_id UUID NOT NULL,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  layer INTEGER NOT NULL CHECK (layer >= 1 AND layer <= 5),
  layer_name TEXT NOT NULL,
  impact NUMERIC,
  confidence NUMERIC,
  p_value NUMERIC,
  anticipation_days INTEGER,
  evidence_chunk_ids UUID[],
  evidence_summary TEXT,
  counter_evidence TEXT,
  data_sources JSONB,
  validation_status TEXT DEFAULT 'pending',
  uncertainty_type TEXT,
  retrospective_cases JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.detected_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own detected patterns"
  ON public.detected_patterns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own detected patterns"
  ON public.detected_patterns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own detected patterns"
  ON public.detected_patterns FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own detected patterns"
  ON public.detected_patterns FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access detected patterns"
  ON public.detected_patterns FOR ALL
  USING (auth.role() = 'service_role');

-- 4. Index on rag_projects.project_id
CREATE INDEX IF NOT EXISTS idx_rag_projects_project_id ON public.rag_projects(project_id);

-- 5. Indexes for pattern tables
CREATE INDEX idx_pattern_runs_project ON public.pattern_detection_runs(project_id);
CREATE INDEX idx_pattern_runs_rag ON public.pattern_detection_runs(rag_id);
CREATE INDEX idx_detected_patterns_run ON public.detected_patterns(run_id);
CREATE INDEX idx_detected_patterns_project ON public.detected_patterns(project_id);
CREATE INDEX idx_detected_patterns_layer ON public.detected_patterns(layer);
