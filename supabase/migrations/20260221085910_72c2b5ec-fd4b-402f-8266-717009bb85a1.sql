
-- ═══════════════════════════════════════════════════════
-- RAG CONSTRUCTOR TOTAL - 16 TABLES + RLS + SEED DATA
-- ═══════════════════════════════════════════════════════

-- 1. rag_build_profiles
CREATE TABLE public.rag_build_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_key text UNIQUE NOT NULL,
  label text NOT NULL,
  description text,
  default_config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.rag_build_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read build profiles" ON public.rag_build_profiles FOR SELECT USING (true);

-- 2. rag_projects
CREATE TABLE public.rag_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.business_projects(id) ON DELETE SET NULL,
  domain_description text NOT NULL,
  moral_mode text NOT NULL DEFAULT 'dios' CHECK (moral_mode IN ('ethical','hardcore','dios')),
  build_profile text REFERENCES public.rag_build_profiles(profile_key),
  status text NOT NULL DEFAULT 'domain_analysis' CHECK (status IN ('domain_analysis','waiting_confirmation','researching','building','completed','failed','cancelled')),
  domain_map jsonb,
  domain_confirmed boolean DEFAULT false,
  domain_adjustments jsonb,
  current_phase int DEFAULT 0,
  total_sources int DEFAULT 0,
  total_chunks int DEFAULT 0,
  total_variables int DEFAULT 0,
  coverage_pct float DEFAULT 0,
  quality_verdict text,
  freshness_score float,
  error_log text,
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.rag_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own RAG projects" ON public.rag_projects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Helper function for RLS (now rag_projects exists)
CREATE OR REPLACE FUNCTION public.user_owns_rag_project(p_rag_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rag_projects
    WHERE id = p_rag_id AND user_id = auth.uid()
  );
$$;

-- 3. rag_research_runs
CREATE TABLE public.rag_research_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rag_id uuid NOT NULL REFERENCES public.rag_projects(id) ON DELETE CASCADE,
  subdomain text NOT NULL,
  research_level text NOT NULL,
  status text DEFAULT 'pending',
  sources_found int DEFAULT 0,
  chunks_generated int DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  error_log text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.rag_research_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own research runs" ON public.rag_research_runs FOR ALL USING (public.user_owns_rag_project(rag_id)) WITH CHECK (public.user_owns_rag_project(rag_id));

