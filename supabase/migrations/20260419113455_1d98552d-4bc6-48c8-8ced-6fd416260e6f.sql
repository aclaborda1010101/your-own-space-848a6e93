-- ─── OPENCLAW NODES ───
CREATE TABLE IF NOT EXISTS public.openclaw_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  host TEXT,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'idle',
  last_seen_at TIMESTAMPTZ,
  tokens_total BIGINT NOT NULL DEFAULT 0,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.openclaw_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own nodes" ON public.openclaw_nodes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_openclaw_nodes_user ON public.openclaw_nodes(user_id);

-- ─── OPENCLAW TASKS ───
CREATE TABLE IF NOT EXISTS public.openclaw_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  node_id UUID NOT NULL REFERENCES public.openclaw_nodes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'normal',
  tokens_used BIGINT NOT NULL DEFAULT 0,
  result TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.openclaw_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tasks" ON public.openclaw_tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_openclaw_tasks_user ON public.openclaw_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_openclaw_tasks_node ON public.openclaw_tasks(node_id);
CREATE INDEX IF NOT EXISTS idx_openclaw_tasks_status ON public.openclaw_tasks(status);

-- ─── OPENCLAW TASK LOGS ───
CREATE TABLE IF NOT EXISTS public.openclaw_task_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  task_id UUID NOT NULL REFERENCES public.openclaw_tasks(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.openclaw_task_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own task logs" ON public.openclaw_task_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_openclaw_task_logs_task ON public.openclaw_task_logs(task_id);

-- ─── TRIGGERS updated_at ───
CREATE TRIGGER trg_openclaw_nodes_updated
  BEFORE UPDATE ON public.openclaw_nodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_openclaw_tasks_updated
  BEFORE UPDATE ON public.openclaw_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── REALTIME ───
ALTER PUBLICATION supabase_realtime ADD TABLE public.openclaw_nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.openclaw_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.openclaw_task_logs;

-- ─── SEED TITAN + POTUS para todos los usuarios existentes ───
INSERT INTO public.openclaw_nodes (user_id, name, host, model, status, description)
SELECT u.id, 'TITAN', 'mac-mini-titan.local', 'gpt-5', 'idle',
  'Nodo principal de cómputo (Mac Mini M4 Pro). Orquestación pesada y agentes long-running.'
FROM auth.users u
ON CONFLICT (user_id, name) DO NOTHING;

INSERT INTO public.openclaw_nodes (user_id, name, host, model, status, description)
SELECT u.id, 'POTUS', 'potus.bridge', 'gemini-2.5-pro', 'idle',
  'Bridge ejecutivo (Telegram MoltBot). Decisiones rápidas y notificaciones.'
FROM auth.users u
ON CONFLICT (user_id, name) DO NOTHING;