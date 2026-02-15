
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
