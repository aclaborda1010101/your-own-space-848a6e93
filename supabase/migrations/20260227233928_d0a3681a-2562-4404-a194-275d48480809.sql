
-- Add columns to project_documents
ALTER TABLE public.project_documents
ADD COLUMN IF NOT EXISTS file_url text,
ADD COLUMN IF NOT EXISTS file_format text DEFAULT 'markdown',
ADD COLUMN IF NOT EXISTS is_client_facing boolean DEFAULT false;

-- Create storage bucket for project documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-documents', 'project-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can upload
CREATE POLICY "Authenticated users can upload project documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-documents');

-- Authenticated users can read their project documents
CREATE POLICY "Authenticated users can read project documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'project-documents');

-- Authenticated users can update their project documents
CREATE POLICY "Authenticated users can update project documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'project-documents');
