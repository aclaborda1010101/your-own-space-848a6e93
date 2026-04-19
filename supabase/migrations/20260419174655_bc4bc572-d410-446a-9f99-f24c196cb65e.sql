-- Seed realista de OpenClaw: estado live/simulated visible inmediato
-- Idempotente: actualiza nodos existentes, inserta tareas/ejecuciones solo si el usuario no las tiene aún.

-- 1) POTUS online ahora
UPDATE public.openclaw_nodes
SET last_seen_at = now() - interval '30 seconds',
    status = 'online',
    tokens_today = 4823,
    tokens_today_date = current_date,
    tokens_total = GREATEST(tokens_total, 187420),
    metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('mode','simulated','env','remote','region','EU','bridge_status','pending_live')
WHERE name = 'POTUS';

-- 2) TITAN idle (offline visual >5min)
UPDATE public.openclaw_nodes
SET last_seen_at = now() - interval '8 minutes',
    status = 'idle',
    tokens_today = 1240,
    tokens_today_date = current_date,
    tokens_total = GREATEST(tokens_total, 92110),
    metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('mode','simulated','env','local','host','mac-mini-titan','bridge_status','pending_live')
WHERE name = 'TITAN';

-- 3) Insertar tareas de muestra para cada usuario que aún no tenga ninguna
INSERT INTO public.openclaw_tasks (user_id, node_id, title, description, status, priority, tokens_used, created_at, started_at, finished_at, result)
SELECT n.user_id, n.id,
  t.title, t.description, t.status, t.priority, t.tokens_used,
  now() - (t.age_min || ' minutes')::interval,
  CASE WHEN t.status IN ('running','done') THEN now() - (t.age_min || ' minutes')::interval ELSE NULL END,
  CASE WHEN t.status = 'done' THEN now() - ((t.age_min - 2) || ' minutes')::interval ELSE NULL END,
  CASE WHEN t.status = 'done' THEN 'OK · simulated' ELSE NULL END
FROM public.openclaw_nodes n
JOIN (VALUES
  ('POTUS','Resumen diario inbox',           'Revisar correos sin leer y proponer respuestas.', 'pending', 'high',     0, 4),
  ('POTUS','Brief reunión 18:00',            'Preparar contexto cliente Acme + últimos hitos.', 'running', 'critical', 320, 12),
  ('POTUS','Sync agenda iCloud → Google',    'Detectar conflictos en bloques de mañana.',       'done',    'normal',   612, 45),
  ('TITAN','Reindex RAG patterns',           'Recompilar embeddings de pattern-detector v4.',   'pending', 'normal',   0, 2),
  ('TITAN','Compilar manifest forge',        'Build #182 + push artifacts.',                    'done',    'high',     1840, 75),
  ('TITAN','Health check Mac Mini',          'CPU, GPU, disco, temperaturas.',                  'done',    'low',     45, 120)
) AS t(node_name, title, description, status, priority, tokens_used, age_min)
  ON t.node_name = n.name
WHERE NOT EXISTS (
  SELECT 1 FROM public.openclaw_tasks ot WHERE ot.user_id = n.user_id
);

-- 4) Ejecuciones de muestra por usuario (logs visibles)
INSERT INTO public.openclaw_task_executions (user_id, task_id, node_id, node_name, status, source, model_used, tokens_used, duration_ms, output, started_at, finished_at)
SELECT t.user_id, t.id, t.node_id, n.name,
  CASE WHEN t.status = 'running' THEN 'running'
       WHEN t.status = 'done' THEN 'done'
       ELSE 'queued' END,
  'seed', n.model, t.tokens_used,
  CASE WHEN t.status = 'done' THEN 1200 + (random()*8000)::int ELSE NULL END,
  CASE WHEN t.status = 'done' THEN 'Ejecución completa · ' || t.title ELSE NULL END,
  t.created_at,
  t.finished_at
FROM public.openclaw_tasks t
JOIN public.openclaw_nodes n ON n.id = t.node_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.openclaw_task_executions e WHERE e.task_id = t.id
);

-- 5) Tareas recurrentes ejemplo para cada usuario que no tenga ninguna
INSERT INTO public.openclaw_recurring_tasks (user_id, node_id, title, description, priority, schedule_label, schedule_cron, enabled, last_run_at, run_count)
SELECT n.user_id, n.id, r.title, r.description, r.priority, r.schedule_label, r.schedule_cron, r.enabled,
  now() - (r.last_run_min || ' minutes')::interval, r.run_count
FROM public.openclaw_nodes n
JOIN (VALUES
  ('POTUS','Inbox sweep',           'Resumen de correos cada hora laboral.',  'normal', 'Cada hora · L-V 9-19', '0 9-19 * * 1-5', true,  18,  42),
  ('POTUS','Daily briefing 07:30',  'Plan del día + WHOOP + agenda.',          'high',   'Diario 07:30',         '30 7 * * *',     true,  720, 31),
  ('TITAN','Reindex RAG diario',    'Recompila embeddings de RAGs activos.',   'normal', 'Diario 03:00',         '0 3 * * *',      true,  1440,12),
  ('TITAN','Backup Mac Mini',       'Snapshot estado nodos + DB local.',       'low',    'Semanal Domingo 02:00','0 2 * * 0',      false, 4320, 4)
) AS r(node_name, title, description, priority, schedule_label, schedule_cron, enabled, last_run_min, run_count)
  ON r.node_name = n.name
WHERE NOT EXISTS (
  SELECT 1 FROM public.openclaw_recurring_tasks ort WHERE ort.user_id = n.user_id
);