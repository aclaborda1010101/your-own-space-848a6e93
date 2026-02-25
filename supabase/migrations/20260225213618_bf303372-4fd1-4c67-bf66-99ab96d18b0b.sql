ALTER TABLE rag_knowledge_graph_nodes 
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS source_count integer DEFAULT 1;