ALTER TABLE rag_projects DROP CONSTRAINT IF EXISTS rag_projects_status_check;
ALTER TABLE rag_projects ADD CONSTRAINT rag_projects_status_check 
  CHECK (status IN ('domain_analysis', 'waiting_confirmation', 'researching', 'building', 'post_processing', 'completed', 'failed', 'cancelled'));