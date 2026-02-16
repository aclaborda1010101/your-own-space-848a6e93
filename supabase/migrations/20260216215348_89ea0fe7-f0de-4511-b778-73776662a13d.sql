
-- Add ambient detection field to transcriptions
ALTER TABLE public.transcriptions ADD COLUMN IF NOT EXISTS is_ambient boolean DEFAULT false;

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_transcriptions_is_ambient ON public.transcriptions (is_ambient) WHERE is_ambient = true;
