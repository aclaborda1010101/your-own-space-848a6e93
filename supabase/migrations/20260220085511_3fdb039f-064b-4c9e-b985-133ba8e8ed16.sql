-- Fix Plaud emails classification
UPDATE jarvis_emails_cache 
SET email_type = 'plaud_transcription' 
WHERE from_addr ILIKE '%plaud.ai%' 
  AND subject ILIKE '%plaud-autoflow%'
  AND (email_type IS NULL OR email_type != 'plaud_transcription');

-- Enable pg_cron and pg_net if not already
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule email-sync every 10 minutes
SELECT cron.schedule(
  'email-sync-auto',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url:='https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/email-sync',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmamx3eHNzeGZ2aGJpeXRjb2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDI4MDUsImV4cCI6MjA4NTIxODgwNX0.EgH-i0SBnlWH3lF4ZgZ3b8SRdBZc5fZruWmyaIu9GIQ"}'::jsonb,
    body:='{"action":"sync"}'::jsonb
  ) AS request_id;
  $$
);