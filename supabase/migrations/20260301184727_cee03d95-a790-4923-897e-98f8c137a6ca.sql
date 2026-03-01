
-- Update bl_audits SELECT policy to also allow access via shared business_projects
DROP POLICY "Users can view own or shared audits" ON public.bl_audits;
CREATE POLICY "Users can view own or shared audits" ON public.bl_audits
FOR SELECT USING (
  auth.uid() = user_id 
  OR has_shared_access(auth.uid(), 'bl_audit'::text, id)
  OR (project_id IS NOT NULL AND has_shared_access_via_project(auth.uid(), project_id))
);
