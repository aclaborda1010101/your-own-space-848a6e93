-- Migration: Create conversation_history table for JARVIS voice realtime
-- Date: 2025-02-09

-- Create table for storing conversation history
CREATE TABLE IF NOT EXISTS conversation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL DEFAULT 'default',
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_conversation_history_user_id 
  ON conversation_history(user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_history_agent_type 
  ON conversation_history(user_id, agent_type);

CREATE INDEX IF NOT EXISTS idx_conversation_history_created_at 
  ON conversation_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_history_session 
  ON conversation_history((metadata->>'sessionId')) 
  WHERE metadata->>'sessionId' IS NOT NULL;

-- Enable RLS
ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own conversation history"
  ON conversation_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages"
  ON conversation_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can do everything"
  ON conversation_history
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Add comment
COMMENT ON TABLE conversation_history IS 'Stores JARVIS voice conversation history for RAG and context';
