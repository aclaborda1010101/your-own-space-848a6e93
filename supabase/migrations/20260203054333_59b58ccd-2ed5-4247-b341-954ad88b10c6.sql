-- Create table for dismissed alerts
CREATE TABLE public.dismissed_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  alert_id TEXT NOT NULL,
  dismissed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dismissed_alerts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own dismissed alerts"
ON public.dismissed_alerts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own dismissed alerts"
ON public.dismissed_alerts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dismissed alerts"
ON public.dismissed_alerts
FOR DELETE
USING (auth.uid() = user_id);

-- Create unique constraint to avoid duplicates
CREATE UNIQUE INDEX dismissed_alerts_user_alert_unique ON public.dismissed_alerts(user_id, alert_id);

-- Create index for faster lookups
CREATE INDEX idx_dismissed_alerts_user_id ON public.dismissed_alerts(user_id);