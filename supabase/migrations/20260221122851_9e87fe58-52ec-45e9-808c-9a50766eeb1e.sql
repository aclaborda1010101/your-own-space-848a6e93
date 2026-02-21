
-- Reset the existing RAG project to 'failed' so it can be rebuilt with real pipeline
UPDATE rag_projects SET status = 'failed', error_log = 'Reset para migración a pipeline RAG real', total_sources = 0, total_chunks = 0, total_variables = 0, coverage_pct = 0, quality_verdict = NULL, updated_at = now() WHERE id = '8edd368f-31c2-4522-8b47-22a81f4a0000';

-- Delete old synthetic chunks
DELETE FROM rag_chunks WHERE rag_id = '8edd368f-31c2-4522-8b47-22a81f4a0000';
DELETE FROM rag_sources WHERE rag_id = '8edd368f-31c2-4522-8b47-22a81f4a0000';
DELETE FROM rag_research_runs WHERE rag_id = '8edd368f-31c2-4522-8b47-22a81f4a0000';
DELETE FROM rag_variables WHERE rag_id = '8edd368f-31c2-4522-8b47-22a81f4a0000';
