-- Reset 89 FETCH RETRY jobs to PENDING for RAG Bosco
UPDATE rag_jobs 
SET status = 'PENDING', attempt = 0, run_after = now(), error = NULL,
    locked_by = NULL, locked_at = NULL
WHERE rag_id = '8edd368f-31c2-4522-8b47-22a81f4a0000' 
  AND job_type = 'FETCH' AND status = 'RETRY';