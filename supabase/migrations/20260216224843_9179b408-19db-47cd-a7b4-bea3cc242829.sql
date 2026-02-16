-- Add sentiment column to transcriptions
ALTER TABLE public.transcriptions ADD COLUMN IF NOT EXISTS sentiment text;

-- Add comment for clarity
COMMENT ON COLUMN public.transcriptions.sentiment IS 'Overall sentiment: positive, neutral, negative, mixed';