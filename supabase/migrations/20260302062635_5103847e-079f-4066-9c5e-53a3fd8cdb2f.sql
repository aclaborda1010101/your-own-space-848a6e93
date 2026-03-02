
-- A3: normalized_name para KG nodes
ALTER TABLE rag_knowledge_graph_nodes ADD COLUMN IF NOT EXISTS normalized_name TEXT;
CREATE INDEX IF NOT EXISTS idx_kg_nodes_normalized ON rag_knowledge_graph_nodes (rag_id, normalized_name);

-- C1: context_variables para proyectos RAG
ALTER TABLE rag_projects ADD COLUMN IF NOT EXISTS context_variables JSONB DEFAULT '{}';

-- D2: extra columns en query_log para observabilidad
ALTER TABLE rag_query_log 
  ADD COLUMN IF NOT EXISTS chunks_retrieved INT,
  ADD COLUMN IF NOT EXISTS reranked_count INT,
  ADD COLUMN IF NOT EXISTS confidence NUMERIC,
  ADD COLUMN IF NOT EXISTS guardrail_triggered BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS feedback TEXT;
