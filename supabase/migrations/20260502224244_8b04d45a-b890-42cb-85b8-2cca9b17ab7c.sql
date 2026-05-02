-- Fix 1: pattern_feedback - replace overly permissive policy with service_role-only
DROP POLICY IF EXISTS "Service role full access on pattern_feedback" ON public.pattern_feedback;

CREATE POLICY "Service role full access on pattern_feedback"
ON public.pattern_feedback
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Fix 2: cloudbot_nodes - drop the public "Allow all" policy (authenticated policies remain)
DROP POLICY IF EXISTS "Allow all" ON public.cloudbot_nodes;

-- Fix 3: call_audios bucket -> private + owner-scoped storage policies
UPDATE storage.buckets SET public = false WHERE id = 'call_audios';

DROP POLICY IF EXISTS "call_audios owner select" ON storage.objects;
DROP POLICY IF EXISTS "call_audios owner insert" ON storage.objects;
DROP POLICY IF EXISTS "call_audios owner update" ON storage.objects;
DROP POLICY IF EXISTS "call_audios owner delete" ON storage.objects;

CREATE POLICY "call_audios owner select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'call_audios' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "call_audios owner insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'call_audios' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "call_audios owner update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'call_audios' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'call_audios' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "call_audios owner delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'call_audios' AND auth.uid()::text = (storage.foldername(name))[1]);