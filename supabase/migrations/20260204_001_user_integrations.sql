-- Create user_integrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_integrations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  google_access_token text,
  google_refresh_token text,
  google_token_expires_at timestamptz,
  google_calendar_enabled boolean DEFAULT false,
  icloud_email text,
  icloud_password_encrypted text,
  icloud_enabled boolean DEFAULT false,
  icloud_calendars jsonb DEFAULT '[]'::jsonb,
  icloud_last_sync timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own integrations"
ON public.user_integrations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own integrations"
ON public.user_integrations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own integrations"
ON public.user_integrations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own integrations"
ON public.user_integrations FOR DELETE
USING (auth.uid() = user_id);

-- Create index
CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id ON public.user_integrations(user_id);
