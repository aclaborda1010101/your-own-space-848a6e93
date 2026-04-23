-- =============================================================
-- 1. Lock down legacy unattributed tables: jarvis_chat, jarvis_notifications, jarvis_bosco_log
-- =============================================================
DROP POLICY IF EXISTS "all" ON public.jarvis_chat;
DROP POLICY IF EXISTS "all" ON public.jarvis_notifications;
DROP POLICY IF EXISTS "all" ON public.jarvis_bosco_log;

ALTER TABLE public.jarvis_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jarvis_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jarvis_bosco_log ENABLE ROW LEVEL SECURITY;

-- Service role only (no policies for authenticated/anon = default deny)
CREATE POLICY "service_role_only" ON public.jarvis_chat
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_only" ON public.jarvis_notifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_only" ON public.jarvis_bosco_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================
-- 2. jarvis_whoop_data: remove public catch-all, add user-scoped policies
-- =============================================================
DROP POLICY IF EXISTS "all" ON public.jarvis_whoop_data;
-- Existing scoped SELECT policy "Users can view own whoop data" is retained.

CREATE POLICY "Users can insert own whoop data" ON public.jarvis_whoop_data
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own whoop data" ON public.jarvis_whoop_data
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own whoop data" ON public.jarvis_whoop_data
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- =============================================================
-- 3. Split user_owns_business_project into strict + lenient variants
-- =============================================================

-- Strict: owner or shared user only (no public flag). Used for INSERT/UPDATE/DELETE.
CREATE OR REPLACE FUNCTION public.user_owns_business_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.business_projects
    WHERE id = p_project_id
      AND (user_id = auth.uid()
           OR has_shared_access(auth.uid(), 'business_project', p_project_id))
  );
$function$;

-- Lenient: owner, shared user, or public project. Used for read-only checks.
CREATE OR REPLACE FUNCTION public.user_can_view_business_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.business_projects
    WHERE id = p_project_id
      AND (user_id = auth.uid()
           OR is_public = true
           OR has_shared_access(auth.uid(), 'business_project', p_project_id))
  );
$function$;

-- =============================================================
-- 4. Update SELECT policies to use lenient view function (preserve public read)
-- =============================================================

-- bl_diagnostics SELECT
DROP POLICY IF EXISTS "Users can read diagnostics" ON public.bl_diagnostics;
CREATE POLICY "Users can read diagnostics" ON public.bl_diagnostics
  FOR SELECT TO authenticated
  USING (
    user_owns_audit(audit_id)
    OR has_shared_access(auth.uid(), 'bl_audit', audit_id)
    OR (project_id IS NOT NULL AND user_can_view_business_project(project_id))
  );

-- bl_questionnaire_responses SELECT
DROP POLICY IF EXISTS "Users can read questionnaire responses" ON public.bl_questionnaire_responses;
CREATE POLICY "Users can read questionnaire responses" ON public.bl_questionnaire_responses
  FOR SELECT TO authenticated
  USING (
    user_owns_audit(audit_id)
    OR has_shared_access(auth.uid(), 'bl_audit', audit_id)
    OR (project_id IS NOT NULL AND user_can_view_business_project(project_id))
  );

-- bl_recommendations SELECT
DROP POLICY IF EXISTS "Users can read recommendations" ON public.bl_recommendations;
CREATE POLICY "Users can read recommendations" ON public.bl_recommendations
  FOR SELECT TO authenticated
  USING (
    user_owns_audit(audit_id)
    OR has_shared_access(auth.uid(), 'bl_audit', audit_id)
    OR (project_id IS NOT NULL AND user_can_view_business_project(project_id))
  );

-- bl_roadmaps SELECT
DROP POLICY IF EXISTS "Users can read roadmaps" ON public.bl_roadmaps;
CREATE POLICY "Users can read roadmaps" ON public.bl_roadmaps
  FOR SELECT TO authenticated
  USING (
    user_owns_audit(audit_id)
    OR has_shared_access(auth.uid(), 'bl_audit', audit_id)
    OR (project_id IS NOT NULL AND user_can_view_business_project(project_id))
  );

-- bl_client_proposals: was a single ALL policy. Split into SELECT (lenient) + write (strict).
DROP POLICY IF EXISTS "Users see own proposals" ON public.bl_client_proposals;
CREATE POLICY "Users can read proposals" ON public.bl_client_proposals
  FOR SELECT TO authenticated
  USING (user_can_view_business_project(project_id));
CREATE POLICY "Users can insert proposals" ON public.bl_client_proposals
  FOR INSERT TO authenticated
  WITH CHECK (user_owns_business_project(project_id));
CREATE POLICY "Users can update proposals" ON public.bl_client_proposals
  FOR UPDATE TO authenticated
  USING (user_owns_business_project(project_id))
  WITH CHECK (user_owns_business_project(project_id));
