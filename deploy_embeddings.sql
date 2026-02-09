-- Knowledge Embeddings Migration
-- Creates tables and functions for semantic search with OpenAI embeddings

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create knowledge_embeddings table
CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding vector(1536),  -- OpenAI ada-002 dimension
  source TEXT,
  category TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS knowledge_embeddings_embedding_idx 
ON knowledge_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create text search index
CREATE INDEX IF NOT EXISTS knowledge_embeddings_content_idx 
ON knowledge_embeddings 
USING gin (to_tsvector('spanish', content));

-- RLS policies
ALTER TABLE knowledge_embeddings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated read" ON knowledge_embeddings;
DROP POLICY IF EXISTS "Service role full access" ON knowledge_embeddings;

-- Allow all authenticated users to read
CREATE POLICY "Allow authenticated read" ON knowledge_embeddings
FOR SELECT TO authenticated USING (true);

-- Only service_role can insert/update/delete
CREATE POLICY "Service role full access" ON knowledge_embeddings
FOR ALL TO service_role USING (true);

-- Function: Similarity search
CREATE OR REPLACE FUNCTION search_knowledge(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  source TEXT,
  category TEXT,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    knowledge_embeddings.id,
    knowledge_embeddings.content,
    knowledge_embeddings.source,
    knowledge_embeddings.category,
    1 - (knowledge_embeddings.embedding <=> query_embedding) as similarity
  FROM knowledge_embeddings
  WHERE 1 - (knowledge_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Text search (fallback if no embeddings)
CREATE OR REPLACE FUNCTION search_knowledge_text(
  query_text TEXT,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  source TEXT,
  category TEXT,
  rank float
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    knowledge_embeddings.id,
    knowledge_embeddings.content,
    knowledge_embeddings.source,
    knowledge_embeddings.category,
    ts_rank(to_tsvector('spanish', knowledge_embeddings.content), plainto_tsquery('spanish', query_text)) as rank
  FROM knowledge_embeddings
  WHERE to_tsvector('spanish', knowledge_embeddings.content) @@ plainto_tsquery('spanish', query_text)
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_knowledge_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_knowledge_embeddings_timestamp ON knowledge_embeddings;
CREATE TRIGGER update_knowledge_embeddings_timestamp
BEFORE UPDATE ON knowledge_embeddings
FOR EACH ROW
EXECUTE FUNCTION update_knowledge_timestamp();

-- Seed initial knowledge (productivity tips)
INSERT INTO knowledge_embeddings (content, source, category) 
SELECT * FROM (VALUES
  ('La técnica Pomodoro: trabaja 25 minutos, descansa 5. Después de 4 pomodoros, descanso largo de 15-30 min.', 'productivity', 'time-management'),
  ('Prioriza tareas con Eisenhower Matrix: Urgente+Importante > Importante > Urgente > Ni urgente ni importante', 'productivity', 'prioritization'),
  ('Time blocking: asigna bloques específicos del día a tareas concretas. Reduce context switching.', 'productivity', 'time-management'),
  ('Regla 2 minutos: si algo toma menos de 2 minutos, hazlo ahora. Si no, agéndalo.', 'productivity', 'gtd'),
  ('Deep Work (Cal Newport): bloques de 3-4h de trabajo concentrado sin interrupciones producen 10x más que trabajo fragmentado.', 'productivity', 'focus'),
  ('Batch similar tasks: responde emails juntos, haz llamadas juntas. Reduce overhead mental.', 'productivity', 'efficiency'),
  ('Morning routine: 30 min ejercicio + 15 min meditación + 15 min planificación = mejor día.', 'habits', 'morning'),
  ('Review semanal: domingos 1h para revisar semana pasada y planificar siguiente.', 'habits', 'reflection'),
  ('Delegación: si alguien puede hacer algo al 70% de tu nivel, delégalo. Enfócate en tu 10x zone.', 'productivity', 'delegation'),
  ('Energy management > Time management. Trabaja en tareas difíciles cuando tu energía está alta.', 'productivity', 'energy')
) AS t(content, source, category)
WHERE NOT EXISTS (SELECT 1 FROM knowledge_embeddings LIMIT 1);
