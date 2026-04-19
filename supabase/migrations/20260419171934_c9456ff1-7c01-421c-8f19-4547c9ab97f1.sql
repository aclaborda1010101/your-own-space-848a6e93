
-- Tareas recurrentes para OpenClaw Hub
CREATE TABLE IF NOT EXISTS public.openclaw_recurring_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  node_id uuid NOT NULL REFERENCES public.openclaw_nodes(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'normal',
  schedule_label text NOT NULL,
  schedule_cron text,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  run_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_openclaw_recurring_user ON public.openclaw_recurring_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_openclaw_recurring_node ON public.openclaw_recurring_tasks(node_id);

ALTER TABLE public.openclaw_recurring_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their recurring tasks" ON public.openclaw_recurring_tasks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their recurring tasks" ON public.openclaw_recurring_tasks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their recurring tasks" ON public.openclaw_recurring_tasks
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their recurring tasks" ON public.openclaw_recurring_tasks
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_openclaw_recurring_updated
  BEFORE UPDATE ON public.openclaw_recurring_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ejecuciones por tarea (log enriquecido con tokens, modelo, duración)
CREATE TABLE IF NOT EXISTS public.openclaw_task_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id uuid REFERENCES public.openclaw_tasks(id) ON DELETE CASCADE,
  recurring_task_id uuid REFERENCES public.openclaw_recurring_tasks(id) ON DELETE SET NULL,
  node_id uuid NOT NULL REFERENCES public.openclaw_nodes(id) ON DELETE CASCADE,
  node_name text,
  status text NOT NULL DEFAULT 'queued',
  source text NOT NULL DEFAULT 'manual',
  model_used text,
  tokens_used integer NOT NULL DEFAULT 0,
  duration_ms integer,
  output text,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_openclaw_exec_user_started ON public.openclaw_task_executions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_openclaw_exec_node ON public.openclaw_task_executions(node_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_openclaw_exec_task ON public.openclaw_task_executions(task_id);

ALTER TABLE public.openclaw_task_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their executions" ON public.openclaw_task_executions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their executions" ON public.openclaw_task_executions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their executions" ON public.openclaw_task_executions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Columna para tokens "today" (acumulado por día) en nodos
ALTER TABLE public.openclaw_nodes
  ADD COLUMN IF NOT EXISTS tokens_today integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_today_date date NOT NULL DEFAULT CURRENT_DATE;
