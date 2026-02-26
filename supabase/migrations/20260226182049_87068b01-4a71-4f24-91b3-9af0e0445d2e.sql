
-- Fix 1: Exclude EXTERNAL_SCRAPE from pick_next_job so the runner never grabs them
CREATE OR REPLACE FUNCTION public.pick_next_job(worker_id text)
 RETURNS SETOF rag_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  j rag_jobs;
BEGIN
  SELECT *
  INTO j
  FROM rag_jobs
  WHERE status IN ('PENDING','RETRY')
    AND job_type != 'EXTERNAL_SCRAPE'
    AND run_after <= now()
    AND (locked_at IS NULL OR locked_at < now() - interval '10 minutes')
  ORDER BY created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF j.id IS NULL THEN
    RETURN;
  END IF;

  UPDATE rag_jobs
  SET status = 'RUNNING',
      locked_by = worker_id,
      locked_at = now()
  WHERE id = j.id
  RETURNING * INTO j;

  RETURN NEXT j;
  RETURN;
END;
$function$;

-- Fix 2: Reset 30 EXTERNAL_SCRAPE RETRY jobs to PENDING
UPDATE rag_jobs 
SET status = 'PENDING', attempt = 0, error = NULL,
    locked_by = NULL, locked_at = NULL
WHERE rag_id = '8edd368f-31c2-4522-8b47-22a81f4a0000'
  AND job_type = 'EXTERNAL_SCRAPE' AND status IN ('RETRY', 'RUNNING');

-- Fix 3: Move 6 unreachable FETCH RETRY to DLQ (SSL/DNS failures the runner can't fix)
UPDATE rag_jobs 
SET status = 'DLQ', error = '{"message":"SSL/DNS/connection error - unreachable by edge function"}'::jsonb
WHERE rag_id = '8edd368f-31c2-4522-8b47-22a81f4a0000'
  AND job_type = 'FETCH' AND status = 'RETRY';
