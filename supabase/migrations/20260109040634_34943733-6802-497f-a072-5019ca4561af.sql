-- Crear bucket para imágenes de fondo personalizadas
INSERT INTO storage.buckets (id, name, public)
VALUES ('content-backgrounds', 'content-backgrounds', true);

-- Políticas RLS para que cada usuario gestione sus propias imágenes
CREATE POLICY "Users can upload own backgrounds"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'content-backgrounds' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own backgrounds"
ON storage.objects FOR SELECT
USING (bucket_id = 'content-backgrounds' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own backgrounds"
ON storage.objects FOR DELETE
USING (bucket_id = 'content-backgrounds' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Política pública para ver imágenes (necesaria para que el edge function pueda acceder)
CREATE POLICY "Public can view backgrounds"
ON storage.objects FOR SELECT
USING (bucket_id = 'content-backgrounds');