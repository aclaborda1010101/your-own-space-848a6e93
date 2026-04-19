-- Activar extensiones necesarias para cron + http
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Programar el dispatcher cada minuto
DO $$
BEGIN
  -- Quitar job anterior si existía
  PERFORM cron.unschedule('dispatch-scheduled-notifications');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'dispatch-scheduled-notifications',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/dispatch-scheduled-notifications',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmamx3eHNzeGZ2aGJpeXRjb2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDI4MDUsImV4cCI6MjA4NTIxODgwNX0.EgH-i0SBnlWH3lF4ZgZ3b8SRdBZc5fZruWmyaIu9GIQ"}'::jsonb,
    body := jsonb_build_object('triggered_at', now())
  );
  $cron$
);

-- Trigger: programar recordatorio cuando se crea/actualiza una task con due_date
CREATE OR REPLACE FUNCTION public.schedule_task_reminder()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scheduled_for TIMESTAMPTZ;
BEGIN
  -- DELETE → cancelar pendientes
  IF TG_OP = 'DELETE' THEN
    UPDATE scheduled_notifications
    SET status = 'cancelled'
    WHERE source_table = 'tasks' AND source_id = OLD.id AND status = 'pending';
    RETURN OLD;
  END IF;

  -- Tarea completada → cancelar pendientes
  IF NEW.completed = true AND (TG_OP = 'INSERT' OR OLD.completed = false) THEN
    UPDATE scheduled_notifications
    SET status = 'cancelled'
    WHERE source_table = 'tasks' AND source_id = NEW.id AND status = 'pending';
    RETURN NEW;
  END IF;

  -- Sin due_date → no programar nada
  IF NEW.due_date IS NULL OR NEW.completed = true THEN
    RETURN NEW;
  END IF;

  -- Solo cuando cambia due_date (o es INSERT)
  IF TG_OP = 'UPDATE' AND OLD.due_date IS NOT DISTINCT FROM NEW.due_date THEN
    RETURN NEW;
  END IF;

  -- Cancelar pendientes anteriores para esta tarea
  UPDATE scheduled_notifications
  SET status = 'cancelled'
  WHERE source_table = 'tasks' AND source_id = NEW.id AND status = 'pending';

  -- Programar para las 09:00 del due_date (zona Europe/Madrid)
  v_scheduled_for := (NEW.due_date::text || ' 09:00:00')::timestamp AT TIME ZONE 'Europe/Madrid';

  -- Solo programar si es futuro
  IF v_scheduled_for > now() THEN
    INSERT INTO scheduled_notifications (
      user_id, notification_type, title, body, data,
      source_table, source_id, scheduled_for
    ) VALUES (
      NEW.user_id,
      'task_reminder',
      'Tarea para hoy',
      NEW.title,
      jsonb_build_object('task_id', NEW.id, 'route', '/tasks?task=' || NEW.id),
      'tasks',
      NEW.id,
      v_scheduled_for
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schedule_task_reminder ON public.tasks;
CREATE TRIGGER trg_schedule_task_reminder
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.schedule_task_reminder();