CREATE POLICY "Users can delete proposals" ON public.bl_client_proposals
  FOR DELETE TO authenticated
  USING (user_owns_business_project(project_id));

-- business_project_contacts: split ALL into lenient SELECT + strict writes
DROP POLICY IF EXISTS "Users manage own project contacts" ON public.business_project_contacts;
CREATE POLICY "Users can read project contacts" ON public.business_project_contacts
  FOR SELECT TO authenticated
  USING (user_can_view_business_project(project_id));
CREATE POLICY "Users can insert project contacts" ON public.business_project_contacts
  FOR INSERT TO authenticated
  WITH CHECK (user_owns_business_project(project_id));
CREATE POLICY "Users can update project contacts" ON public.business_project_contacts
  FOR UPDATE TO authenticated
  USING (user_owns_business_project(project_id))
  WITH CHECK (user_owns_business_project(project_id));
CREATE POLICY "Users can delete project contacts" ON public.business_project_contacts
  FOR DELETE TO authenticated
  USING (user_owns_business_project(project_id));

-- business_project_timeline: same pattern
DROP POLICY IF EXISTS "Users manage own project timeline" ON public.business_project_timeline;
CREATE POLICY "Users can read project timeline" ON public.business_project_timeline
  FOR SELECT TO authenticated
  USING (user_can_view_business_project(project_id));
CREATE POLICY "Users can insert project timeline" ON public.business_project_timeline
  FOR INSERT TO authenticated
  WITH CHECK (user_owns_business_project(project_id));
CREATE POLICY "Users can update project timeline" ON public.business_project_timeline
  FOR UPDATE TO authenticated
  USING (user_owns_business_project(project_id))
  WITH CHECK (user_owns_business_project(project_id));
CREATE POLICY "Users can delete project timeline" ON public.business_project_timeline
  FOR DELETE TO authenticated
  USING (user_owns_business_project(project_id));

-- project_documents (table): split ALL into lenient SELECT + strict writes
DROP POLICY IF EXISTS "Users manage own project documents" ON public.project_documents;
CREATE POLICY "Users can read project documents rows" ON public.project_documents
  FOR SELECT TO authenticated
  USING (user_can_view_business_project(project_id));
CREATE POLICY "Users can insert project documents rows" ON public.project_documents
  FOR INSERT TO authenticated
  WITH CHECK (user_owns_business_project(project_id) AND auth.uid() = user_id);
CREATE POLICY "Users can update project documents rows" ON public.project_documents
  FOR UPDATE TO authenticated
  USING (user_owns_business_project(project_id))
  WITH CHECK (user_owns_business_project(project_id) AND auth.uid() = user_id);
CREATE POLICY "Users can delete project documents rows" ON public.project_documents
  FOR DELETE TO authenticated
  USING (user_owns_business_project(project_id));

-- project_wizard_steps: split ALL into lenient SELECT + strict writes
DROP POLICY IF EXISTS "Users manage own wizard steps" ON public.project_wizard_steps;
CREATE POLICY "Users can read wizard steps" ON public.project_wizard_steps
  FOR SELECT TO authenticated
  USING (user_can_view_business_project(project_id));
CREATE POLICY "Users can insert wizard steps" ON public.project_wizard_steps
  FOR INSERT TO authenticated
  WITH CHECK (user_owns_business_project(project_id) AND auth.uid() = user_id);
CREATE POLICY "Users can update wizard steps" ON public.project_wizard_steps
  FOR UPDATE TO authenticated
  USING (user_owns_business_project(project_id))
  WITH CHECK (user_owns_business_project(project_id) AND auth.uid() = user_id);
CREATE POLICY "Users can delete wizard steps" ON public.project_wizard_steps
  FOR DELETE TO authenticated
  USING (user_owns_business_project(project_id));

-- =============================================================
-- 5. Storage bucket 'project-documents': add path-based ownership
--    File paths follow the pattern '{projectId}/...'. Verify the first
--    segment is a project the user owns (or has shared access to / public for read).
-- =============================================================
DROP POLICY IF EXISTS "Authenticated users can read project documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload project documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update project documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete project documents" ON storage.objects;

CREATE POLICY "Project members can read project documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-documents'
    AND (
      -- First path segment must be a UUID matching a project the user can view
      (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND user_can_view_business_project(((storage.foldername(name))[1])::uuid)
      )
    )
  );

CREATE POLICY "Project owners can upload project documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-documents'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND user_owns_business_project(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Project owners can update project documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'project-documents'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND user_owns_business_project(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Project owners can delete project documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-documents'
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND user_owns_business_project(((storage.foldername(name))[1])::uuid)
  );