
-- 1) analyzed_scripts: enable RLS + user-scoped policies
ALTER TABLE public.analyzed_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analyzed scripts"
ON public.analyzed_scripts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyzed scripts"
ON public.analyzed_scripts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analyzed scripts"
ON public.analyzed_scripts FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own analyzed scripts"
ON public.analyzed_scripts FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 2) cloudbot_tasks_log: remove anonymous "Allow all" policy
DROP POLICY IF EXISTS "Allow all" ON public.cloudbot_tasks_log;

-- 3) plaud_threads: replace permissive read policy with ownership check via plaud_recordings
DROP POLICY IF EXISTS "Authenticated users can read plaud_threads" ON public.plaud_threads;

CREATE POLICY "Users can read own plaud_threads"
ON public.plaud_threads FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.plaud_recordings pr
    WHERE pr.id = ANY (plaud_threads.recording_ids)
      AND pr.user_id = auth.uid()
  )
);

-- Also tighten plaud_recordings public-read policy to authenticated users only
-- (keeping behavior similar but removing anonymous access)
DROP POLICY IF EXISTS "Allow public read" ON public.plaud_recordings;

CREATE POLICY "Users can read own plaud_recordings"
ON public.plaud_recordings FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
