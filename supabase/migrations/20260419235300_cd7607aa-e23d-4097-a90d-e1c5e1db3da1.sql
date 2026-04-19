-- 1. Tabla personal_timeline_events
CREATE TABLE IF NOT EXISTS public.personal_timeline_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sentiment SMALLINT NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  source_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT sentiment_range CHECK (sentiment BETWEEN -5 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_personal_timeline_user_date 
  ON public.personal_timeline_events(user_id, event_date DESC);

ALTER TABLE public.personal_timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own personal timeline"
  ON public.personal_timeline_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own personal timeline"
  ON public.personal_timeline_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own personal timeline"
  ON public.personal_timeline_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own personal timeline"
  ON public.personal_timeline_events FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_personal_timeline_updated_at
  BEFORE UPDATE ON public.personal_timeline_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Reprogramar cron: quitar el semanal y poner diario
DO $$
BEGIN
  PERFORM cron.unschedule('contact-profiles-weekly-refresh');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('contact-profiles-daily-refresh');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'contact-profiles-daily-refresh',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/contact-profiles-refresh',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmamx3eHNzeGZ2aGJpeXRjb2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDI4MDUsImV4cCI6MjA4NTIxODgwNX0.EgH-i0SBnlWH3lF4ZgZ3b8SRdBZc5fZruWmyaIu9GIQ"}'::jsonb,
    body := concat('{"trigger": "cron-daily", "time": "', now(), '"}')::jsonb
  );
  $$
);