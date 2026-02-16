ALTER TABLE public.tasks DROP CONSTRAINT tasks_priority_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_priority_check CHECK (priority = ANY (ARRAY['P0', 'P1', 'P2', 'P3']));