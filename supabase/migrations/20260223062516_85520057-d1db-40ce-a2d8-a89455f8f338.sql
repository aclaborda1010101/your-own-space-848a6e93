
-- Create suggested_responses table for AI-generated response drafts
CREATE TABLE public.suggested_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  contact_id UUID REFERENCES public.people_contacts(id) ON DELETE CASCADE,
  original_message_id UUID REFERENCES public.contact_messages(id) ON DELETE SET NULL,
  suggestion_1 TEXT,
  suggestion_2 TEXT,
  suggestion_3 TEXT,
  context_summary TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.suggested_responses ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own suggested responses"
ON public.suggested_responses FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own suggested responses"
ON public.suggested_responses FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own suggested responses"
ON public.suggested_responses FOR DELETE
USING (auth.uid() = user_id);

-- Service role insert policy (edge functions insert with service role)
CREATE POLICY "Service role can insert suggested responses"
ON public.suggested_responses FOR INSERT
WITH CHECK (true);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.suggested_responses;

-- Index for fast lookups
CREATE INDEX idx_suggested_responses_contact_status
ON public.suggested_responses (contact_id, status);
