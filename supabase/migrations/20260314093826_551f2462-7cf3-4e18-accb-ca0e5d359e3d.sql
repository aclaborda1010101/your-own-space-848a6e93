-- Table for persisting OpenClaw agent conversations
CREATE TABLE IF NOT EXISTS public.openclaw_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid NOT NULL DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content text NOT NULL DEFAULT '',
  tool_calls jsonb,
  tool_call_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_openclaw_chat_session ON public.openclaw_chat_messages(session_id, created_at);
CREATE INDEX idx_openclaw_chat_user ON public.openclaw_chat_messages(user_id, created_at DESC);

-- Table for proactive alerts queue
CREATE TABLE IF NOT EXISTS public.openclaw_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title text NOT NULL,
  description text,
  metadata jsonb,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_openclaw_alerts_user ON public.openclaw_alerts(user_id, acknowledged, created_at DESC);

ALTER TABLE public.openclaw_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.openclaw_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own chat messages"
  ON public.openclaw_chat_messages
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own alerts"
  ON public.openclaw_alerts
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());