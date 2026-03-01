
-- 1. Update user_owns_rag_project to include shared access
CREATE OR REPLACE FUNCTION public.user_owns_rag_project(p_rag_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rag_projects
    WHERE id = p_rag_id AND (user_id = auth.uid() OR has_shared_access(auth.uid(), 'rag_project', p_rag_id))
  );
$$;

-- 2. Update project_wizard_steps RLS to use user_owns_business_project
DROP POLICY IF EXISTS "Users manage own wizard steps" ON public.project_wizard_steps;
CREATE POLICY "Users manage own wizard steps" ON public.project_wizard_steps
  FOR ALL USING (user_owns_business_project(project_id))
  WITH CHECK (auth.uid() = user_id);

-- 3. Update project_documents RLS
DROP POLICY IF EXISTS "Users manage own project documents" ON public.project_documents;
CREATE POLICY "Users manage own project documents" ON public.project_documents
  FOR ALL USING (user_owns_business_project(project_id))
  WITH CHECK (auth.uid() = user_id);

-- 4. Update project_costs SELECT RLS
DROP POLICY IF EXISTS "Users view own project costs" ON public.project_costs;
CREATE POLICY "Users view own project costs" ON public.project_costs
  FOR SELECT USING (auth.uid() = user_id OR has_shared_access_via_project(auth.uid(), project_id));

-- 5. Create helper function for pattern detector run shared access
CREATE OR REPLACE FUNCTION public.user_owns_pattern_run(p_run_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pattern_detector_runs
    WHERE id = p_run_id AND (user_id = auth.uid() OR has_shared_access(auth.uid(), 'pattern_detector_run', p_run_id))
  );
$$;

-- 6. Update signal_registry RLS
DROP POLICY IF EXISTS "Users manage own signals" ON public.signal_registry;
CREATE POLICY "Users view own or shared signals" ON public.signal_registry
  FOR SELECT USING (auth.uid() = user_id OR user_owns_pattern_run(run_id));
CREATE POLICY "Users insert own signals" ON public.signal_registry
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own signals" ON public.signal_registry
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own signals" ON public.signal_registry
  FOR DELETE USING (auth.uid() = user_id);

-- 7. Update model_backtests RLS
DROP POLICY IF EXISTS "Users manage own backtests" ON public.model_backtests;
CREATE POLICY "Users view own or shared backtests" ON public.model_backtests
  FOR SELECT USING (auth.uid() = user_id OR user_owns_pattern_run(run_id));
CREATE POLICY "Users insert own backtests" ON public.model_backtests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own backtests" ON public.model_backtests
  FOR UPDATE USING (auth.uid() = user_id);

-- 8. Update economic_backtests RLS
DROP POLICY IF EXISTS "Users see own economic backtests" ON public.economic_backtests;
CREATE POLICY "Users view own or shared economic backtests" ON public.economic_backtests
  FOR SELECT USING (auth.uid() = user_id OR user_owns_pattern_run(run_id));
CREATE POLICY "Users insert own economic backtests" ON public.economic_backtests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 9. Update signal_credibility_matrix RLS
DROP POLICY IF EXISTS "Users see own credibility" ON public.signal_credibility_matrix;
CREATE POLICY "Users view own or shared credibility" ON public.signal_credibility_matrix
  FOR SELECT USING (auth.uid() = user_id OR user_owns_pattern_run(run_id));
CREATE POLICY "Users insert own credibility" ON public.signal_credibility_matrix
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 10. Update pattern_discovery_log RLS
DROP POLICY IF EXISTS "Users see own discoveries" ON public.pattern_discovery_log;
CREATE POLICY "Users view own or shared discoveries" ON public.pattern_discovery_log
  FOR SELECT USING (auth.uid() = user_id OR user_owns_pattern_run(run_id));
CREATE POLICY "Users insert own discoveries" ON public.pattern_discovery_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 11. Update rag_jobs user SELECT policy to use updated user_owns_rag_project
DROP POLICY IF EXISTS "Users can view their own rag jobs" ON public.rag_jobs;
CREATE POLICY "Users can view own or shared rag jobs" ON public.rag_jobs
  FOR SELECT USING (user_owns_rag_project(rag_id));
