
-- Drop old search_rag_hybrid (return type changed)
DROP FUNCTION IF EXISTS public.search_rag_hybrid(vector, text, uuid, integer);

-- Recreate with enriched return type (Zero N+1)
CREATE OR REPLACE FUNCTION public.search_rag_hybrid(
  query_embedding vector,
  query_text TEXT,
  match_rag_id UUID,
  match_count INT DEFAULT 15
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  subdomain TEXT,
  source_name TEXT,
  source_url TEXT,
  source_tier TEXT,
  evidence_level TEXT,
  authority_score NUMERIC,
  peer_reviewed BOOLEAN,
  metadata JSONB,
  quality JSONB,
  similarity DOUBLE PRECISION,
  keyword_rank DOUBLE PRECISION,
  rrf_score DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
DECLARE
  k CONSTANT INT := 60;
BEGIN
  RETURN QUERY
  WITH semantic AS (
    SELECT
      rc.id AS chunk_id,
      ROW_NUMBER() OVER (ORDER BY rc.embedding <=> query_embedding) AS rank_pos
    FROM rag_chunks rc
    WHERE rc.rag_id = match_rag_id AND rc.embedding IS NOT NULL
    ORDER BY rc.embedding <=> query_embedding
    LIMIT 30
  ),
  keyword AS (
    SELECT
      rc.id AS chunk_id,
      ts_rank(rc.content_tsv, plainto_tsquery('spanish', query_text)) AS kw_score,
      ROW_NUMBER() OVER (ORDER BY ts_rank(rc.content_tsv, plainto_tsquery('spanish', query_text)) DESC) AS rank_pos
    FROM rag_chunks rc
    WHERE rc.rag_id = match_rag_id
      AND rc.content_tsv IS NOT NULL
      AND rc.content_tsv @@ plainto_tsquery('spanish', query_text)
    LIMIT 30
  ),
  all_ids AS (
    SELECT chunk_id FROM semantic
    UNION
    SELECT chunk_id FROM keyword
  ),
  scored AS (
    SELECT
      a.chunk_id,
      COALESCE(1.0 / (k + s.rank_pos), 0) + COALESCE(1.0 / (k + kw.rank_pos), 0) AS score
    FROM all_ids a
    LEFT JOIN semantic s ON s.chunk_id = a.chunk_id
    LEFT JOIN keyword kw ON kw.chunk_id = a.chunk_id
  )
  SELECT
    rc.id,
    rc.content,
    rc.subdomain,
    rs.source_name,
    rs.source_url,
    rs.tier AS source_tier,
    rs.evidence_level,
    rs.authority_score,
    rs.peer_reviewed,
    rc.metadata,
    rc.quality,
    (1 - (rc.embedding <=> query_embedding))::FLOAT AS similarity,
    COALESCE(kw.kw_score, 0)::FLOAT AS keyword_rank,
    sc.score::FLOAT AS rrf_score
  FROM scored sc
  JOIN rag_chunks rc ON rc.id = sc.chunk_id
  LEFT JOIN rag_sources rs ON rs.id = rc.source_id
  LEFT JOIN keyword kw ON kw.chunk_id = sc.chunk_id
  ORDER BY sc.score DESC
  LIMIT match_count;
END;
$$;
