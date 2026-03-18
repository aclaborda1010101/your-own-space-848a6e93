CREATE OR REPLACE FUNCTION public.search_contacts_fuzzy(
  p_user_id uuid,
  p_search_term text,
  p_limit integer DEFAULT 5
)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql STABLE
AS $$
  SELECT pc.id, pc.name
  FROM public.people_contacts pc
  WHERE pc.user_id = p_user_id
    AND similarity(lower(pc.name), lower(p_search_term)) > 0.25
  ORDER BY similarity(lower(pc.name), lower(p_search_term)) DESC
  LIMIT p_limit;
$$;