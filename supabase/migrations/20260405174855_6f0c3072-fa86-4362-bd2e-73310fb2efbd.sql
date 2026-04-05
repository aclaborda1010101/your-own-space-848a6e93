
-- Add is_public column
ALTER TABLE public.business_projects 
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

-- Update helper function to include is_public check
CREATE OR REPLACE FUNCTION public.user_owns_business_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_projects
    WHERE id = p_project_id 
      AND (user_id = auth.uid() 
           OR is_public = true
           OR has_shared_access(auth.uid(), 'business_project', p_project_id))
  );
$$;

-- Update SELECT policy to include is_public
DROP POLICY IF EXISTS "Users can view own or shared business_projects" ON public.business_projects;

CREATE POLICY "Users can view own public or shared business_projects"
  ON public.business_projects FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() 
    OR is_public = true 
    OR has_shared_access(auth.uid(), 'business_project', id)
  );
