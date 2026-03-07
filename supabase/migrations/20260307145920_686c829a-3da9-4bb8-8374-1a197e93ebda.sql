
-- Add user_id column to business_project_timeline for agent attribution
ALTER TABLE public.business_project_timeline 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Enable RLS (may already be enabled)
ALTER TABLE public.business_project_timeline ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "Users can view timeline of own projects" ON public.business_project_timeline;
DROP POLICY IF EXISTS "Users can insert timeline entries for own projects" ON public.business_project_timeline;
DROP POLICY IF EXISTS "Shared users can view timeline" ON public.business_project_timeline;
DROP POLICY IF EXISTS "Shared users can insert timeline" ON public.business_project_timeline;

-- Owner can read timeline entries for their projects
CREATE POLICY "Users can view timeline of own projects"
ON public.business_project_timeline
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.business_projects bp 
    WHERE bp.id = project_id AND bp.user_id = auth.uid()
  )
  OR public.has_shared_access(auth.uid(), 'business_project', project_id)
);

-- Owner/shared can insert timeline entries
CREATE POLICY "Users can insert timeline entries for own projects"
ON public.business_project_timeline
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.business_projects bp 
    WHERE bp.id = project_id AND bp.user_id = auth.uid()
  )
  OR public.has_shared_edit_access(auth.uid(), 'business_project', project_id)
);
