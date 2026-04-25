CREATE OR REPLACE FUNCTION public.enqueue_history_ingest_job(p_user_id uuid, p_source_type text, p_source_id uuid, p_source_table text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_id IS NULL OR p_source_id IS NULL THEN
    RETURN;
  END IF;

  -- Evitar duplicados pendientes para la misma fuente
  IF EXISTS (
    SELECT 1 FROM public.jarvis_ingestion_jobs
    WHERE user_id = p_user_id
      AND source_id = p_source_id
      AND source_table = p_source_table
      AND status IN ('pending'::jarvis_job_status, 'running'::jarvis_job_status)
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.jarvis_ingestion_jobs (user_id, source_type, source_id, source_table, status)
  VALUES (p_user_id, p_source_type, p_source_id, p_source_table, 'pending'::jarvis_job_status);
END;
$function$;