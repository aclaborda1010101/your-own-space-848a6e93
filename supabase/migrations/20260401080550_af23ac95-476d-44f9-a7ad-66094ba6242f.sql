
CREATE TABLE public.pattern_detector_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_mime_type TEXT,
  file_size_bytes BIGINT,
  drive_file_id TEXT NOT NULL,
  extracted_text TEXT,
  relevance_score NUMERIC(3,2),
  relevance_reason TEXT,
  classification TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pattern_detector_datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own datasets" ON public.pattern_detector_datasets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own datasets" ON public.pattern_detector_datasets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own datasets" ON public.pattern_detector_datasets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users delete own datasets" ON public.pattern_detector_datasets
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access datasets" ON public.pattern_detector_datasets
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
