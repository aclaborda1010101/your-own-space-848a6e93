-- 1. Histórico de ubicación
CREATE TABLE IF NOT EXISTS public.user_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  altitude DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  source TEXT NOT NULL DEFAULT 'manual',
  context TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_location_history_user_captured
  ON public.user_location_history(user_id, captured_at DESC);

ALTER TABLE public.user_location_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own location history" ON public.user_location_history;
CREATE POLICY "Users can view their own location history"
  ON public.user_location_history FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own location" ON public.user_location_history;
CREATE POLICY "Users can insert their own location"
  ON public.user_location_history FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own location history" ON public.user_location_history;
CREATE POLICY "Users can delete their own location history"
  ON public.user_location_history FOR DELETE USING (auth.uid() = user_id);

-- 2. Ampliar device_tokens existente
ALTER TABLE public.device_tokens
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS app_version TEXT,
  ADD COLUMN IF NOT EXISTS device_model TEXT,
  ADD COLUMN IF NOT EXISTS os_version TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ NOT NULL DEFAULT now();

-- platform debe ser NOT NULL con check
DO $$
BEGIN
  ALTER TABLE public.device_tokens ALTER COLUMN platform SET DEFAULT 'ios';
  ALTER TABLE public.device_tokens ALTER COLUMN platform SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.device_tokens ADD CONSTRAINT device_tokens_platform_check
    CHECK (platform IN ('ios','android','web'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Unicidad (user_id, token) — solo si user_id no es null
CREATE UNIQUE INDEX IF NOT EXISTS device_tokens_user_token_unique
  ON public.device_tokens(user_id, token) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_active
  ON public.device_tokens(user_id, is_active) WHERE is_active = true;

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own device tokens" ON public.device_tokens;
CREATE POLICY "Users can manage their own device tokens"
  ON public.device_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_device_tokens_updated_at ON public.device_tokens;
CREATE TRIGGER trg_device_tokens_updated_at
  BEFORE UPDATE ON public.device_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Preferencias de notificación
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  tasks_enabled BOOLEAN NOT NULL DEFAULT true,
  calendar_enabled BOOLEAN NOT NULL DEFAULT true,
  jarvis_enabled BOOLEAN NOT NULL DEFAULT true,
  plaud_enabled BOOLEAN NOT NULL DEFAULT true,
  calendar_lead_minutes INTEGER NOT NULL DEFAULT 15,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start TEXT NOT NULL DEFAULT '23:00',
  quiet_hours_end TEXT NOT NULL DEFAULT '08:00',
  timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users manage own notification preferences"
  ON public.notification_preferences FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_notif_prefs_updated_at ON public.notification_preferences;
CREATE TRIGGER trg_notif_prefs_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Cola de notificaciones programadas
CREATE TABLE IF NOT EXISTS public.scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL CHECK (
    notification_type IN ('task_reminder','event_reminder','calendar_update','jarvis_suggestion','plaud_pending','custom')
  ),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  source_table TEXT,
  source_id UUID,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','cancelled','skipped_quiet_hours','skipped_disabled')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_pending
  ON public.scheduled_notifications(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_user
  ON public.scheduled_notifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_source
  ON public.scheduled_notifications(source_table, source_id) WHERE source_id IS NOT NULL;

ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own scheduled notifications" ON public.scheduled_notifications;
CREATE POLICY "Users view own scheduled notifications"
  ON public.scheduled_notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own scheduled notifications" ON public.scheduled_notifications;
CREATE POLICY "Users insert own scheduled notifications"
  ON public.scheduled_notifications FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own scheduled notifications" ON public.scheduled_notifications;
CREATE POLICY "Users update own scheduled notifications"
  ON public.scheduled_notifications FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own scheduled notifications" ON public.scheduled_notifications;
CREATE POLICY "Users delete own scheduled notifications"
  ON public.scheduled_notifications FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_scheduled_notifications_updated_at ON public.scheduled_notifications;
CREATE TRIGGER trg_scheduled_notifications_updated_at
  BEFORE UPDATE ON public.scheduled_notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Helper quiet hours
CREATE OR REPLACE FUNCTION public.is_in_quiet_hours(p_user_id UUID, p_at TIMESTAMPTZ DEFAULT now())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefs notification_preferences%ROWTYPE;
  v_local_time TIME;
  v_start TIME;
  v_end TIME;
BEGIN
  SELECT * INTO v_prefs FROM notification_preferences WHERE user_id = p_user_id;
  IF NOT FOUND OR NOT v_prefs.quiet_hours_enabled THEN
    RETURN FALSE;
  END IF;
  v_local_time := (p_at AT TIME ZONE v_prefs.timezone)::time;
  v_start := v_prefs.quiet_hours_start::time;
  v_end := v_prefs.quiet_hours_end::time;
  IF v_start > v_end THEN
    RETURN v_local_time >= v_start OR v_local_time < v_end;
  ELSE
    RETURN v_local_time >= v_start AND v_local_time < v_end;
  END IF;
END;
$$;