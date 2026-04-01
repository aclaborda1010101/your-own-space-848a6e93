
-- 1. Alter pattern_api_keys: make run_id nullable, add new columns
ALTER TABLE pattern_api_keys 
  ALTER COLUMN run_id DROP NOT NULL;

ALTER TABLE pattern_api_keys 
  ADD COLUMN IF NOT EXISTS project_id UUID,
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS app_name TEXT;

-- 2. Create pattern_feedback table
CREATE TABLE IF NOT EXISTS pattern_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES pattern_api_keys(id),
  feedback_type TEXT NOT NULL,
  sector TEXT,
  geography TEXT,
  outcome TEXT,
  metrics JSONB,
  related_signals TEXT[],
  notes TEXT,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pattern_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on pattern_feedback"
  ON pattern_feedback FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Create pattern_learning_log table
CREATE TABLE IF NOT EXISTS pattern_learning_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID REFERENCES pattern_feedback(id),
  signal_name TEXT NOT NULL,
  adjustment_type TEXT NOT NULL,
  old_credibility TEXT,
  new_credibility TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pattern_learning_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on pattern_learning_log"
  ON pattern_learning_log FOR ALL
  USING (true)
  WITH CHECK (true);
