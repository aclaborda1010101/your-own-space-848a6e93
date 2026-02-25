-- Clean up old POST_BUILD jobs for Farmacias to unblock unique index
DELETE FROM rag_jobs 
WHERE rag_id = '8a3b722d-5def-4dc9-98f8-421f56843d63' 
  AND job_type LIKE 'POST_BUILD_%';

-- Ensure correct status
UPDATE rag_projects 
SET status = 'building', quality_verdict = NULL, updated_at = now()
WHERE id = '8a3b722d-5def-4dc9-98f8-421f56843d63';