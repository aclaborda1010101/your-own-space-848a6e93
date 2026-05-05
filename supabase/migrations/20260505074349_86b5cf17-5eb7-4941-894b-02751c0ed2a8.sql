-- 1) Fix privilege escalation: only editor-shared users (not viewers) get owner-level write
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
           OR has_shared_edit_access(auth.uid(), 'business_project', p_project_id))
  );
$function$;

-- 2) Remove internal/service-only tables from Realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.cloudbot_tasks_log;
ALTER PUBLICATION supabase_realtime DROP TABLE public.shared_memory;

-- 3) Restrict the import-files "service role" storage policy to the service_role only
DROP POLICY IF EXISTS "Service role full access import files" ON storage.objects;
CREATE POLICY "Service role full access import files"
ON storage.objects
AS PERMISSIVE
FOR ALL
TO service_role
USING (bucket_id = 'import-files')
WITH CHECK (bucket_id = 'import-files');