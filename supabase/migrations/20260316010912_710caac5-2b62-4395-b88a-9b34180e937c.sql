-- Deduplicate: keep latest row per (project_id, step_number)
DELETE FROM project_wizard_steps a
USING project_wizard_steps b
WHERE a.project_id = b.project_id
  AND a.step_number = b.step_number
  AND a.created_at < b.created_at;

-- Add unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS project_wizard_steps_project_step_unique 
ON project_wizard_steps (project_id, step_number);