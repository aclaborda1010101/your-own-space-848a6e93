ALTER TABLE public.project_costs
  ALTER COLUMN project_id DROP NOT NULL,
  ALTER COLUMN step_number DROP NOT NULL,
  ALTER COLUMN user_id DROP NOT NULL;