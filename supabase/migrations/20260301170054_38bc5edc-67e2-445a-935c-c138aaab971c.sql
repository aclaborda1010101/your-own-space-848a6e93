
-- =============================================
-- 1. Create resource_shares table
-- =============================================
CREATE TABLE public.resource_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  shared_with_id uuid NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  role text NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resource_shares_role_check CHECK (role IN ('viewer', 'editor')),
  CONSTRAINT resource_shares_type_check CHECK (resource_type IN ('business_project', 'task', 'rag_project', 'pattern_detector_run', 'people_contact', 'calendar', 'check_in', 'data_source')),
  CONSTRAINT resource_shares_no_self_share CHECK (owner_id != shared_with_id),
  UNIQUE (owner_id, shared_with_id, resource_type, resource_id)
);

ALTER TABLE public.resource_shares ENABLE ROW LEVEL SECURITY;

-- Owner can manage their shares
CREATE POLICY "Owners manage their shares"
  ON public.resource_shares FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Shared-with user can view shares targeting them
CREATE POLICY "Users can view shares with them"
  ON public.resource_shares FOR SELECT
  USING (auth.uid() = shared_with_id);

-- Index for fast lookups
CREATE INDEX idx_resource_shares_shared_with ON public.resource_shares (shared_with_id, resource_type);
CREATE INDEX idx_resource_shares_owner ON public.resource_shares (owner_id, resource_type);

-- =============================================
-- 2. Create user_directory view (safe, no passwords)
-- =============================================
CREATE OR REPLACE VIEW public.user_directory
WITH (security_invoker = on) AS
  SELECT 
    id,
    email,
    COALESCE(raw_user_meta_data->>'display_name', raw_user_meta_data->>'full_name', split_part(email, '@', 1)) AS display_name
  FROM auth.users;

-- =============================================
-- 3. Security functions
-- =============================================
CREATE OR REPLACE FUNCTION public.has_shared_access(
  p_user_id uuid, p_resource_type text, p_resource_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.resource_shares
    WHERE shared_with_id = p_user_id
      AND resource_type = p_resource_type
      AND (resource_id = p_resource_id OR resource_id IS NULL)
  );
$$;

CREATE OR REPLACE FUNCTION public.has_shared_edit_access(
  p_user_id uuid, p_resource_type text, p_resource_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.resource_shares
    WHERE shared_with_id = p_user_id
      AND resource_type = p_resource_type
      AND role = 'editor'
      AND (resource_id = p_resource_id OR resource_id IS NULL)
  );
$$;

-- Helper: get owner_id of a shared resource for auxiliary table checks
CREATE OR REPLACE FUNCTION public.has_shared_access_via_project(
  p_user_id uuid, p_project_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.resource_shares
    WHERE shared_with_id = p_user_id
      AND resource_type = 'business_project'
      AND (resource_id = p_project_id OR resource_id IS NULL)
  );
$$;

CREATE OR REPLACE FUNCTION public.has_shared_edit_via_project(
  p_user_id uuid, p_project_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.resource_shares
    WHERE shared_with_id = p_user_id
      AND resource_type = 'business_project'
      AND role = 'editor'
      AND (resource_id = p_project_id OR resource_id IS NULL)
  );
$$;

