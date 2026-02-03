-- Create jarvis_whoop_data table for POTUS-synced WHOOP data
CREATE TABLE public.jarvis_whoop_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  recovery_score INTEGER,
  hrv INTEGER,
  strain NUMERIC,
  sleep_hours NUMERIC,
  resting_hr INTEGER,
  sleep_performance INTEGER,
  data_date DATE NOT NULL DEFAULT CURRENT_DATE,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.jarvis_whoop_data ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own jarvis whoop data"
ON public.jarvis_whoop_data
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own jarvis whoop data"
ON public.jarvis_whoop_data
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jarvis whoop data"
ON public.jarvis_whoop_data
FOR UPDATE
USING (auth.uid() = user_id);

-- Index for efficient queries
CREATE INDEX idx_jarvis_whoop_data_user_date ON public.jarvis_whoop_data(user_id, data_date DESC);