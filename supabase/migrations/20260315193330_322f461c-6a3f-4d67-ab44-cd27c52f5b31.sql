CREATE TABLE public.plaud_dismissed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_email_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, source_email_id)
);

ALTER TABLE public.plaud_dismissed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dismissed emails"
  ON public.plaud_dismissed_emails FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dismissed emails"
  ON public.plaud_dismissed_emails FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own dismissed emails"
  ON public.plaud_dismissed_emails FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);