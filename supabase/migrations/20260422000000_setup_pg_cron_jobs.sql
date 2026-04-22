-- ═══════════════════════════════════════════════════════════════════
-- JARVIS pg_cron Setup
-- Sets up scheduled jobs for automated background processing.
--
-- PREREQUISITE: Run this in Supabase SQL Editor AFTER storing the
-- service role key in vault:
--
--   SELECT vault.create_secret(
--     'eyJhbGciOiJIUz...YOUR_SERVICE_ROLE_KEY...',
--     'service_role_key',
--     'Service role key for cron jobs'
--   );
--
-- Then the cron jobs below will read it via vault.decrypted_secrets.
-- ═══════════════════════════════════════════════════════════════════

-- Ensure extensions are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Helper: get service role key from vault (or fallback)
CREATE OR REPLACE FUNCTION internal_get_service_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  key_val TEXT;
BEGIN
  SELECT decrypted_secret INTO key_val
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;
  RETURN COALESCE(key_val, '');
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 1. JARVIS History Backfill Cron — every 5 minutes
--    Drains ingestion queue, then rotates backfill across source types
-- ═══════════════════════════════════════════════════════════════════
SELECT cron.schedule(
  'jarvis-history-backfill',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/jarvis-history-backfill-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || internal_get_service_key()
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

-- ═══════════════════════════════════════════════════════════════════
-- 2. Dispatch Scheduled Notifications — every 1 minute
--    Sends due push notifications to users
-- ═══════════════════════════════════════════════════════════════════
SELECT cron.schedule(
  'dispatch-notifications',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/dispatch-scheduled-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || internal_get_service_key()
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- ═══════════════════════════════════════════════════════════════════
-- 3. Email Sync — every 15 minutes
--    Syncs emails for all active accounts
-- ═══════════════════════════════════════════════════════════════════
SELECT cron.schedule(
  'email-sync-cron',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/email-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || internal_get_service_key()
    ),
    body := '{"action":"sync_all"}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

-- Verify jobs are scheduled
-- SELECT * FROM cron.job;