-- Function to find user by email (for sharing UI)
CREATE OR REPLACE FUNCTION public.find_user_by_email(p_email text)
RETURNS TABLE(id uuid, email text, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    u.id,
    u.email::text,
    COALESCE(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', split_part(u.email::text, '@', 1))::text AS display_name
  FROM auth.users u
  WHERE u.email = p_email
  LIMIT 1;
$$;

-- =============================================
-- 4. Update RLS on business_projects
-- =============================================
DROP POLICY IF EXISTS "Users manage own business_projects" ON public.business_projects;

CREATE POLICY "Users can view own or shared business_projects"
  ON public.business_projects FOR SELECT
  USING (auth.uid() = user_id OR has_shared_access(auth.uid(), 'business_project', id));

CREATE POLICY "Users can insert own business_projects"
  ON public.business_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own or shared-edit business_projects"
  ON public.business_projects FOR UPDATE
  USING (auth.uid() = user_id OR has_shared_edit_access(auth.uid(), 'business_project', id));

CREATE POLICY "Users can delete own business_projects"
  ON public.business_projects FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- 5. Update RLS on tasks
-- =============================================
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON public.tasks;

CREATE POLICY "Users can view own or shared tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() = user_id OR has_shared_access(auth.uid(), 'task', id));

CREATE POLICY "Users can insert own tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own or shared-edit tasks"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id OR has_shared_edit_access(auth.uid(), 'task', id));

CREATE POLICY "Users can delete own tasks"
  ON public.tasks FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- 6. Update RLS on rag_projects
-- =============================================
DROP POLICY IF EXISTS "Users manage own RAG projects" ON public.rag_projects;

CREATE POLICY "Users can view own or shared RAG projects"
  ON public.rag_projects FOR SELECT
  USING (auth.uid() = user_id OR has_shared_access(auth.uid(), 'rag_project', id));

CREATE POLICY "Users can insert own RAG projects"
  ON public.rag_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own or shared-edit RAG projects"
  ON public.rag_projects FOR UPDATE
  USING (auth.uid() = user_id OR has_shared_edit_access(auth.uid(), 'rag_project', id));

CREATE POLICY "Users can delete own RAG projects"
  ON public.rag_projects FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- 7. Update RLS on pattern_detector_runs
-- =============================================
DROP POLICY IF EXISTS "Users manage own runs" ON public.pattern_detector_runs;

CREATE POLICY "Users can view own or shared detector runs"
  ON public.pattern_detector_runs FOR SELECT
  USING (auth.uid() = user_id OR has_shared_access(auth.uid(), 'pattern_detector_run', id));

CREATE POLICY "Users can insert own detector runs"
  ON public.pattern_detector_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own or shared-edit detector runs"
  ON public.pattern_detector_runs FOR UPDATE
  USING (auth.uid() = user_id OR has_shared_edit_access(auth.uid(), 'pattern_detector_run', id));

CREATE POLICY "Users can delete own detector runs"
  ON public.pattern_detector_runs FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- 8. Update RLS on people_contacts
-- =============================================
DROP POLICY IF EXISTS "Users manage own contacts" ON public.people_contacts;

CREATE POLICY "Users can view own or shared contacts"
  ON public.people_contacts FOR SELECT
  USING (auth.uid() = user_id OR has_shared_access(auth.uid(), 'people_contact', id));

CREATE POLICY "Users can insert own contacts"
  ON public.people_contacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own or shared-edit contacts"
  ON public.people_contacts FOR UPDATE
  USING (auth.uid() = user_id OR has_shared_edit_access(auth.uid(), 'people_contact', id));

CREATE POLICY "Users can delete own contacts"
  ON public.people_contacts FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- 9. Update auxiliary tables (inherit from project)
-- =============================================
-- Update user_owns_business_project to include shared access
CREATE OR REPLACE FUNCTION public.user_owns_business_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_projects
    WHERE id = p_project_id AND (user_id = auth.uid() OR has_shared_access(auth.uid(), 'business_project', p_project_id))
  );
$$;

-- business_project_contacts: already uses user_owns_business_project, no change needed
-- business_project_timeline: already uses user_owns_business_project, no change needed

-- =============================================
-- 10. Update check_ins RLS
-- =============================================
DROP POLICY IF EXISTS "Users can view their own check-ins" ON public.check_ins;
DROP POLICY IF EXISTS "Users can create their own check-ins" ON public.check_ins;
DROP POLICY IF EXISTS "Users can update their own check-ins" ON public.check_ins;
DROP POLICY IF EXISTS "Users can delete their own check-ins" ON public.check_ins;

CREATE POLICY "Users can view own or shared check-ins"
  ON public.check_ins FOR SELECT
  USING (auth.uid() = user_id OR has_shared_access(auth.uid(), 'calendar', id));

CREATE POLICY "Users can insert own check-ins"
  ON public.check_ins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own or shared-edit check-ins"
  ON public.check_ins FOR UPDATE
  USING (auth.uid() = user_id OR has_shared_edit_access(auth.uid(), 'calendar', id));

CREATE POLICY "Users can delete own check-ins"
  ON public.check_ins FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- 11. Update data_sources_registry RLS
-- =============================================
DROP POLICY IF EXISTS "Users manage own sources" ON public.data_sources_registry;

CREATE POLICY "Users can view own or shared data sources"
  ON public.data_sources_registry FOR SELECT
  USING (auth.uid() = user_id OR has_shared_access(auth.uid(), 'data_source', id));

CREATE POLICY "Users can insert own data sources"
  ON public.data_sources_registry FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own or shared-edit data sources"
  ON public.data_sources_registry FOR UPDATE
  USING (auth.uid() = user_id OR has_shared_edit_access(auth.uid(), 'data_source', id));

CREATE POLICY "Users can delete own data sources"
  ON public.data_sources_registry FOR DELETE
  USING (auth.uid() = user_id);