-- 4. rag_sources
CREATE TABLE public.rag_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rag_id uuid NOT NULL REFERENCES public.rag_projects(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.rag_research_runs(id) ON DELETE SET NULL,
  subdomain text,
  source_name text NOT NULL,
  source_url text,
  source_type text,
  tier text,
  quality_score float,
  relevance_score float,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.rag_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sources" ON public.rag_sources FOR ALL USING (public.user_owns_rag_project(rag_id)) WITH CHECK (public.user_owns_rag_project(rag_id));

-- 5. rag_chunks
CREATE TABLE public.rag_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rag_id uuid NOT NULL REFERENCES public.rag_projects(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.rag_sources(id) ON DELETE SET NULL,
  subdomain text,
  content text NOT NULL,
  chunk_index int DEFAULT 0,
  token_count int,
  embedding vector(1024),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.rag_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own chunks" ON public.rag_chunks FOR ALL USING (public.user_owns_rag_project(rag_id)) WITH CHECK (public.user_owns_rag_project(rag_id));
CREATE INDEX idx_rag_chunks_embedding ON public.rag_chunks USING hnsw (embedding vector_cosine_ops);

-- 6. rag_taxonomy
CREATE TABLE public.rag_taxonomy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rag_id uuid NOT NULL REFERENCES public.rag_projects(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.rag_taxonomy(id) ON DELETE CASCADE,
  name text NOT NULL,
  level int DEFAULT 0,
  description text,
  chunk_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.rag_taxonomy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own taxonomy" ON public.rag_taxonomy FOR ALL USING (public.user_owns_rag_project(rag_id)) WITH CHECK (public.user_owns_rag_project(rag_id));

-- 7. rag_variables
CREATE TABLE public.rag_variables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rag_id uuid NOT NULL REFERENCES public.rag_projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  variable_type text DEFAULT 'quantitative',
  description text,
  unit text,
  source_chunks uuid[] DEFAULT '{}',
  detected_values jsonb DEFAULT '[]',
  confidence float,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.rag_variables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own variables" ON public.rag_variables FOR ALL USING (public.user_owns_rag_project(rag_id)) WITH CHECK (public.user_owns_rag_project(rag_id));

-- 8. rag_knowledge_graph_nodes
CREATE TABLE public.rag_knowledge_graph_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rag_id uuid NOT NULL REFERENCES public.rag_projects(id) ON DELETE CASCADE,
  label text NOT NULL,
  node_type text,
  properties jsonb DEFAULT '{}',
  embedding vector(1024),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.rag_knowledge_graph_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own graph nodes" ON public.rag_knowledge_graph_nodes FOR ALL USING (public.user_owns_rag_project(rag_id)) WITH CHECK (public.user_owns_rag_project(rag_id));

-- 9. rag_knowledge_graph_edges
CREATE TABLE public.rag_knowledge_graph_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rag_id uuid NOT NULL REFERENCES public.rag_projects(id) ON DELETE CASCADE,
  source_node uuid NOT NULL REFERENCES public.rag_knowledge_graph_nodes(id) ON DELETE CASCADE,
  target_node uuid NOT NULL REFERENCES public.rag_knowledge_graph_nodes(id) ON DELETE CASCADE,
  edge_type text NOT NULL CHECK (edge_type IN ('causes','enhances','correlates','part_of','contradicts','requires')),
  weight float DEFAULT 1.0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.rag_knowledge_graph_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own graph edges" ON public.rag_knowledge_graph_edges FOR ALL USING (public.user_owns_rag_project(rag_id)) WITH CHECK (public.user_owns_rag_project(rag_id));

-- 10. rag_contradictions
CREATE TABLE public.rag_contradictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rag_id uuid NOT NULL REFERENCES public.rag_projects(id) ON DELETE CASCADE,
  claim_a text NOT NULL,
  claim_b text NOT NULL,
  source_a uuid REFERENCES public.rag_sources(id) ON DELETE SET NULL,
  source_b uuid REFERENCES public.rag_sources(id) ON DELETE SET NULL,
  resolution text,
  severity text DEFAULT 'medium',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.rag_contradictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own contradictions" ON public.rag_contradictions FOR ALL USING (public.user_owns_rag_project(rag_id)) WITH CHECK (public.user_owns_rag_project(rag_id));

-- 11. rag_quality_checks
CREATE TABLE public.rag_quality_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rag_id uuid NOT NULL REFERENCES public.rag_projects(id) ON DELETE CASCADE,
  check_type text NOT NULL,
  verdict text CHECK (verdict IN ('PRODUCTION_READY','GOOD_ENOUGH','INCOMPLETE')),
  score float,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.rag_quality_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own quality checks" ON public.rag_quality_checks FOR ALL USING (public.user_owns_rag_project(rag_id)) WITH CHECK (public.user_owns_rag_project(rag_id));

-- 12. rag_gaps
CREATE TABLE public.rag_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rag_id uuid NOT NULL REFERENCES public.rag_projects(id) ON DELETE CASCADE,
  subdomain text,
  gap_description text NOT NULL,
  severity text DEFAULT 'medium',
  suggested_sources text[],
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.rag_gaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own gaps" ON public.rag_gaps FOR ALL USING (public.user_owns_rag_project(rag_id)) WITH CHECK (public.user_owns_rag_project(rag_id));

-- 13. rag_query_log
CREATE TABLE public.rag_query_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rag_id uuid NOT NULL REFERENCES public.rag_projects(id) ON DELETE CASCADE,
  query text NOT NULL,
  response text,
  chunks_used uuid[],
  quality_score float,
  latency_ms int,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.rag_query_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own query logs" ON public.rag_query_log FOR ALL USING (public.user_owns_rag_project(rag_id)) WITH CHECK (public.user_owns_rag_project(rag_id));

-- 14. rag_embedding_configs
CREATE TABLE public.rag_embedding_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rag_id uuid NOT NULL REFERENCES public.rag_projects(id) ON DELETE CASCADE,
  model_name text DEFAULT 'text-embedding-004',
  dimensions int DEFAULT 1024,
  chunk_size int DEFAULT 512,
  chunk_overlap int DEFAULT 50,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.rag_embedding_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own embedding configs" ON public.rag_embedding_configs FOR ALL USING (public.user_owns_rag_project(rag_id)) WITH CHECK (public.user_owns_rag_project(rag_id));

-- 15. rag_traces
CREATE TABLE public.rag_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rag_id uuid NOT NULL REFERENCES public.rag_projects(id) ON DELETE CASCADE,
  trace_type text NOT NULL,
  phase text,
  message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.rag_traces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own traces" ON public.rag_traces FOR ALL USING (public.user_owns_rag_project(rag_id)) WITH CHECK (public.user_owns_rag_project(rag_id));

-- 16. rag_cross_learning
CREATE TABLE public.rag_cross_learning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rag_id_a uuid NOT NULL REFERENCES public.rag_projects(id) ON DELETE CASCADE,
  rag_id_b uuid NOT NULL REFERENCES public.rag_projects(id) ON DELETE CASCADE,
  overlap_score float,
  shared_concepts text[],
  transfer_suggestions jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.rag_cross_learning ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cross learning" ON public.rag_cross_learning FOR ALL USING (public.user_owns_rag_project(rag_id_a)) WITH CHECK (public.user_owns_rag_project(rag_id_a));

-- Trigger for rag_projects updated_at
CREATE TRIGGER update_rag_projects_updated_at
BEFORE UPDATE ON public.rag_projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed build profiles
INSERT INTO public.rag_build_profiles (profile_key, label, description, default_config) VALUES
('medical', 'Médico/Salud', 'Optimizado para literatura médica, ensayos clínicos, guías clínicas', '{"priority_sources": ["pubmed","cochrane","uptodate"], "chunk_size": 512, "min_quality": 0.8}'),
('legal', 'Legal/Regulatorio', 'Optimizado para legislación, jurisprudencia, doctrina', '{"priority_sources": ["westlaw","lexisnexis","boe"], "chunk_size": 768, "min_quality": 0.85}'),
('business', 'Negocio/Empresa', 'Optimizado para análisis de mercado, competencia, tendencias', '{"priority_sources": ["statista","mckinsey","hbr"], "chunk_size": 512, "min_quality": 0.7}'),
('creative', 'Creativo/Artístico', 'Optimizado para referencias visuales, narrativas, tendencias culturales', '{"priority_sources": ["arxiv","medium","behance"], "chunk_size": 384, "min_quality": 0.6}'),
('general', 'General', 'Perfil balanceado para cualquier dominio', '{"priority_sources": ["google_scholar","wikipedia","arxiv"], "chunk_size": 512, "min_quality": 0.7}');
