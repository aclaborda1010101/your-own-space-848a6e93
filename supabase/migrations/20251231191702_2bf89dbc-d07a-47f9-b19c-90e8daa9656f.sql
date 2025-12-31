-- Create table for AI news
CREATE TABLE public.ai_news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  summary TEXT,
  source_url TEXT,
  source_name TEXT,
  category TEXT DEFAULT 'news',
  is_video BOOLEAN DEFAULT false,
  creator_name TEXT,
  relevance_score NUMERIC(3,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_news ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own AI news"
ON public.ai_news
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI news"
ON public.ai_news
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own AI news"
ON public.ai_news
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for efficient date queries
CREATE INDEX idx_ai_news_user_date ON public.ai_news(user_id, date DESC);