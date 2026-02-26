-- Mark 89 orphan FETCH jobs (no source_id) as DLQ - they're unrecoverable
UPDATE rag_jobs 
SET status = 'DLQ', error = '{"message":"source_id is NULL - orphan job, unrecoverable"}'::jsonb
WHERE rag_id = '8edd368f-31c2-4522-8b47-22a81f4a0000' 
  AND job_type = 'FETCH' AND source_id IS NULL AND status = 'RETRY';