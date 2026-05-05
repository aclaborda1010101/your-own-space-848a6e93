
-- 1. jarvis_messages: restrict to authenticated user_id scope
DROP POLICY IF EXISTS "jarvis_full_access" ON public.jarvis_messages;
CREATE POLICY "Users view own jarvis messages" ON public.jarvis_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own jarvis messages" ON public.jarvis_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own jarvis messages" ON public.jarvis_messages
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own jarvis messages" ON public.jarvis_messages
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. pattern_learning_log: only service_role
DROP POLICY IF EXISTS "Service role full access on pattern_learning_log" ON public.pattern_learning_log;
CREATE POLICY "Service role manages pattern_learning_log" ON public.pattern_learning_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. shared_memory: only service_role
DROP POLICY IF EXISTS "Service role full access" ON public.shared_memory;
CREATE POLICY "Service role manages shared_memory" ON public.shared_memory
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. cloudbot_chat: remove Allow all
DROP POLICY IF EXISTS "Allow all" ON public.cloudbot_chat;

-- 5. cloudbot_nodes: restrict to service_role
DROP POLICY IF EXISTS "Authenticated delete cloudbot_nodes" ON public.cloudbot_nodes;
DROP POLICY IF EXISTS "Authenticated insert cloudbot_nodes" ON public.cloudbot_nodes;
DROP POLICY IF EXISTS "Authenticated read cloudbot_nodes" ON public.cloudbot_nodes;
DROP POLICY IF EXISTS "Authenticated update cloudbot_nodes" ON public.cloudbot_nodes;
CREATE POLICY "Service role manages cloudbot_nodes" ON public.cloudbot_nodes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read cloudbot_nodes" ON public.cloudbot_nodes
  FOR SELECT TO authenticated USING (true);

-- 6. bl_public_responses: allow public INSERT when audit has public_questionnaire_enabled
CREATE POLICY "Anyone can submit public responses for enabled audits"
  ON public.bl_public_responses
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bl_audits a
      WHERE a.id = bl_public_responses.audit_id
        AND a.public_questionnaire_enabled = true
    )
  );

-- 7. Fix privilege escalation in shared access functions
CREATE OR REPLACE FUNCTION public.has_shared_access_via_project(p_user_id uuid, p_project_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.resource_shares
    WHERE shared_with_id = p_user_id
      AND resource_type = 'business_project'
      AND resource_id = p_project_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_shared_edit_via_project(p_user_id uuid, p_project_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.resource_shares
    WHERE shared_with_id = p_user_id
      AND resource_type = 'business_project'
      AND role = 'editor'
      AND resource_id = p_project_id
  );
$function$;

-- 8. Storage: scope project-data to first-folder = auth.uid()
DROP POLICY IF EXISTS "Users delete project data" ON storage.objects;
DROP POLICY IF EXISTS "Users read project data" ON storage.objects;
DROP POLICY IF EXISTS "Users upload project data" ON storage.objects;

CREATE POLICY "Users read own project data" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'project-data' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own project data" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-data' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own project data" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'project-data' AND auth.uid()::text = (storage.foldername(name))[1]);
