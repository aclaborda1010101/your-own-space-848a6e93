-- 1. Add last_bio_refresh_at to people_contacts
ALTER TABLE public.people_contacts
ADD COLUMN IF NOT EXISTS last_bio_refresh_at timestamptz;

-- 2. Remove auto cron for podcast queue (no longer used)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-podcast-queue-every-minute') THEN
    PERFORM cron.unschedule('process-podcast-queue-every-minute');
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 3. Drop the podcast queue table (no longer used)
DROP TABLE IF EXISTS public.podcast_generation_queue;