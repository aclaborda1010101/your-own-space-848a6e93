
CREATE OR REPLACE FUNCTION public.search_rag_chunks(
  query_embedding vector(1024),
  match_rag_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  subdomain TEXT,
  source_name TEXT,
  source_url TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rc.id,
    rc.content,
    rc.subdomain,
    rs.source_name,
    rs.source_url,
    rc.metadata,
    (1 - (rc.embedding <=> query_embedding))::FLOAT AS similarity
  FROM rag_chunks rc
  LEFT JOIN rag_sources rs ON rs.id = rc.source_id
  WHERE rc.rag_id = match_rag_id
    AND rc.embedding IS NOT NULL
    AND (1 - (rc.embedding <=> query_embedding))::FLOAT > match_threshold
  ORDER BY rc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
