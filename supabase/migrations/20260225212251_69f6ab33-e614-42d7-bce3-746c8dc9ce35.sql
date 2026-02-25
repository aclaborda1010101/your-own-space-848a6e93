CREATE UNIQUE INDEX IF NOT EXISTS idx_single_post_build_job 
ON rag_jobs (rag_id, job_type) 
WHERE job_type IN ('POST_BUILD_TAXONOMY', 'POST_BUILD_CONTRA', 'POST_BUILD_QG');