-- Create table to store WHOOP tokens
CREATE TABLE public.whoop_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whoop_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own whoop tokens" 
ON public.whoop_tokens FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own whoop tokens" 
ON public.whoop_tokens FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own whoop tokens" 
ON public.whoop_tokens FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own whoop tokens" 
ON public.whoop_tokens FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_whoop_tokens_updated_at
BEFORE UPDATE ON public.whoop_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table to cache WHOOP data
CREATE TABLE public.whoop_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  recovery_score INTEGER,
  hrv INTEGER,
  strain NUMERIC(4,1),
  sleep_hours NUMERIC(4,2),
  resting_hr INTEGER,
  sleep_performance INTEGER,
  data_date DATE NOT NULL DEFAULT CURRENT_DATE,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whoop_data ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own whoop data" 
ON public.whoop_data FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own whoop data" 
ON public.whoop_data FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own whoop data" 
ON public.whoop_data FOR UPDATE 
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_whoop_data_updated_at
BEFORE UPDATE ON public.whoop_data
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();