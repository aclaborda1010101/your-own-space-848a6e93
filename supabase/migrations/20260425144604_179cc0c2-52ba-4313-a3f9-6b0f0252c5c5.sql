-- Recreate user_directory as SECURITY DEFINER function-backed view
-- so authenticated role can read it without direct GRANT on auth.users

DROP VIEW IF EXISTS public.user_directory;

CREATE OR REPLACE FUNCTION public.get_user_directory()
RETURNS TABLE (
  id uuid,
  email text,
  display_name text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    u.id,
    u.email::text,
    COALESCE(
      u.raw_user_meta_data ->> 'display_name',
      u.raw_user_meta_data ->> 'full_name',
      split_part(u.email::text, '@', 1)
    ) AS display_name
  FROM auth.users u;
$$;

CREATE VIEW public.user_directory
WITH (security_invoker = false) AS
SELECT id, email, display_name FROM public.get_user_directory();

GRANT SELECT ON public.user_directory TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_directory() TO authenticated, anon;