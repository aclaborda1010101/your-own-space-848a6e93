
-- Table for tracking background import jobs
CREATE TABLE public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_type text NOT NULL DEFAULT 'whatsapp_backup',
  status text NOT NULL DEFAULT 'pending',
  file_path text,
  file_name text,
  total_chats int DEFAULT 0,
  processed_chats int DEFAULT 0,
  messages_stored int DEFAULT 0,
  messages_failed int DEFAULT 0,
  contacts_created int DEFAULT 0,
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own jobs"
  ON public.import_jobs FOR ALL
  USING (user_id = auth.uid());

-- Storage bucket for import files
INSERT INTO storage.buckets (id, name, public)
VALUES ('import-files', 'import-files', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for import-files bucket
CREATE POLICY "Users upload own import files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'import-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users read own import files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'import-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Service role full access import files"
  ON storage.objects FOR ALL
  USING (bucket_id = 'import-files')
  WITH CHECK (bucket_id = 'import-files');
