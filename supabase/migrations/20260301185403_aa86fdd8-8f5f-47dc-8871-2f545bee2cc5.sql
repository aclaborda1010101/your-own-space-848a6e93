
-- 1. Update user_owns_audit to include shared access
CREATE OR REPLACE FUNCTION public.user_owns_audit(p_audit_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bl_audits
    WHERE id = p_audit_id 
      AND (user_id = auth.uid() 
           OR has_shared_access(auth.uid(), 'bl_audit', p_audit_id))
  );
$$;

-- 2. Add bl_audit to ALL_RESOURCE_TYPES sharing: update child table INSERT/DELETE policies

-- bl_questionnaire_responses
DROP POLICY IF EXISTS "Users can insert own questionnaire responses" ON public.bl_questionnaire_responses;
CREATE POLICY "Users can insert own questionnaire responses" ON public.bl_questionnaire_responses
FOR INSERT WITH CHECK (
  user_owns_audit(audit_id) 
  OR has_shared_edit_access(auth.uid(), 'bl_audit', audit_id)
);

DROP POLICY IF EXISTS "Users can delete own questionnaire responses" ON public.bl_questionnaire_responses;
CREATE POLICY "Users can delete own questionnaire responses" ON public.bl_questionnaire_responses
FOR DELETE USING (
  user_owns_audit(audit_id)
  OR has_shared_edit_access(auth.uid(), 'bl_audit', audit_id)
);

-- bl_diagnostics
DROP POLICY IF EXISTS "Users can insert own diagnostics" ON public.bl_diagnostics;
CREATE POLICY "Users can insert own diagnostics" ON public.bl_diagnostics
FOR INSERT WITH CHECK (
  user_owns_audit(audit_id)
  OR has_shared_edit_access(auth.uid(), 'bl_audit', audit_id)
);

DROP POLICY IF EXISTS "Users can delete own diagnostics" ON public.bl_diagnostics;
CREATE POLICY "Users can delete own diagnostics" ON public.bl_diagnostics
FOR DELETE USING (
  user_owns_audit(audit_id)
  OR has_shared_edit_access(auth.uid(), 'bl_audit', audit_id)
);

-- bl_recommendations
DROP POLICY IF EXISTS "Users can insert own recommendations" ON public.bl_recommendations;
CREATE POLICY "Users can insert own recommendations" ON public.bl_recommendations
FOR INSERT WITH CHECK (
  user_owns_audit(audit_id)
  OR has_shared_edit_access(auth.uid(), 'bl_audit', audit_id)
);

DROP POLICY IF EXISTS "Users can delete own recommendations" ON public.bl_recommendations;
CREATE POLICY "Users can delete own recommendations" ON public.bl_recommendations
FOR DELETE USING (
  user_owns_audit(audit_id)
  OR has_shared_edit_access(auth.uid(), 'bl_audit', audit_id)
);

-- bl_roadmaps
DROP POLICY IF EXISTS "Users can insert own roadmaps" ON public.bl_roadmaps;
CREATE POLICY "Users can insert own roadmaps" ON public.bl_roadmaps
FOR INSERT WITH CHECK (
  user_owns_audit(audit_id)
  OR has_shared_edit_access(auth.uid(), 'bl_audit', audit_id)
);

DROP POLICY IF EXISTS "Users can delete own roadmaps" ON public.bl_roadmaps;
CREATE POLICY "Users can delete own roadmaps" ON public.bl_roadmaps
FOR DELETE USING (
  user_owns_audit(audit_id)
  OR has_shared_edit_access(auth.uid(), 'bl_audit', audit_id)
);
