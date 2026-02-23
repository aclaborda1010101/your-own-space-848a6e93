
-- =============================================
-- RAG Pipeline: Job Queue + Outbox Architecture
-- =============================================

-- 0) Clean duplicate rag_sources (keep oldest per rag_id+source_url)
DELETE FROM public.rag_sources
WHERE id NOT IN (
  SELECT DISTINCT ON (rag_id, source_url) id
  FROM public.rag_sources
  WHERE source_url IS NOT NULL
  ORDER BY rag_id, source_url, created_at ASC
)
AND source_url IS NOT NULL;

-- 1) rag_jobs outbox table
CREATE TABLE IF NOT EXISTS public.rag_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rag_id uuid NOT NULL,
  job_type text NOT NULL,
  source_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING',
  attempt int NOT NULL DEFAULT 0,
  run_after timestamptz NOT NULL DEFAULT now(),
  locked_by text,
  locked_at timestamptz,
  error jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rag_jobs_pick ON public.rag_jobs (status, run_after, created_at);
CREATE INDEX IF NOT EXISTS idx_rag_jobs_rag ON public.rag_jobs (rag_id);
CREATE INDEX IF NOT EXISTS idx_rag_jobs_source ON public.rag_jobs (source_id);

ALTER TABLE public.rag_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rag jobs"
  ON public.rag_jobs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.rag_projects rp WHERE rp.id = rag_id AND rp.user_id = auth.uid()));

CREATE POLICY "Service role full access to rag_jobs"
  ON public.rag_jobs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 2) Alter rag_sources: add pipeline tracking columns
ALTER TABLE public.rag_sources
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'NEW',
  ADD COLUMN IF NOT EXISTS http_status int,
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS lang_detected text,
  ADD COLUMN IF NOT EXISTS extraction_quality text,
  ADD COLUMN IF NOT EXISTS word_count int,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS error jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS uq_rag_sources_rag_url
  ON public.rag_sources (rag_id, source_url);

-- 3) Alter rag_chunks: add dedup and quality columns
ALTER TABLE public.rag_chunks
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS lang text DEFAULT 'es',
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS quality jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Unique index for hash-based dedup (only on non-null hashes)
CREATE UNIQUE INDEX IF NOT EXISTS uq_rag_chunk_hash
  ON public.rag_chunks (rag_id, content_hash) WHERE content_hash IS NOT NULL;

-- 4) Updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rag_jobs_updated ON public.rag_jobs;
CREATE TRIGGER trg_rag_jobs_updated
  BEFORE UPDATE ON public.rag_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_rag_sources_updated ON public.rag_sources;
CREATE TRIGGER trg_rag_sources_updated
  BEFORE UPDATE ON public.rag_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) RPCs
CREATE OR REPLACE FUNCTION public.pick_next_job(worker_id text)
RETURNS SETOF public.rag_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j rag_jobs;
BEGIN
  SELECT *
  INTO j
  FROM rag_jobs
  WHERE status IN ('PENDING','RETRY')
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
$$;

CREATE OR REPLACE FUNCTION public.mark_job_done(job_id uuid)
RETURNS void LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE rag_jobs
  SET status = 'DONE', error = NULL, locked_by = NULL, locked_at = NULL
  WHERE id = job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_job_retry(job_id uuid, err jsonb)
RETURNS void LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a int;
  backoff interval;
BEGIN
  SELECT attempt INTO a FROM rag_jobs WHERE id = job_id;
  a := a + 1;
  backoff := make_interval(mins => least(60, power(2, least(a, 10))::int));

  UPDATE rag_jobs
  SET status = CASE WHEN a >= 5 THEN 'DLQ' ELSE 'RETRY' END,
      attempt = a,
      run_after = now() + backoff,
      error = err,
      locked_by = NULL,
      locked_at = NULL
  WHERE id = job_id;
END;
$$;
