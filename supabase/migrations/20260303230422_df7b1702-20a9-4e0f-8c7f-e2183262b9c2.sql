
-- Table: client_data_files
CREATE TABLE public.client_data_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES business_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_type TEXT,
  storage_path TEXT,
  source_mode TEXT NOT NULL CHECK (source_mode IN ('upload', 'url_crawl', 'database')),
  source_url TEXT,
  row_count INTEGER DEFAULT 0,
  columns TEXT[] DEFAULT '{}',
  column_types JSONB DEFAULT '{}',
  entities_detected TEXT[] DEFAULT '{}',
  variables_detected JSONB DEFAULT '[]',
  temporal_coverage JSONB,
  geographic_coverage TEXT[] DEFAULT '{}',
  quality_score INTEGER DEFAULT 0,
  quality_issues TEXT[] DEFAULT '{}',
  business_context TEXT DEFAULT '',
  status TEXT DEFAULT 'uploading' CHECK (status IN ('uploading', 'analyzing', 'analyzed', 'error')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE client_data_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages files" ON client_data_files
  FOR ALL USING (user_id = auth.uid());

-- Storage bucket: project-data (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('project-data', 'project-data', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: owner can upload/read own project files
CREATE POLICY "Users upload project data" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'project-data' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users read project data" ON storage.objects
  FOR SELECT USING (bucket_id = 'project-data' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users delete project data" ON storage.objects
  FOR DELETE USING (bucket_id = 'project-data' AND auth.uid() IS NOT NULL);
