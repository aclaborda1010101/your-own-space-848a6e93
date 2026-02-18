
-- 1. Nueva tabla phone_contacts (agenda oculta)
CREATE TABLE public.phone_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  phone_numbers TEXT[] DEFAULT '{}',
  email TEXT,
  company TEXT,
  birthday TEXT,
  raw_data JSONB,
  linked_contact_id UUID REFERENCES public.people_contacts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX idx_phone_contacts_user_id ON public.phone_contacts(user_id);
CREATE INDEX idx_phone_contacts_display_name ON public.phone_contacts USING gin(display_name gin_trgm_ops);

-- RLS
ALTER TABLE public.phone_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own phone contacts"
  ON public.phone_contacts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own phone contacts"
  ON public.phone_contacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own phone contacts"
  ON public.phone_contacts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own phone contacts"
  ON public.phone_contacts FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Nuevas columnas en people_contacts
ALTER TABLE public.people_contacts ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;
ALTER TABLE public.people_contacts ADD COLUMN IF NOT EXISTS phone_numbers TEXT[] DEFAULT '{}';
ALTER TABLE public.people_contacts ADD COLUMN IF NOT EXISTS wa_message_count INTEGER DEFAULT 0;
