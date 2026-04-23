-- 1. Fix plaud_transcriptions: drop overly permissive "public ALL" policy
DROP POLICY IF EXISTS "Service role full access to plaud transcriptions" ON public.plaud_transcriptions;

-- 2. Fix has_shared_access / has_shared_edit_access: remove NULL wildcard escalation
CREATE OR REPLACE FUNCTION public.has_shared_access(p_user_id uuid, p_resource_type text, p_resource_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.resource_shares
    WHERE shared_with_id = p_user_id
      AND resource_type = p_resource_type
      AND resource_id = p_resource_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_shared_edit_access(p_user_id uuid, p_resource_type text, p_resource_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.resource_shares
    WHERE shared_with_id = p_user_id
      AND resource_type = p_resource_type
      AND role = 'editor'
      AND resource_id = p_resource_id
  );
$function$;

-- Defensive: clean up any pre-existing wildcard rows
DELETE FROM public.resource_shares WHERE resource_id IS NULL;

-- Add NOT NULL to prevent future wildcard inserts
ALTER TABLE public.resource_shares ALTER COLUMN resource_id SET NOT NULL;

-- 3. Restrict cloudbot_tasks_log to service_role only
DROP POLICY IF EXISTS "Authenticated read cloudbot_tasks_log" ON public.cloudbot_tasks_log;
DROP POLICY IF EXISTS "Authenticated insert cloudbot_tasks_log" ON public.cloudbot_tasks_log;
DROP POLICY IF EXISTS "Authenticated update cloudbot_tasks_log" ON public.cloudbot_tasks_log;
DROP POLICY IF EXISTS "Authenticated delete cloudbot_tasks_log" ON public.cloudbot_tasks_log;

CREATE POLICY "Service role manages cloudbot_tasks_log"
ON public.cloudbot_tasks_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 4. Enable RLS on previously unprotected public tables (default deny)
ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cinematographic_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialist_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialist_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialist_invocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jarvis_entity_mentions ENABLE ROW LEVEL SECURITY;

-- Service-role-only access (these are internal/system tables)
CREATE POLICY "Service role full access" ON public.prices
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.cinematographic_patterns
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.specialist_knowledge
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.specialist_metadata
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.specialist_invocations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.jarvis_entity_mentions
  FOR ALL TO service_role USING (true) WITH CHECK (true);