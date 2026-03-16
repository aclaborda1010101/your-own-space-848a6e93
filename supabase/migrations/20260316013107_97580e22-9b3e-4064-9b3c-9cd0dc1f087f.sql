-- Performance indexes for high-traffic tables (Sprint 0)

-- daily_logs
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_id ON public.daily_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON public.daily_logs(date DESC);

-- tasks
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON public.tasks(user_id, completed);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks(created_at DESC);

-- business_projects
CREATE INDEX IF NOT EXISTS idx_business_projects_user_id ON public.business_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_business_projects_status ON public.business_projects(user_id, status);

-- people_contacts
CREATE INDEX IF NOT EXISTS idx_people_contacts_user_id ON public.people_contacts(user_id);

-- bl_diagnostics (no user_id, index on audit_id and project_id)
CREATE INDEX IF NOT EXISTS idx_bl_diagnostics_audit_id ON public.bl_diagnostics(audit_id);
CREATE INDEX IF NOT EXISTS idx_bl_diagnostics_project_id ON public.bl_diagnostics(project_id);

-- bl_audits
CREATE INDEX IF NOT EXISTS idx_bl_audits_user_id ON public.bl_audits(user_id);

-- check_ins
CREATE INDEX IF NOT EXISTS idx_check_ins_user_date ON public.check_ins(user_id, date DESC);

-- jarvis_memory
CREATE INDEX IF NOT EXISTS idx_jarvis_memory_user_id ON public.jarvis_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_jarvis_memory_type ON public.jarvis_memory(user_id, memory_type);

-- transcriptions
CREATE INDEX IF NOT EXISTS idx_transcriptions_user_id ON public.transcriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_transcriptions_created_at ON public.transcriptions(created_at DESC);