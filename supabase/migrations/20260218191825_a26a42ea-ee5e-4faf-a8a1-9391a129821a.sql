
-- Table to store actual message content for RAG analysis
CREATE TABLE public.contact_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_id UUID REFERENCES public.people_contacts(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'whatsapp',
  sender TEXT,
  content TEXT NOT NULL,
  message_date TIMESTAMPTZ,
  chat_name TEXT,
  direction TEXT NOT NULL DEFAULT 'incoming',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_contact_messages_contact ON public.contact_messages(contact_id);
CREATE INDEX idx_contact_messages_user ON public.contact_messages(user_id);
CREATE INDEX idx_contact_messages_date ON public.contact_messages(message_date DESC);

-- RLS
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contact messages"
  ON public.contact_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contact messages"
  ON public.contact_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own contact messages"
  ON public.contact_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Add personality_profile JSONB column to people_contacts if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'people_contacts' AND column_name = 'personality_profile'
  ) THEN
    ALTER TABLE public.people_contacts ADD COLUMN personality_profile JSONB;
  END IF;
END $$;
