-- Create favorites table for AI news
CREATE TABLE public.ai_news_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  news_id UUID NOT NULL REFERENCES public.ai_news(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, news_id)
);

-- Enable RLS
ALTER TABLE public.ai_news_favorites ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own favorites" 
ON public.ai_news_favorites 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own favorites" 
ON public.ai_news_favorites 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites" 
ON public.ai_news_favorites 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create daily summaries table
CREATE TABLE public.ai_daily_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  summary TEXT NOT NULL,
  key_insights JSONB DEFAULT '[]'::jsonb,
  top_news_ids UUID[] DEFAULT '{}',
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.ai_daily_summaries ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own summaries" 
ON public.ai_daily_summaries 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own summaries" 
ON public.ai_daily_summaries 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own summaries" 
ON public.ai_daily_summaries 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create notification preferences for video alerts
CREATE TABLE public.ai_video_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  creator_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_notified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, creator_name)
);

-- Enable RLS
ALTER TABLE public.ai_video_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own video alerts" 
ON public.ai_video_alerts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own video alerts" 
ON public.ai_video_alerts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own video alerts" 
ON public.ai_video_alerts 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own video alerts" 
ON public.ai_video_alerts 
FOR DELETE 
USING (auth.uid() = user_id);