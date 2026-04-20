-- Mover tareas auto-creadas por contact-analysis (no validadas) a la bandeja de sugerencias
-- Firma del bloque syncedTasks: priority='P1' AND duration=15 AND contact_id NOT NULL AND completed=false

WITH candidatas AS (
  SELECT t.id, t.user_id, t.title, t.type, t.contact_id, t.priority, t.duration, t.created_at,
         pc.name AS contact_name
  FROM public.tasks t
  LEFT JOIN public.people_contacts pc ON pc.id = t.contact_id
  WHERE t.completed = false
    AND t.contact_id IS NOT NULL
    AND t.priority = 'P1'
    AND t.duration = 15
    AND t.created_at >= '2026-04-01'::timestamptz
),
inserted AS (
  INSERT INTO public.suggestions (user_id, suggestion_type, status, content, confidence, reasoning, created_at)
  SELECT
    c.user_id,
    'task_from_contact_analysis',
    'pending',
    jsonb_build_object(
      'title', c.title,
      'type', c.type,
      'priority', 'medium',
      'contact_id', c.contact_id,
      'contact_name', c.contact_name,
      'source', 'contact-analysis',
      'description', c.title,
      'duration', 30,
      'recovered_from_tasks', true,
      'original_task_id', c.id
    ),
    0.7,
    'Tarea creada automáticamente por contact-analysis antes del fix. Movida a bandeja para que la valides.',
    c.created_at
  FROM candidatas c
  RETURNING id
)
DELETE FROM public.tasks
WHERE id IN (SELECT id FROM candidatas);