
-- 1. Extend suggestions table
ALTER TABLE public.suggestions
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS confidence NUMERIC(3,2) DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS reasoning TEXT,
  ADD COLUMN IF NOT EXISTS contact_id UUID,
  ADD COLUMN IF NOT EXISTS source_message_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS signature TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS suggestions_user_signature_key
  ON public.suggestions(user_id, signature)
  WHERE signature IS NOT NULL AND status = 'pending';

CREATE INDEX IF NOT EXISTS suggestions_user_status_created_idx
  ON public.suggestions(user_id, status, created_at DESC);

-- 2. Feedback for learning loop
CREATE TABLE IF NOT EXISTS public.suggestion_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  suggestion_id UUID,
  suggestion_type TEXT NOT NULL,
  source TEXT,
  contact_id UUID,
  decision TEXT NOT NULL CHECK (decision IN ('accepted','rejected','edited','snoozed')),
  confidence_at_decision NUMERIC(3,2),
  reasoning_snapshot TEXT,
  signature TEXT,
  reason_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.suggestion_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedback_select_own" ON public.suggestion_feedback;
CREATE POLICY "feedback_select_own" ON public.suggestion_feedback
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "feedback_insert_own" ON public.suggestion_feedback;
CREATE POLICY "feedback_insert_own" ON public.suggestion_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS suggestion_feedback_user_decision_idx
  ON public.suggestion_feedback(user_id, decision, created_at DESC);

-- 3. Contact refresh state (per-contact threshold tracking)
CREATE TABLE IF NOT EXISTS public.contact_refresh_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  contact_id UUID NOT NULL,
  last_scan_at TIMESTAMPTZ,
  last_scan_message_count INTEGER DEFAULT 0,
  total_messages_seen INTEGER DEFAULT 0,
  last_signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, contact_id)
);

ALTER TABLE public.contact_refresh_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "refresh_select_own" ON public.contact_refresh_state;
CREATE POLICY "refresh_select_own" ON public.contact_refresh_state
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "refresh_modify_own" ON public.contact_refresh_state;
CREATE POLICY "refresh_modify_own" ON public.contact_refresh_state
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS contact_refresh_state_user_idx
  ON public.contact_refresh_state(user_id, contact_id);
