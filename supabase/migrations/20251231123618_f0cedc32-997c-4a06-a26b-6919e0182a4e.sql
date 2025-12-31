-- Create publications table for JARVIS Publicaciones
CREATE TABLE public.daily_publications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  phrases JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of 5 phrases by category
  selected_phrase JSONB, -- The phrase user selected to publish
  copy_short TEXT, -- Short copy version
  copy_long TEXT, -- Long copy version
  hashtags TEXT[], -- Array of hashtags
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  platform TEXT, -- instagram, linkedin, twitter
  engagement JSONB, -- { likes, comments, shares }
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date) -- One publication set per day
);

-- Enable Row Level Security
ALTER TABLE public.daily_publications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own publications" 
ON public.daily_publications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own publications" 
ON public.daily_publications FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own publications" 
ON public.daily_publications FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own publications" 
ON public.daily_publications FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_daily_publications_updated_at
BEFORE UPDATE ON public.daily_publications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index
CREATE INDEX idx_daily_publications_user_date ON public.daily_publications(user_id, date DESC);