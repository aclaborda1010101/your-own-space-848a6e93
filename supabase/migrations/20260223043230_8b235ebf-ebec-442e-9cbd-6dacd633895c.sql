
-- ═══════════════════════════════════════
-- RAG COMPETITION UPGRADE: SQL Migration
-- ═══════════════════════════════════════

-- 1. Add content_tsv column to rag_chunks
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS content_tsv tsvector;

-- 2. Function to auto-generate tsvector
CREATE OR REPLACE FUNCTION update_chunk_tsvector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.content_tsv := to_tsvector('spanish', coalesce(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger
DROP TRIGGER IF EXISTS trg_chunk_tsvector ON rag_chunks;
CREATE TRIGGER trg_chunk_tsvector
  BEFORE INSERT OR UPDATE OF content ON rag_chunks
  FOR EACH ROW
  EXECUTE FUNCTION update_chunk_tsvector();

-- 4. GIN index for fast keyword search
CREATE INDEX IF NOT EXISTS idx_chunks_tsv ON rag_chunks USING GIN (content_tsv);

-- 5. Backfill existing chunks
UPDATE rag_chunks SET content_tsv = to_tsvector('spanish', coalesce(content, ''))
WHERE content_tsv IS NULL;

-- 6. Hybrid search function (RRF: semantic + keywords)
CREATE OR REPLACE FUNCTION search_rag_hybrid(
  query_embedding vector(1024),
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
  metadata JSONB,
  similarity FLOAT,
  keyword_rank FLOAT,
  rrf_score FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  k CONSTANT INT := 60; -- RRF constant
BEGIN
  RETURN QUERY
  WITH semantic AS (
    SELECT
      rc.id,
      rc.content,
      rc.subdomain,
      rs.source_name,
      rs.source_url,
      rc.metadata,
      (1 - (rc.embedding <=> query_embedding))::FLOAT AS similarity,
      ROW_NUMBER() OVER (ORDER BY rc.embedding <=> query_embedding) AS sem_rank
    FROM rag_chunks rc
    LEFT JOIN rag_sources rs ON rs.id = rc.source_id
    WHERE rc.rag_id = match_rag_id
      AND rc.embedding IS NOT NULL
    ORDER BY rc.embedding <=> query_embedding
    LIMIT 30
  ),
  keyword AS (
    SELECT
      rc.id,
      ts_rank(rc.content_tsv, plainto_tsquery('spanish', query_text))::FLOAT AS kw_rank,
      ROW_NUMBER() OVER (ORDER BY ts_rank(rc.content_tsv, plainto_tsquery('spanish', query_text)) DESC) AS kw_row
    FROM rag_chunks rc
    WHERE rc.rag_id = match_rag_id
      AND rc.content_tsv @@ plainto_tsquery('spanish', query_text)
    ORDER BY kw_rank DESC
    LIMIT 30
  ),
  combined AS (
    SELECT
      s.id,
      s.content,
      s.subdomain,
      s.source_name,
      s.source_url,
      s.metadata,
      s.similarity,
      COALESCE(kw.kw_rank, 0)::FLOAT AS keyword_rank,
      (1.0 / (k + s.sem_rank) + COALESCE(1.0 / (k + kw.kw_row), 0))::FLOAT AS rrf_score
    FROM semantic s
    LEFT JOIN keyword kw ON kw.id = s.id
    
    UNION
    
    SELECT
      rc.id,
      rc.content,
      rc.subdomain,
      rs.source_name,
      rs.source_url,
      rc.metadata,
      (1 - (rc.embedding <=> query_embedding))::FLOAT AS similarity,
      kw.kw_rank::FLOAT AS keyword_rank,
      (COALESCE(1.0 / (k + sem_match.sem_rank), 0) + 1.0 / (k + kw.kw_row))::FLOAT AS rrf_score
    FROM keyword kw
    JOIN rag_chunks rc ON rc.id = kw.id
    LEFT JOIN rag_sources rs ON rs.id = rc.source_id
    LEFT JOIN semantic sem_match ON sem_match.id = kw.id
    WHERE sem_match.id IS NULL
  )
  SELECT DISTINCT ON (c.id)
    c.id, c.content, c.subdomain, c.source_name, c.source_url,
    c.metadata, c.similarity, c.keyword_rank, c.rrf_score
  FROM combined c
  ORDER BY c.id, c.rrf_score DESC;
  
  -- Re-order by rrf_score (workaround for DISTINCT ON)
  -- Actually let's restructure:
END;
$$;

-- Simpler, correct version
DROP FUNCTION IF EXISTS search_rag_hybrid(vector(1024), TEXT, UUID, INT);

CREATE OR REPLACE FUNCTION search_rag_hybrid(
  query_embedding vector(1024),
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
  metadata JSONB,
  similarity FLOAT,
  keyword_rank FLOAT,
  rrf_score FLOAT
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
    rc.metadata,
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

-- 7. Search graph nodes by embedding
CREATE OR REPLACE FUNCTION search_graph_nodes(
  query_embedding vector(1024),
  match_rag_id UUID,
  match_count INT DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id UUID,
  label TEXT,
  node_type TEXT,
  description TEXT,
  source_count INT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.label,
    n.node_type,
    n.description,
    n.source_count,
    (1 - (n.embedding <=> query_embedding))::FLOAT AS similarity
  FROM rag_knowledge_graph_nodes n
  WHERE n.rag_id = match_rag_id
    AND n.embedding IS NOT NULL
    AND (1 - (n.embedding <=> query_embedding))::FLOAT > match_threshold
  ORDER BY n.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 8. Increment node source count
CREATE OR REPLACE FUNCTION increment_node_source_count(node_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE rag_knowledge_graph_nodes
  SET source_count = COALESCE(source_count, 0) + 1
  WHERE id = node_id;
END;
$$;
