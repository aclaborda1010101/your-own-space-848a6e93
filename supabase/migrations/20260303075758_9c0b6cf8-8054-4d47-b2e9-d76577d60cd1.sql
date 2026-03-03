
-- One-time cleanup: move stuck jobs to DLQ for OpenClaw RAG
UPDATE rag_jobs SET status = 'DLQ', error = '{"message":"orphan_cleanup"}'::jsonb, locked_by = NULL, locked_at = NULL
WHERE rag_id = '30a6b07b-3ca7-4aab-a7dd-d941e3373cae' AND job_type = 'FETCH' AND status = 'RETRY';

UPDATE rag_jobs SET status = 'DLQ', error = '{"message":"stuck_loop_cleanup"}'::jsonb, locked_by = NULL, locked_at = NULL
WHERE rag_id = '30a6b07b-3ca7-4aab-a7dd-d941e3373cae' AND job_type IN ('POST_BUILD_KG','POST_BUILD_CONTRA') AND status = 'RETRY';

-- Enqueue POST_BUILD_QG if not exists
INSERT INTO rag_jobs (rag_id, job_type, payload, status)
SELECT '30a6b07b-3ca7-4aab-a7dd-d941e3373cae', 'POST_BUILD_QG', '{}'::jsonb, 'PENDING'
WHERE NOT EXISTS (
  SELECT 1 FROM rag_jobs WHERE rag_id = '30a6b07b-3ca7-4aab-a7dd-d941e3373cae' AND job_type = 'POST_BUILD_QG'
);
