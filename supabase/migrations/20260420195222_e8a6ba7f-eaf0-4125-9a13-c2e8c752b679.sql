-- ============================================================
-- CAPA 1: Memoria histórica unificada de JARVIS
-- ============================================================

-- Enum para los tipos de fuente
DO $$ BEGIN
  CREATE TYPE public.jarvis_source_type AS ENUM (
    'whatsapp',
    'email',
    'transcription',
    'attachment',
    'calendar',
    'contact_note',
    'jarvis_chat',
    'manual',
    'plaud',
    'telegram'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Enum para estado de jobs
DO $$ BEGIN
  CREATE TYPE public.jarvis_job_status AS ENUM ('pending', 'running', 'done', 'error');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- TABLA: jarvis_history_chunks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.jarvis_history_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,

  -- origen
  source_type public.jarvis_source_type NOT NULL,
  source_id UUID,                       -- FK lógico (no físico) a la fila origen
  source_table TEXT,                    -- 'contact_messages', 'jarvis_emails_cache', etc

  -- contenido
  content TEXT NOT NULL,
  content_summary TEXT,
  content_hash TEXT NOT NULL,           -- sha256 del content para idempotencia
  chunk_index INT NOT NULL DEFAULT 0,
  total_chunks INT NOT NULL DEFAULT 1,

  -- vectorización
  embedding vector(1024),
  tsv tsvector,

  -- semántica enriquecida
  occurred_at TIMESTAMPTZ NOT NULL,     -- cuándo pasó el evento real
  people UUID[] DEFAULT '{}',
  topics TEXT[] DEFAULT '{}',
  importance SMALLINT NOT NULL DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT jarvis_history_chunks_uniq UNIQUE (user_id, content_hash)
);

