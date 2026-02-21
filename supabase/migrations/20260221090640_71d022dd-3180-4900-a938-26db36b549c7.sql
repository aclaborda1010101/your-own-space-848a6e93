
-- rag_api_keys: client access to RAGs via chat/API
CREATE TABLE public.rag_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rag_id UUID NOT NULL REFERENCES public.rag_projects(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL UNIQUE,
  client_name TEXT,
  monthly_query_limit INT DEFAULT 1000,
  queries_used_this_month INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_rag_api_keys_rag ON public.rag_api_keys(rag_id);
CREATE INDEX idx_rag_api_keys_key ON public.rag_api_keys(api_key);

ALTER TABLE public.rag_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_manage_rag_api_keys" ON public.rag_api_keys
  FOR ALL USING (public.user_owns_rag_project(rag_id));

-- rag_exports: track exported files
CREATE TABLE public.rag_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rag_id UUID NOT NULL REFERENCES public.rag_projects(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('chat_embed', 'api', 'document_pdf', 'document_md', 'document_docx', 'portable_package')),
  file_path TEXT,
  file_size_mb NUMERIC(10,2),
  download_count INT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_rag_exports_rag ON public.rag_exports(rag_id);

ALTER TABLE public.rag_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_manage_rag_exports" ON public.rag_exports
  FOR ALL USING (public.user_owns_rag_project(rag_id));
