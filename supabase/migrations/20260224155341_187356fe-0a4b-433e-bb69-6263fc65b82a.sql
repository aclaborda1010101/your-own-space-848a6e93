
-- RPC: pick_external_job — atomic lock for external worker
CREATE OR REPLACE FUNCTION public.pick_external_job(p_worker_id TEXT)
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
  WHERE job_type = 'EXTERNAL_SCRAPE'
    AND status IN ('PENDING','RETRY')
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
      locked_by = p_worker_id,
      locked_at = now()
  WHERE id = j.id
  RETURNING * INTO j;

  RETURN NEXT j;
  RETURN;
END;
$function$;

-- RPC: complete_external_job — marks job done, enqueues CLEAN stage
CREATE OR REPLACE FUNCTION public.complete_external_job(
  p_job_id UUID,
  p_extracted_text TEXT,
  p_extraction_quality TEXT DEFAULT 'medium'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rag_id UUID;
  v_source_id UUID;
BEGIN
  -- Get job info
  SELECT rag_id, source_id INTO v_rag_id, v_source_id
  FROM rag_jobs WHERE id = p_job_id;

  IF v_rag_id IS NULL THEN
    RAISE EXCEPTION 'Job not found: %', p_job_id;
  END IF;

  -- Mark job done
  UPDATE rag_jobs
  SET status = 'DONE', error = NULL, locked_by = NULL, locked_at = NULL
  WHERE id = p_job_id;

  -- Update source status
  UPDATE rag_sources
  SET status = 'EXTRACTED',
      extraction_quality = p_extraction_quality,
      word_count = array_length(regexp_split_to_array(trim(p_extracted_text), '\s+'), 1)
  WHERE id = v_source_id;

  -- Enqueue CLEAN job with extracted text
  INSERT INTO rag_jobs (rag_id, job_type, source_id, payload)
  VALUES (v_rag_id, 'CLEAN', v_source_id, jsonb_build_object('mainText', left(p_extracted_text, 200000)));
END;
$function$;

-- RPC: fetch_external_job_stats — get EXTERNAL_SCRAPE job counts by status
CREATE OR REPLACE FUNCTION public.fetch_external_job_stats(match_rag_id UUID)
RETURNS TABLE(status TEXT, count BIGINT)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT j.status, COUNT(*) FROM rag_jobs j
  WHERE j.rag_id = match_rag_id
    AND j.job_type = 'EXTERNAL_SCRAPE'
  GROUP BY j.status;
END;
$function$;
