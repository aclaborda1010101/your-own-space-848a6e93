-- Remove the overly permissive "all" policy on jarvis_whatsapp_cache
-- that allows any authenticated user to read/write all rows
DROP POLICY IF EXISTS "all" ON public.jarvis_whatsapp_cache;