-- Índices
CREATE INDEX IF NOT EXISTS jarvis_history_chunks_user_time_idx
  ON public.jarvis_history_chunks (user_id, source_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS jarvis_history_chunks_user_occurred_idx
  ON public.jarvis_history_chunks (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS jarvis_history_chunks_people_gin
  ON public.jarvis_history_chunks USING GIN (people);

CREATE INDEX IF NOT EXISTS jarvis_history_chunks_topics_gin
  ON public.jarvis_history_chunks USING GIN (topics);

CREATE INDEX IF NOT EXISTS jarvis_history_chunks_tsv_gin
  ON public.jarvis_history_chunks USING GIN (tsv);

CREATE INDEX IF NOT EXISTS jarvis_history_chunks_embedding_hnsw
  ON public.jarvis_history_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS jarvis_history_chunks_source_idx
  ON public.jarvis_history_chunks (source_table, source_id);

-- Trigger: tsv automático
CREATE OR REPLACE FUNCTION public.jarvis_history_chunks_tsv_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.tsv := to_tsvector('spanish', coalesce(NEW.content, ''));
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jarvis_history_chunks_tsv ON public.jarvis_history_chunks;
CREATE TRIGGER jarvis_history_chunks_tsv
  BEFORE INSERT OR UPDATE OF content ON public.jarvis_history_chunks
  FOR EACH ROW EXECUTE FUNCTION public.jarvis_history_chunks_tsv_trigger();

-- RLS
ALTER TABLE public.jarvis_history_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own history chunks"
  ON public.jarvis_history_chunks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own history chunks"
  ON public.jarvis_history_chunks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own history chunks"
  ON public.jarvis_history_chunks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own history chunks"
  ON public.jarvis_history_chunks FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- TABLA: jarvis_ingestion_jobs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.jarvis_ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,

  source_type public.jarvis_source_type NOT NULL,
  source_id UUID,
  source_table TEXT,

  status public.jarvis_job_status NOT NULL DEFAULT 'pending',
  payload JSONB DEFAULT '{}'::jsonb,
  attempts INT NOT NULL DEFAULT 0,
  error TEXT,

  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  run_after TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS jarvis_ingestion_jobs_status_idx
  ON public.jarvis_ingestion_jobs (status, run_after);

CREATE INDEX IF NOT EXISTS jarvis_ingestion_jobs_user_idx
  ON public.jarvis_ingestion_jobs (user_id, status);

CREATE INDEX IF NOT EXISTS jarvis_ingestion_jobs_source_idx
  ON public.jarvis_ingestion_jobs (source_table, source_id);

ALTER TABLE public.jarvis_ingestion_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ingestion jobs"
  ON public.jarvis_ingestion_jobs FOR SELECT
  USING (auth.uid() = user_id);

-- (insert/update lo hace el service role; no policies de write para users)

-- ============================================================
-- RPC: search_history_hybrid
-- Búsqueda híbrida (semántica + BM25) con filtros
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_history_hybrid(
  p_user_id UUID,
  query_embedding vector(1024),
  query_text TEXT,
  p_source_types public.jarvis_source_type[] DEFAULT NULL,
  p_people UUID[] DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_min_importance SMALLINT DEFAULT 1,
  match_count INT DEFAULT 10,
  rrf_k INT DEFAULT 60
)
RETURNS TABLE (
  id UUID,
  source_type public.jarvis_source_type,
  source_id UUID,
  source_table TEXT,
  content TEXT,
  content_summary TEXT,
  occurred_at TIMESTAMPTZ,
  people UUID[],
  topics TEXT[],
  importance SMALLINT,
  metadata JSONB,
  similarity FLOAT,
  rrf_score FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT c.*
    FROM jarvis_history_chunks c
    WHERE c.user_id = p_user_id
      AND (p_source_types IS NULL OR c.source_type = ANY(p_source_types))
      AND (p_people IS NULL OR c.people && p_people)
      AND (p_date_from IS NULL OR c.occurred_at >= p_date_from)
      AND (p_date_to IS NULL OR c.occurred_at <= p_date_to)
      AND c.importance >= p_min_importance
  ),
  semantic AS (
    SELECT b.id AS chunk_id,
           (1 - (b.embedding <=> query_embedding))::FLOAT AS sim,
           ROW_NUMBER() OVER (ORDER BY b.embedding <=> query_embedding) AS rnk
    FROM base b
    WHERE b.embedding IS NOT NULL AND query_embedding IS NOT NULL
    ORDER BY b.embedding <=> query_embedding
    LIMIT 80
  ),
  keyword AS (
    SELECT b.id AS chunk_id,
           ROW_NUMBER() OVER (
             ORDER BY ts_rank(b.tsv, websearch_to_tsquery('spanish', query_text)) DESC
           ) AS rnk
    FROM base b
    WHERE query_text IS NOT NULL
      AND length(query_text) > 0
      AND b.tsv @@ websearch_to_tsquery('spanish', query_text)
    LIMIT 80
  ),
  rrf AS (
    SELECT COALESCE(s.chunk_id, k.chunk_id) AS chunk_id,
           COALESCE(s.sim, 0)::FLOAT AS similarity,
           (COALESCE(1.0/(rrf_k + s.rnk), 0) + COALESCE(1.0/(rrf_k + k.rnk), 0))::FLOAT AS score
    FROM semantic s
    FULL OUTER JOIN keyword k ON s.chunk_id = k.chunk_id
  )
  SELECT c.id, c.source_type, c.source_id, c.source_table,
         c.content, c.content_summary, c.occurred_at,
         c.people, c.topics, c.importance, c.metadata,
         rrf.similarity, rrf.score
  FROM rrf
  JOIN jarvis_history_chunks c ON c.id = rrf.chunk_id
  ORDER BY rrf.score DESC, c.occurred_at DESC
  LIMIT match_count;
END;
$$;

-- ============================================================
-- RPC: get_history_coverage
-- Devuelve cobertura del backfill por fuente
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_history_coverage(p_user_id UUID)
RETURNS TABLE (
  source_type TEXT,
  total_rows BIGINT,
  vectorized_rows BIGINT,
  coverage_pct NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH counts AS (
    -- WhatsApp
    SELECT 'whatsapp'::TEXT AS st,
           (SELECT COUNT(*) FROM contact_messages cm
              JOIN people_contacts pc ON pc.id = cm.contact_id
              WHERE pc.user_id = p_user_id) AS total,
           (SELECT COUNT(*) FROM jarvis_history_chunks
              WHERE user_id = p_user_id AND source_type = 'whatsapp') AS vec
    UNION ALL
    SELECT 'email',
           (SELECT COUNT(*) FROM jarvis_emails_cache WHERE user_id = p_user_id),
           (SELECT COUNT(*) FROM jarvis_history_chunks
              WHERE user_id = p_user_id AND source_type = 'email')
    UNION ALL
    SELECT 'transcription',
           (SELECT COUNT(*) FROM transcriptions WHERE user_id = p_user_id),
           (SELECT COUNT(*) FROM jarvis_history_chunks
              WHERE user_id = p_user_id AND source_type = 'transcription')
    UNION ALL
    SELECT 'plaud',
           (SELECT COUNT(*) FROM plaud_transcriptions WHERE user_id = p_user_id),
           (SELECT COUNT(*) FROM jarvis_history_chunks
              WHERE user_id = p_user_id AND source_type = 'plaud')
    UNION ALL
    SELECT 'jarvis_chat',
           (SELECT COUNT(*) FROM potus_chat WHERE user_id = p_user_id),
           (SELECT COUNT(*) FROM jarvis_history_chunks
              WHERE user_id = p_user_id AND source_type = 'jarvis_chat')
  )
  SELECT c.st,
         COALESCE(c.total, 0),
         COALESCE(c.vec, 0),
         CASE WHEN COALESCE(c.total,0) = 0 THEN 0
              ELSE ROUND((c.vec::NUMERIC / c.total::NUMERIC) * 100, 2)
         END
  FROM counts c;
END;
$$;

-- ============================================================
-- RPC: pick_jarvis_ingestion_job
-- Worker picker (mismo patrón que pick_next_job)
-- ============================================================
CREATE OR REPLACE FUNCTION public.pick_jarvis_ingestion_job(p_worker_id TEXT, p_batch_size INT DEFAULT 10)
RETURNS SETOF public.jarvis_ingestion_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  picked RECORD;
BEGIN
  FOR picked IN
    SELECT id FROM jarvis_ingestion_jobs
    WHERE status IN ('pending', 'error')
      AND attempts < 5
      AND run_after <= now()
      AND (locked_at IS NULL OR locked_at < now() - interval '10 minutes')
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_batch_size
  LOOP
    UPDATE jarvis_ingestion_jobs
    SET status = 'running',
        locked_by = p_worker_id,
        locked_at = now(),
        attempts = attempts + 1,
        updated_at = now()
    WHERE id = picked.id
    RETURNING * INTO picked;
    RETURN NEXT picked;
  END LOOP;
  RETURN;
END;
$$;