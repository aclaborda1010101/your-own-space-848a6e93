-- Fix jarvis_emails_cache: Remove overly permissive ALL policy
DROP POLICY IF EXISTS "all" ON public.jarvis_emails_cache;

-- Fix film_knowledge_index: Enable RLS with authenticated read access
ALTER TABLE public.film_knowledge_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read film knowledge"
ON public.film_knowledge_index
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service role can manage film knowledge"
ON public.film_knowledge_index
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);