
-- 1. Add missing columns to rag_sources
ALTER TABLE public.rag_sources
  ADD COLUMN IF NOT EXISTS authority_score NUMERIC(5,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS evidence_level TEXT,
  ADD COLUMN IF NOT EXISTS peer_reviewed BOOLEAN DEFAULT FALSE;

-- 2. Create index on rag_sources(rag_id, tier)
CREATE INDEX IF NOT EXISTS idx_rag_sources_tier ON public.rag_sources(rag_id, tier);

-- 3. Drop and recreate search_rag_hybrid V2 with embedding + real similarity
DROP FUNCTION IF EXISTS public.search_rag_hybrid(vector, text, uuid, integer);
DROP FUNCTION IF EXISTS public.search_rag_hybrid(text, vector, uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.search_rag_hybrid(
  query_text TEXT,
  query_embedding vector(1024),
  match_rag_id UUID,
  match_count INT DEFAULT 15,
  rrf_k INT DEFAULT 60
) RETURNS TABLE (
  id UUID,
  content TEXT,
  source_name TEXT,
  source_url TEXT,
  source_tier TEXT,
  evidence_level TEXT,
  authority_score NUMERIC(5,2),
  quality JSONB,
  similarity FLOAT,
  embedding vector(1024),
  rrf_score FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH semantic AS (
    SELECT rc.id AS chunk_id, rc.embedding AS chunk_embedding,
           (1 - (rc.embedding <=> query_embedding))::FLOAT AS sim,
           ROW_NUMBER() OVER (ORDER BY rc.embedding <=> query_embedding) AS rank_sem
    FROM rag_chunks rc
    WHERE rc.rag_id = match_rag_id AND rc.embedding IS NOT NULL
    ORDER BY rc.embedding <=> query_embedding
    LIMIT 50
  ),
  keyword AS (
    SELECT rc.id AS chunk_id,
           ROW_NUMBER() OVER (ORDER BY ts_rank(rc.content_tsv, websearch_to_tsquery('spanish', query_text)) DESC) AS rank_kw
    FROM rag_chunks rc
    WHERE rc.rag_id = match_rag_id
      AND rc.content_tsv @@ websearch_to_tsquery('spanish', query_text)
    ORDER BY ts_rank(rc.content_tsv, websearch_to_tsquery('spanish', query_text)) DESC
    LIMIT 50
  ),
  rrf AS (
    SELECT COALESCE(s.chunk_id, k.chunk_id) AS chunk_id,
           s.chunk_embedding,
           s.sim AS similarity,
           COALESCE(1.0/(rrf_k + s.rank_sem), 0) + COALESCE(1.0/(rrf_k + k.rank_kw), 0) AS score
    FROM semantic s
    FULL OUTER JOIN keyword k ON s.chunk_id = k.chunk_id
  )
  SELECT rc.id, rc.content, rs.source_name, rs.source_url,
         rs.tier AS source_tier, rs.evidence_level, rs.authority_score, rc.quality,
         rrf.similarity, rrf.chunk_embedding AS embedding, rrf.score::FLOAT AS rrf_score
  FROM rrf
  JOIN rag_chunks rc ON rc.id = rrf.chunk_id
  JOIN rag_sources rs ON rs.id = rc.source_id
  ORDER BY rrf.score DESC
  LIMIT match_count;
END; $$;

-- 4. Create rag_job_stats RPC
CREATE OR REPLACE FUNCTION public.rag_job_stats(match_rag_id UUID)
RETURNS TABLE (status TEXT, count BIGINT) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT j.status, COUNT(*) FROM rag_jobs j
  WHERE j.rag_id = match_rag_id
  GROUP BY j.status;
END; $$;
