CREATE TABLE IF NOT EXISTS public.jarvis_executive_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL DEFAULT CURRENT_DATE,
  summary_text TEXT NOT NULL,
  context_snapshot JSONB,
  model_used TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, summary_date)
);

ALTER TABLE public.jarvis_executive_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own exec summaries"
  ON public.jarvis_executive_summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own exec summaries"
  ON public.jarvis_executive_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own exec summaries"
  ON public.jarvis_executive_summaries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own exec summaries"
  ON public.jarvis_executive_summaries FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_jarvis_exec_summaries_user_date
  ON public.jarvis_executive_summaries (user_id, summary_date DESC);