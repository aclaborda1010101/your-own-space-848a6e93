CREATE TABLE public.pattern_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES pattern_detector_runs(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL UNIQUE,
  name TEXT DEFAULT 'default',
  is_active BOOLEAN DEFAULT true,
  monthly_usage INTEGER DEFAULT 0,
  monthly_limit INTEGER DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

ALTER TABLE public.pattern_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Run owner manages keys"
  ON public.pattern_api_keys
  FOR ALL
  USING (
    run_id IN (
      SELECT id FROM pattern_detector_runs WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Shared access to pattern api keys"
  ON public.pattern_api_keys
  FOR SELECT
  USING (
    run_id IN (
      SELECT id FROM pattern_detector_runs WHERE has_shared_access(auth.uid(), 'pattern_detector_run', id)
    )
  );