-- Unschedule prior version if exists
DO $$
BEGIN
  PERFORM cron.unschedule('ai-cost-daily-alert');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'ai-cost-daily-alert',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/ai-cost-daily-alert',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmamx3eHNzeGZ2aGJpeXRjb2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDI4MDUsImV4cCI6MjA4NTIxODgwNX0.EgH-i0SBnlWH3lF4ZgZ3b8SRdBZc5fZruWmyaIu9GIQ"}'::jsonb,
    body := jsonb_build_object('triggered_at', now())
  ) AS request_id;
  $$
);