-- Reset the stuck RAG project so it can be rebuilt with the new batch architecture
UPDATE rag_projects
SET status = 'failed',
    error_log = 'Reset para nueva arquitectura de lotes',
    updated_at = now()
WHERE status IN ('completed', 'building', 'researching')
AND coverage_pct < 100
AND total_chunks < 50;