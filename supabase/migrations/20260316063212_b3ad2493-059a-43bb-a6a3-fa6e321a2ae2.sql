-- Copy output_data from step 5 (legacy PRD) to step 3 (new schema PRD) for this project
UPDATE project_wizard_steps 
SET output_data = (
  SELECT output_data FROM project_wizard_steps 
  WHERE project_id = 'b3ac852a-3b15-446a-84ae-4ff009e639a6' AND step_number = 5
),
status = 'review',
updated_at = now()
WHERE project_id = 'b3ac852a-3b15-446a-84ae-4ff009e639a6' AND step_number = 3;

-- Update current_step to 3
UPDATE business_projects SET current_step = 3 WHERE id = 'b3ac852a-3b15-446a-84ae-4ff009e639a6';