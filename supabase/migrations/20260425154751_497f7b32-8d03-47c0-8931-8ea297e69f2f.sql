DELETE FROM public.project_wizard_steps
WHERE project_id = '6ef807d1-9c3b-4a9d-b88a-71530c3d7aaf'
  AND step_number <> 1;

UPDATE public.business_projects
SET current_step = 1, analysis = NULL
WHERE id = '6ef807d1-9c3b-4a9d-b88a-71530c3d7aaf';