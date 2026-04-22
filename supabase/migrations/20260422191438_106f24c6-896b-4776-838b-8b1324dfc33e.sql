
-- 1. Enable RLS on plaud_threads (no user_id column; restrict reads to authenticated, writes to service_role only)
ALTER TABLE public.plaud_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read plaud_threads"
ON public.plaud_threads
FOR SELECT
TO authenticated
USING (true);

-- Writes restricted to service_role only (edge functions); no policy needed for service_role since it bypasses RLS.
-- Explicitly deny anon:
-- (no policy means default deny for INSERT/UPDATE/DELETE for non-service-role)

-- 2. Restrict cloudbot tables to authenticated users (single-user personal-OS app)
-- Drop existing permissive USING(true) policies and replace with authenticated-only

-- cloudbot_chat
DROP POLICY IF EXISTS "Allow all access to cloudbot_chat" ON public.cloudbot_chat;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.cloudbot_chat;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.cloudbot_chat;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.cloudbot_chat;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.cloudbot_chat;
DROP POLICY IF EXISTS "Public read cloudbot_chat" ON public.cloudbot_chat;
DROP POLICY IF EXISTS "Public write cloudbot_chat" ON public.cloudbot_chat;

CREATE POLICY "Authenticated read cloudbot_chat"
ON public.cloudbot_chat FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert cloudbot_chat"
ON public.cloudbot_chat FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated update cloudbot_chat"
ON public.cloudbot_chat FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated delete cloudbot_chat"
ON public.cloudbot_chat FOR DELETE TO authenticated USING (true);

-- cloudbot_nodes
DROP POLICY IF EXISTS "Allow all access to cloudbot_nodes" ON public.cloudbot_nodes;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.cloudbot_nodes;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.cloudbot_nodes;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.cloudbot_nodes;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.cloudbot_nodes;
DROP POLICY IF EXISTS "Public read cloudbot_nodes" ON public.cloudbot_nodes;
DROP POLICY IF EXISTS "Public write cloudbot_nodes" ON public.cloudbot_nodes;

CREATE POLICY "Authenticated read cloudbot_nodes"
ON public.cloudbot_nodes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert cloudbot_nodes"
ON public.cloudbot_nodes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated update cloudbot_nodes"
ON public.cloudbot_nodes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated delete cloudbot_nodes"
ON public.cloudbot_nodes FOR DELETE TO authenticated USING (true);

-- cloudbot_tasks_log
DROP POLICY IF EXISTS "Allow all access to cloudbot_tasks_log" ON public.cloudbot_tasks_log;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.cloudbot_tasks_log;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.cloudbot_tasks_log;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.cloudbot_tasks_log;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.cloudbot_tasks_log;
DROP POLICY IF EXISTS "Public read cloudbot_tasks_log" ON public.cloudbot_tasks_log;
DROP POLICY IF EXISTS "Public write cloudbot_tasks_log" ON public.cloudbot_tasks_log;

CREATE POLICY "Authenticated read cloudbot_tasks_log"
ON public.cloudbot_tasks_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert cloudbot_tasks_log"
ON public.cloudbot_tasks_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated update cloudbot_tasks_log"
ON public.cloudbot_tasks_log FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated delete cloudbot_tasks_log"
ON public.cloudbot_tasks_log FOR DELETE TO authenticated USING (true);
