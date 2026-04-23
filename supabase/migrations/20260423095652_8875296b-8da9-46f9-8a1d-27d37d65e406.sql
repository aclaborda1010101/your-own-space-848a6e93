-- 1. Añadir 'project' al enum jarvis_source_type (si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'project'
      AND enumtypid = 'public.jarvis_source_type'::regtype
  ) THEN
    ALTER TYPE public.jarvis_source_type ADD VALUE 'project';
  END IF;
END $$;

-- 2. Asegurar extensión pg_trgm para fuzzy search (ya debería estar, idempotente)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 3. Índice trigram sobre nombres de proyectos para búsqueda fuzzy rápida
CREATE INDEX IF NOT EXISTS idx_business_projects_name_trgm
  ON public.business_projects USING gin (lower(name) gin_trgm_ops);

-- 4. Función fuzzy search para proyectos del usuario
CREATE OR REPLACE FUNCTION public.search_projects_fuzzy(
  p_user_id uuid,
  p_search_term text,
  p_limit integer DEFAULT 5
)
RETURNS TABLE(id uuid, name text, score real)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    bp.id,
    bp.name,
    similarity(lower(bp.name), lower(p_search_term)) AS score
  FROM public.business_projects bp
  WHERE bp.user_id = p_user_id
    AND similarity(lower(bp.name), lower(p_search_term)) > 0.2
  ORDER BY score DESC, bp.name ASC
  LIMIT p_limit;
$$;

-- 5. Función helper para encolar un job de ingestión (idempotente por hash content)
CREATE OR REPLACE FUNCTION public.enqueue_history_ingest_job(
  p_user_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_source_table text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_source_id IS NULL THEN
    RETURN;
  END IF;

  -- Evitar duplicados pendientes para la misma fuente
  IF EXISTS (
    SELECT 1 FROM public.jarvis_ingestion_jobs
    WHERE user_id = p_user_id
      AND source_id = p_source_id
      AND source_table = p_source_table
      AND status IN ('pending','processing')
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.jarvis_ingestion_jobs (user_id, source_type, source_id, source_table, status)
  VALUES (p_user_id, p_source_type, p_source_id, p_source_table, 'pending');
END;
$$;

-- 6. Trigger genérico para emails entrantes
CREATE OR REPLACE FUNCTION public.trg_enqueue_email_ingest()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enqueue_history_ingest_job(
    NEW.user_id,
    'email',
    NEW.id,
    'jarvis_emails_cache'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jarvis_emails_cache_ingest ON public.jarvis_emails_cache;
CREATE TRIGGER trg_jarvis_emails_cache_ingest
  AFTER INSERT ON public.jarvis_emails_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enqueue_email_ingest();

-- 7. Trigger para timeline de proyectos (notas, llamadas, eventos del proyecto)
CREATE OR REPLACE FUNCTION public.trg_enqueue_project_timeline_ingest()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enqueue_history_ingest_job(
    NEW.user_id,
    'project',
    NEW.id,
    'business_project_timeline'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_project_timeline_ingest ON public.business_project_timeline;
CREATE TRIGGER trg_business_project_timeline_ingest
  AFTER INSERT ON public.business_project_timeline
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enqueue_project_timeline_ingest();

-- 8. Trigger para wizard steps cuando se aprueban (no en cada save)
CREATE OR REPLACE FUNCTION public.trg_enqueue_wizard_step_ingest()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo encolar cuando el paso pasa a approved/completed y tiene output
  IF (NEW.status IN ('approved','completed'))
     AND NEW.output_data IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
  THEN
    PERFORM public.enqueue_history_ingest_job(
      NEW.user_id,
      'project',
      NEW.id,
      'project_wizard_steps'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_wizard_steps_ingest ON public.project_wizard_steps;
CREATE TRIGGER trg_project_wizard_steps_ingest
  AFTER INSERT OR UPDATE ON public.project_wizard_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enqueue_wizard_step_ingest();

-- 9. Trigger para Plaud (transcripciones de reuniones) si la tabla existe y tiene user_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='plaud_recordings' AND column_name='user_id'
  ) THEN
    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION public.trg_enqueue_plaud_ingest()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      BEGIN
        PERFORM public.enqueue_history_ingest_job(
          NEW.user_id,
          'plaud',
          NEW.id,
          'plaud_recordings'
        );
        RETURN NEW;
      END;
      $body$;
    $sql$;

    DROP TRIGGER IF EXISTS trg_plaud_recordings_ingest ON public.plaud_recordings;
    CREATE TRIGGER trg_plaud_recordings_ingest
      AFTER INSERT ON public.plaud_recordings
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_enqueue_plaud_ingest();
  END IF;
END $$;