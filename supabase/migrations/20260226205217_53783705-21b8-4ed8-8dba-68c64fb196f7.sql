
-- 1. Add new columns to rag_variables
ALTER TABLE public.rag_variables
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS scale TEXT,
  ADD COLUMN IF NOT EXISTS examples TEXT,
  ADD COLUMN IF NOT EXISTS extraction_hint TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. Deduplicate existing variables before creating unique index
DELETE FROM rag_variables a
USING rag_variables b
WHERE a.id > b.id
  AND a.rag_id = b.rag_id
  AND lower(a.name) = lower(b.name);

-- 3. Unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_variables_unique
  ON public.rag_variables (rag_id, lower(name));

-- 4. Category index
CREATE INDEX IF NOT EXISTS idx_rag_variables_category
  ON public.rag_variables (rag_id, category);

-- 5. Update unique partial index for post-build jobs
DROP INDEX IF EXISTS idx_single_post_build_job;
CREATE UNIQUE INDEX idx_single_post_build_job
  ON public.rag_jobs (rag_id, job_type)
  WHERE job_type IN ('POST_BUILD_TAXONOMY', 'POST_BUILD_CONTRA', 'POST_BUILD_QG', 'POST_BUILD_TAXONOMY_MERGE');

-- 6. Composite index for batch job lookups
CREATE INDEX IF NOT EXISTS idx_rag_jobs_rag_type_status
  ON public.rag_jobs (rag_id, job_type, status)
  WHERE status IN ('PENDING', 'RETRY', 'RUNNING');

-- 7. RPC: Enqueue taxonomy batches
CREATE OR REPLACE FUNCTION public.enqueue_taxonomy_batches_for_rag(
  p_rag_id UUID,
  p_batch_size INT DEFAULT 100
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  total_chunks INT;
  i INT := 0;
  batch_no INT := 0;
  chunk_ids UUID[];
  existing_jobs INT;
BEGIN
  SELECT COUNT(*) INTO existing_jobs
  FROM rag_jobs
  WHERE rag_id = p_rag_id
    AND job_type IN ('POST_BUILD_TAXONOMY_BATCH', 'POST_BUILD_TAXONOMY_MERGE')
    AND status IN ('PENDING', 'RETRY', 'RUNNING');

  IF existing_jobs > 0 THEN
    RETURN 0;
  END IF;

  DELETE FROM rag_variables WHERE rag_id = p_rag_id;

  SELECT COUNT(*) INTO total_chunks FROM rag_chunks WHERE rag_id = p_rag_id;

  IF total_chunks = 0 THEN
    RETURN 0;
  END IF;

  WHILE i < total_chunks LOOP
    SELECT ARRAY_AGG(id) INTO chunk_ids
    FROM (
      SELECT id FROM rag_chunks WHERE rag_id = p_rag_id ORDER BY created_at OFFSET i LIMIT p_batch_size
    ) t;

    IF chunk_ids IS NOT NULL AND array_length(chunk_ids, 1) > 0 THEN
      INSERT INTO rag_jobs (rag_id, job_type, status, payload, created_at)
      VALUES (p_rag_id, 'POST_BUILD_TAXONOMY_BATCH', 'PENDING',
        jsonb_build_object('batch_no', batch_no, 'chunk_ids', to_jsonb(chunk_ids)), now());
      batch_no := batch_no + 1;
    END IF;

    i := i + p_batch_size;
  END LOOP;

  INSERT INTO rag_jobs (rag_id, job_type, status, payload, created_at)
  VALUES (p_rag_id, 'POST_BUILD_TAXONOMY_MERGE', 'PENDING',
    jsonb_build_object('expected_batches', batch_no), now());

  RETURN batch_no;
END;
$$;
