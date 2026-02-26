
-- Mark all orphaned running runs (>10 min old) for Bosco as completed
UPDATE rag_research_runs 
SET status = 'completed', completed_at = now(), error_log = 'Auto-healed orphan (remediation)'
WHERE rag_id = '8edd368f-31c2-4522-8b47-22a81f4a0000'
  AND status IN ('running', 'partial')
  AND started_at < now() - interval '10 minutes';

-- Ensure project is in building status
UPDATE rag_projects SET status = 'building', updated_at = now()
WHERE id = '8edd368f-31c2-4522-8b47-22a81f4a0000';
