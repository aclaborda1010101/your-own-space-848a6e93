
-- Create table for Plaud transcriptions
CREATE TABLE public.plaud_transcriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_email_id text,
  recording_date timestamptz NOT NULL,
  title text,
  transcript_raw text,
  summary_structured text,
  participants jsonb,
  parsed_data jsonb,
  ai_processed boolean DEFAULT false,
  processing_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Index for efficient queries
CREATE INDEX idx_plaud_transcriptions_user_date ON public.plaud_transcriptions (user_id, recording_date DESC);

-- Enable RLS
ALTER TABLE public.plaud_transcriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own plaud transcriptions"
  ON public.plaud_transcriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own plaud transcriptions"
  ON public.plaud_transcriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own plaud transcriptions"
  ON public.plaud_transcriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own plaud transcriptions"
  ON public.plaud_transcriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Service role policy for edge functions (internal calls without JWT)
CREATE POLICY "Service role full access to plaud transcriptions"
  ON public.plaud_transcriptions FOR ALL
  USING (true)
  WITH CHECK (true);
