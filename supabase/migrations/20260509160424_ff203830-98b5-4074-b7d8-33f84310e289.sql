-- Restrict cloudbot_chat and cloudbot_nodes SELECT to service_role only.
DROP POLICY IF EXISTS "Authenticated read cloudbot_chat" ON public.cloudbot_chat;
DROP POLICY IF EXISTS "Authenticated read cloudbot_nodes" ON public.cloudbot_nodes;