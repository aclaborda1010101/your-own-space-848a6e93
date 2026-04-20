-- Reemplazar cron diario antiguo por la nueva versión multi-user
SELECT cron.unschedule('contact-profiles-daily-refresh');

-- Cron 1: refresh perfiles (todos los usuarios) — diario 02:00 UTC
SELECT cron.schedule(
  'contact-profiles-refresh-all-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/contact-profiles-refresh-all',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmamx3eHNzeGZ2aGJpeXRjb2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDI4MDUsImV4cCI6MjA4NTIxODgwNX0.EgH-i0SBnlWH3lF4ZgZ3b8SRdBZc5fZruWmyaIu9GIQ"}'::jsonb,
    body := '{"mode":"all-users","trigger":"cron-daily"}'::jsonb
  );
  $$
);

-- Cron 2: reimport multimedia WhatsApp — diario 03:00 UTC (separado para no saturar)
SELECT cron.schedule(
  'reimport-whatsapp-multimedia-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/reimport-whatsapp-recent',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmamx3eHNzeGZ2aGJpeXRjb2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDI4MDUsImV4cCI6MjA4NTIxODgwNX0.EgH-i0SBnlWH3lF4ZgZ3b8SRdBZc5fZruWmyaIu9GIQ"}'::jsonb,
    body := '{"mode":"all-users","daysBack":3,"trigger":"cron-daily"}'::jsonb
  );
  $$
);