
-- Mensajes del chat del agente JARVIS
CREATE TABLE IF NOT EXISTS agent_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('user', 'assistant', 'system', 'proactive')) NOT NULL,
  content TEXT NOT NULL,
  model_used TEXT,
  context_used JSONB DEFAULT '{}',
  actions_taken JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learnings del agente (correcciones, preferencias, patrones)
CREATE TABLE IF NOT EXISTS agent_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category TEXT CHECK (category IN ('correction', 'preference', 'knowledge_gap', 'error_pattern', 'workflow', 'tool_gotcha')) NOT NULL DEFAULT 'correction',
  trigger_text TEXT NOT NULL,
  learning_text TEXT NOT NULL,
  confidence NUMERIC(3,2) DEFAULT 0.80,
  recurrence_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE agent_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own chat messages" ON agent_chat_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own learnings" ON agent_learnings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_agent_chat_messages_user_created ON agent_chat_messages(user_id, created_at DESC);
CREATE INDEX idx_agent_learnings_user ON agent_learnings(user_id, created_at DESC);
