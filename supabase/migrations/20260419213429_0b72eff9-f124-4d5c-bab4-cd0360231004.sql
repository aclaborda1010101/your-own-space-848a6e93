CREATE TABLE IF NOT EXISTS public.daily_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  scope TEXT NOT NULL,
  brief_date DATE NOT NULL DEFAULT CURRENT_DATE,
  content TEXT NOT NULL,
  context_snapshot JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope, brief_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_briefs_user_date ON public.daily_briefs(user_id, brief_date DESC);

ALTER TABLE public.daily_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own daily briefs"
  ON public.daily_briefs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily briefs"
  ON public.daily_briefs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily briefs"
  ON public.daily_briefs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daily briefs"
  ON public.daily_briefs FOR DELETE
  USING (auth.uid() = user_id);