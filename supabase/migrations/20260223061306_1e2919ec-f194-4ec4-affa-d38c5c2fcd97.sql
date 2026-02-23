
-- 1. Contact Performance Indices
CREATE INDEX idx_people_contacts_category ON public.people_contacts (user_id, category);
CREATE INDEX idx_people_contacts_is_favorite ON public.people_contacts (user_id) WHERE is_favorite = true;
CREATE INDEX idx_people_contacts_personality_gin ON public.people_contacts USING GIN (personality_profile);

-- 2. RAG Domain Intelligence Table
CREATE TABLE public.rag_domain_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rag_id UUID NOT NULL REFERENCES public.rag_projects(id) ON DELETE CASCADE,
  user_input TEXT,
  interpreted_intent JSONB,
  subdomains JSONB,
  source_categories JSONB,
  critical_variables JSONB,
  validation_queries JSONB,
  known_debates JSONB,
  recommended_config JSONB,
  expert_sources JSONB,
  taxonomy JSONB,
  user_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_rag_domain_intelligence_rag_id UNIQUE (rag_id)
);

CREATE INDEX idx_rag_domain_intelligence_rag_id ON public.rag_domain_intelligence (rag_id);

-- 3. RLS
ALTER TABLE public.rag_domain_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own domain intelligence"
  ON public.rag_domain_intelligence
  FOR ALL
  USING (public.user_owns_rag_project(rag_id))
  WITH CHECK (public.user_owns_rag_project(rag_id));
