
-- Helper function to check audit ownership (avoids recursion)
CREATE OR REPLACE FUNCTION public.user_owns_audit(p_audit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bl_audits
    WHERE id = p_audit_id AND user_id = auth.uid()
  );
$$;

-- =============================================
-- 1. bl_audits: add shared access
-- =============================================
DROP POLICY IF EXISTS "Users can view own audits" ON public.bl_audits;
CREATE POLICY "Users can view own or shared audits" ON public.bl_audits
  FOR SELECT USING (
    auth.uid() = user_id
    OR has_shared_access(auth.uid(), 'bl_audit', id)
  );

DROP POLICY IF EXISTS "Users can update own audits" ON public.bl_audits;
CREATE POLICY "Users can update own or shared audits" ON public.bl_audits
  FOR UPDATE USING (
    auth.uid() = user_id
    OR has_shared_edit_access(auth.uid(), 'bl_audit', id)
  );

DROP POLICY IF EXISTS "Users can delete own audits" ON public.bl_audits;
CREATE POLICY "Users can delete own audits" ON public.bl_audits
  FOR DELETE USING (auth.uid() = user_id);

-- INSERT stays the same (already correct)

-- =============================================
-- 2. bl_questionnaire_responses: audit-based access
-- =============================================
DROP POLICY IF EXISTS "Users see own questionnaire responses" ON public.bl_questionnaire_responses;

CREATE POLICY "Users can read questionnaire responses" ON public.bl_questionnaire_responses
  FOR SELECT USING (
    user_owns_audit(audit_id)
    OR has_shared_access(auth.uid(), 'bl_audit', audit_id)
    OR (project_id IS NOT NULL AND user_owns_business_project(project_id))
  );

CREATE POLICY "Users can insert questionnaire responses" ON public.bl_questionnaire_responses
  FOR INSERT WITH CHECK (
    user_owns_audit(audit_id)
    OR (project_id IS NOT NULL AND user_owns_business_project(project_id))
  );

CREATE POLICY "Users can update questionnaire responses" ON public.bl_questionnaire_responses
  FOR UPDATE USING (
    user_owns_audit(audit_id)
    OR has_shared_edit_access(auth.uid(), 'bl_audit', audit_id)
    OR (project_id IS NOT NULL AND user_owns_business_project(project_id))
  );

CREATE POLICY "Users can delete questionnaire responses" ON public.bl_questionnaire_responses
  FOR DELETE USING (
    user_owns_audit(audit_id)
    OR (project_id IS NOT NULL AND user_owns_business_project(project_id))
  );

-- =============================================
-- 3. bl_diagnostics: audit-based access
-- =============================================
DROP POLICY IF EXISTS "Users see own diagnostics" ON public.bl_diagnostics;

CREATE POLICY "Users can read diagnostics" ON public.bl_diagnostics
  FOR SELECT USING (
    user_owns_audit(audit_id)
    OR has_shared_access(auth.uid(), 'bl_audit', audit_id)
    OR (project_id IS NOT NULL AND user_owns_business_project(project_id))
  );

CREATE POLICY "Users can insert diagnostics" ON public.bl_diagnostics
  FOR INSERT WITH CHECK (
    user_owns_audit(audit_id)
    OR (project_id IS NOT NULL AND user_owns_business_project(project_id))
  );

CREATE POLICY "Users can update diagnostics" ON public.bl_diagnostics
  FOR UPDATE USING (
    user_owns_audit(audit_id)
    OR has_shared_edit_access(auth.uid(), 'bl_audit', audit_id)
    OR (project_id IS NOT NULL AND user_owns_business_project(project_id))
  );

CREATE POLICY "Users can delete diagnostics" ON public.bl_diagnostics
  FOR DELETE USING (
    user_owns_audit(audit_id)
    OR (project_id IS NOT NULL AND user_owns_business_project(project_id))
  );

-- =============================================
-- 4. bl_recommendations: audit-based access
-- =============================================
DROP POLICY IF EXISTS "Users see own recommendations" ON public.bl_recommendations;

CREATE POLICY "Users can read recommendations" ON public.bl_recommendations
  FOR SELECT USING (
    user_owns_audit(audit_id)
    OR has_shared_access(auth.uid(), 'bl_audit', audit_id)
    OR (project_id IS NOT NULL AND user_owns_business_project(project_id))
  );

CREATE POLICY "Users can insert recommendations" ON public.bl_recommendations
  FOR INSERT WITH CHECK (
    user_owns_audit(audit_id)
    OR (project_id IS NOT NULL AND user_owns_business_project(project_id))
  );

CREATE POLICY "Users can update recommendations" ON public.bl_recommendations
  FOR UPDATE USING (
    user_owns_audit(audit_id)
    OR has_shared_edit_access(auth.uid(), 'bl_audit', audit_id)
    OR (project_id IS NOT NULL AND user_owns_business_project(project_id))
  );

CREATE POLICY "Users can delete recommendations" ON public.bl_recommendations
  FOR DELETE USING (
    user_owns_audit(audit_id)
    OR (project_id IS NOT NULL AND user_owns_business_project(project_id))
  );

-- =============================================
-- 5. bl_roadmaps: audit-based access
-- =============================================
DROP POLICY IF EXISTS "Users see own roadmaps" ON public.bl_roadmaps;

CREATE POLICY "Users can read roadmaps" ON public.bl_roadmaps
  FOR SELECT USING (
    user_owns_audit(audit_id)
    OR has_shared_access(auth.uid(), 'bl_audit', audit_id)
    OR (project_id IS NOT NULL AND user_owns_business_project(project_id))
  );

CREATE POLICY "Users can insert roadmaps" ON public.bl_roadmaps
  FOR INSERT WITH CHECK (
    user_owns_audit(audit_id)
    OR (project_id IS NOT NULL AND user_owns_business_project(project_id))
  );

CREATE POLICY "Users can update roadmaps" ON public.bl_roadmaps
  FOR UPDATE USING (
    user_owns_audit(audit_id)
    OR has_shared_edit_access(auth.uid(), 'bl_audit', audit_id)
    OR (project_id IS NOT NULL AND user_owns_business_project(project_id))
  );

CREATE POLICY "Users can delete roadmaps" ON public.bl_roadmaps
  FOR DELETE USING (
    user_owns_audit(audit_id)
    OR (project_id IS NOT NULL AND user_owns_business_project(project_id))
  );
