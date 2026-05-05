
-- 1) Fix Security Definer View: switch user_directory to security_invoker=true
ALTER VIEW public.user_directory SET (security_invoker = true);

-- 2) Tighten always-true RLS policies

-- cloudbot_chat: bot-driven shared table; restrict mutations to service_role
DROP POLICY IF EXISTS "Authenticated insert cloudbot_chat" ON public.cloudbot_chat;
DROP POLICY IF EXISTS "Authenticated update cloudbot_chat" ON public.cloudbot_chat;
DROP POLICY IF EXISTS "Authenticated delete cloudbot_chat" ON public.cloudbot_chat;

CREATE POLICY "Service role insert cloudbot_chat"
  ON public.cloudbot_chat FOR INSERT TO service_role
  WITH CHECK (true);
CREATE POLICY "Service role update cloudbot_chat"
  ON public.cloudbot_chat FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "Service role delete cloudbot_chat"
  ON public.cloudbot_chat FOR DELETE TO service_role
  USING (true);

-- plaud_recordings: scope service insert
DROP POLICY IF EXISTS "Allow service insert" ON public.plaud_recordings;
CREATE POLICY "Service role insert plaud_recordings"
  ON public.plaud_recordings FOR INSERT TO service_role
  WITH CHECK (true);

-- bl_questionnaire_templates: global templates, restrict writes to service_role
DROP POLICY IF EXISTS "Authenticated users can insert templates" ON public.bl_questionnaire_templates;
CREATE POLICY "Service role insert templates"
  ON public.bl_questionnaire_templates FOR INSERT TO service_role
  WITH CHECK (true);

-- suggested_responses: scope to service_role role explicitly
DROP POLICY IF EXISTS "Service role can insert suggested responses" ON public.suggested_responses;
CREATE POLICY "Service role insert suggested_responses"
  ON public.suggested_responses FOR INSERT TO service_role
  WITH CHECK (true);

-- project_costs: scope to service_role role explicitly
DROP POLICY IF EXISTS "Service role inserts costs" ON public.project_costs;
CREATE POLICY "Service role insert project_costs"
  ON public.project_costs FOR INSERT TO service_role
  WITH CHECK (true);

-- 3) Revoke EXECUTE from anon on SECURITY DEFINER internal functions.
--    Worker/admin functions: revoke from BOTH anon and authenticated.
REVOKE EXECUTE ON FUNCTION public.complete_external_job(uuid, text, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_taxonomy_batches_for_rag(uuid, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_job_done(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_job_retry(uuid, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pick_external_job(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pick_next_job(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pick_jarvis_ingestion_job(text, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_jarvis_suggestion_health(uuid, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_history_ingest_job(uuid, text, uuid, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.find_user_by_email(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_directory() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bump_contact_last_contact() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.schedule_task_reminder() FROM anon, PUBLIC;

-- Ownership/access helpers: only callable by signed-in users (used in RLS)
REVOKE EXECUTE ON FUNCTION public.has_project_access(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_shared_access(uuid, text, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_shared_access_via_project(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_shared_edit_access(uuid, text, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_shared_edit_via_project(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_in_quiet_hours(uuid, timestamptz) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_can_view_business_project(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_owns_audit(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_owns_business_project(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_owns_pattern_run(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_owns_pipeline(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_owns_rag_project(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_history_coverage(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_history_hybrid(uuid, vector, text, jarvis_source_type[], uuid[], timestamptz, timestamptz, smallint, integer, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_projects_fuzzy(uuid, text, integer) FROM anon, PUBLIC;
