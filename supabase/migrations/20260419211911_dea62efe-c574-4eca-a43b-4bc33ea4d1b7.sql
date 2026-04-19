
ALTER TABLE public.openclaw_nodes
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS ip text,
  ADD COLUMN IF NOT EXISTS active_task text,
  ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0;

ALTER TABLE public.openclaw_tasks
  ADD COLUMN IF NOT EXISTS logs text;
