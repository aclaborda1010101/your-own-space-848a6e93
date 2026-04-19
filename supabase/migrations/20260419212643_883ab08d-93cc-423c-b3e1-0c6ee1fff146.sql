ALTER TABLE public.openclaw_nodes ADD COLUMN IF NOT EXISTS provider text DEFAULT 'anthropic';

UPDATE public.openclaw_nodes SET provider = 'anthropic', model = 'claude-opus-4-7' WHERE name IN ('POTUS','TITAN');