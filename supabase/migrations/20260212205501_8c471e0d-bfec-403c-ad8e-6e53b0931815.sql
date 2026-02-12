
-- Tabla conversation_embeddings para RAG de conversaciones
CREATE TABLE public.conversation_embeddings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  transcription_id UUID REFERENCES public.transcriptions(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  brain TEXT,
  people TEXT[] DEFAULT '{}',
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.conversation_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversation embeddings"
  ON public.conversation_embeddings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversation embeddings"
  ON public.conversation_embeddings FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversation embeddings"
  ON public.conversation_embeddings FOR DELETE USING (auth.uid() = user_id);

-- Index for vector similarity search
CREATE INDEX idx_conversation_embeddings_embedding
  ON public.conversation_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_conversation_embeddings_user_date
  ON public.conversation_embeddings (user_id, date DESC);

CREATE INDEX idx_conversation_embeddings_brain
  ON public.conversation_embeddings (user_id, brain);

-- Function for semantic search
CREATE OR REPLACE FUNCTION public.search_conversations(
  query_embedding vector,
  p_user_id UUID,
  p_brain TEXT DEFAULT NULL,
  match_threshold DOUBLE PRECISION DEFAULT 0.7,
  match_count INTEGER DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  transcription_id UUID,
  date DATE,
  brain TEXT,
  people TEXT[],
  summary TEXT,
  content TEXT,
  metadata JSONB,
  similarity DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ce.id, ce.transcription_id, ce.date, ce.brain, ce.people,
    ce.summary, ce.content, ce.metadata,
    1 - (ce.embedding <=> query_embedding) AS similarity
  FROM public.conversation_embeddings ce
  WHERE ce.user_id = p_user_id
    AND (p_brain IS NULL OR ce.brain = p_brain)
    AND 1 - (ce.embedding <=> query_embedding) > match_threshold
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Tabla interactions para timeline multicanal
CREATE TABLE public.interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_id UUID REFERENCES public.people_contacts(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  channel TEXT NOT NULL DEFAULT 'plaud',
  interaction_type TEXT,
  summary TEXT,
  sentiment TEXT,
  commitments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own interactions"
  ON public.interactions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own interactions"
  ON public.interactions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own interactions"
  ON public.interactions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own interactions"
  ON public.interactions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_interactions_user_date ON public.interactions (user_id, date DESC);
CREATE INDEX idx_interactions_contact ON public.interactions (contact_id);

-- Ampliar daily_briefings con briefing_type
ALTER TABLE public.daily_briefings ADD COLUMN IF NOT EXISTS briefing_type TEXT DEFAULT 'morning';
