-- Create content bank table for favorite reflections
CREATE TABLE public.content_bank (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  phrase_text TEXT NOT NULL,
  reflection TEXT NOT NULL,
  category TEXT,
  cta TEXT,
  image_url TEXT,
  tags TEXT[],
  notes TEXT,
  times_used INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.content_bank ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own content bank"
ON public.content_bank
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own content"
ON public.content_bank
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own content"
ON public.content_bank
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own content"
ON public.content_bank
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_content_bank_updated_at
BEFORE UPDATE ON public.content_bank
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();