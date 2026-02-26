-- Clean orphan FETCH jobs stuck in RETRY for Bosco RAG
UPDATE rag_jobs 
SET status = 'DLQ'
WHERE rag_id = '8edd368f-31c2-4522-8b47-22a81f4a0000'
  AND job_type = 'FETCH'
  AND status = 'RETRY'
  AND source_id IS NULL;
