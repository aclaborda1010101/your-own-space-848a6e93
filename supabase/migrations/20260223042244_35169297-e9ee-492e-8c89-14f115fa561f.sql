CREATE OR REPLACE FUNCTION public.check_chunk_duplicate(
  query_embedding vector(1024),
  match_rag_id UUID,
  similarity_threshold FLOAT DEFAULT 0.92
)
RETURNS TABLE (id UUID, similarity FLOAT)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT rc.id, (1 - (rc.embedding <=> query_embedding))::FLOAT AS similarity
  FROM rag_chunks rc
  WHERE rc.rag_id = match_rag_id
    AND rc.embedding IS NOT NULL
    AND (1 - (rc.embedding <=> query_embedding))::FLOAT > similarity_threshold
  LIMIT 1;
END;
$$;