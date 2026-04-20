CREATE TABLE public.contact_headline_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_id UUID NOT NULL,
  signature TEXT NOT NULL,
  original_title TEXT NOT NULL,
  decision TEXT NOT NULL DEFAULT 'done',
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_headline_dismissals_user_contact
  ON public.contact_headline_dismissals (user_id, contact_id);

CREATE INDEX idx_contact_headline_dismissals_signature
  ON public.contact_headline_dismissals (user_id, contact_id, signature);

ALTER TABLE public.contact_headline_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own headline dismissals"
ON public.contact_headline_dismissals
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own headline dismissals"
ON public.contact_headline_dismissals
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own headline dismissals"
ON public.contact_headline_dismissals
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own headline dismissals"
ON public.contact_headline_dismissals
FOR DELETE
USING (auth.uid() = user_id);