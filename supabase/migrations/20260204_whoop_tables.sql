-- Create whoop_tokens table for OAuth tokens
CREATE TABLE IF NOT EXISTS public.whoop_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create whoop_data table for cached WHOOP metrics
CREATE TABLE IF NOT EXISTS public.whoop_data (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  recovery_score integer,
  hrv integer,
  strain numeric,
  sleep_hours numeric,
  resting_hr integer,
  sleep_performance integer,
  data_date date NOT NULL DEFAULT CURRENT_DATE,
  fetched_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.whoop_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whoop_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whoop_tokens
CREATE POLICY "Users can view their own WHOOP tokens"
ON public.whoop_tokens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own WHOOP tokens"
ON public.whoop_tokens FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own WHOOP tokens"
ON public.whoop_tokens FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own WHOOP tokens"
ON public.whoop_tokens FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for whoop_data
CREATE POLICY "Users can view their own WHOOP data"
ON public.whoop_data FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own WHOOP data"
ON public.whoop_data FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own WHOOP data"
ON public.whoop_data FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own WHOOP data"
ON public.whoop_data FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_whoop_tokens_user_id ON public.whoop_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_whoop_data_user_id ON public.whoop_data(user_id);
CREATE INDEX IF NOT EXISTS idx_whoop_data_date ON public.whoop_data(data_date DESC);
