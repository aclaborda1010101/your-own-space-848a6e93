
-- Bucket privado para adjuntos del chat JARVIS
INSERT INTO storage.buckets (id, name, public)
VALUES ('jarvis-attachments', 'jarvis-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas: cada usuario sólo accede a su propia carpeta /{user_id}/...
CREATE POLICY "Jarvis attachments — owner can read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'jarvis-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Jarvis attachments — owner can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'jarvis-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Jarvis attachments — owner can update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'jarvis-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Jarvis attachments — owner can delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'jarvis-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
