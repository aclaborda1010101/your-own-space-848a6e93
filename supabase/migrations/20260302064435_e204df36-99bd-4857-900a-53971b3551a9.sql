
-- Add is_personal column to tasks
ALTER TABLE public.tasks ADD COLUMN is_personal BOOLEAN NOT NULL DEFAULT false;

-- Update SELECT policy: owner sees all, shared users only see non-personal
DROP POLICY "Users can view own or shared tasks" ON public.tasks;
CREATE POLICY "Users can view own or shared tasks" ON public.tasks
FOR SELECT USING (
  auth.uid() = user_id
  OR (
    is_personal = false
    AND has_shared_access(auth.uid(), 'task'::text, id)
  )
);

-- Update UPDATE policy: shared-edit only if not personal
DROP POLICY "Users can update own or shared-edit tasks" ON public.tasks;
CREATE POLICY "Users can update own or shared-edit tasks" ON public.tasks
FOR UPDATE USING (
  auth.uid() = user_id
  OR (
    is_personal = false
    AND has_shared_edit_access(auth.uid(), 'task'::text, id)
  )
);
