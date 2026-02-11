
-- Table to store email account configurations per user
CREATE TABLE public.email_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook', 'icloud', 'imap')),
  email_address TEXT NOT NULL,
  display_name TEXT,
  credentials_encrypted JSONB,
  imap_host TEXT,
  imap_port INTEGER DEFAULT 993,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own email accounts"
  ON public.email_accounts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email accounts"
  ON public.email_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email accounts"
  ON public.email_accounts FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own email accounts"
  ON public.email_accounts FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_email_accounts_updated_at
  BEFORE UPDATE ON public.email_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add unique constraint per user+email+provider
CREATE UNIQUE INDEX idx_email_accounts_unique ON public.email_accounts (user_id, email_address, provider);
