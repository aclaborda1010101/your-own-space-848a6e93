-- Add rag_tier column to rag_projects
ALTER TABLE rag_projects ADD COLUMN IF NOT EXISTS rag_tier TEXT DEFAULT 'normal';

-- Add check constraint (separate statement for safety)
DO $$ BEGIN
  ALTER TABLE rag_projects ADD CONSTRAINT rag_projects_rag_tier_check 
    CHECK (rag_tier IN ('basic', 'normal', 'pro'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Update check_chunk_duplicate default threshold from 0.92 to 0.96
CREATE OR REPLACE FUNCTION public.check_chunk_duplicate(query_embedding vector, match_rag_id uuid, similarity_threshold double precision DEFAULT 0.96)
 RETURNS TABLE(id uuid, similarity double precision)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT rc.id, (1 - (rc.embedding <=> query_embedding))::FLOAT AS similarity
  FROM rag_chunks rc
  WHERE rc.rag_id = match_rag_id
    AND rc.embedding IS NOT NULL
    AND (1 - (rc.embedding <=> query_embedding))::FLOAT > similarity_threshold
  LIMIT 1;
END;
$function$;