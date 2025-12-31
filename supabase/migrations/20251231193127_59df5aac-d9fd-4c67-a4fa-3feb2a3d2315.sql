-- Create table for nutrition preferences
CREATE TABLE public.nutrition_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  diet_type TEXT DEFAULT 'balanced',
  restrictions TEXT[] DEFAULT '{}',
  allergies TEXT[] DEFAULT '{}',
  goals TEXT DEFAULT 'maintain',
  calories_target INTEGER DEFAULT 2000,
  proteins_target INTEGER DEFAULT 100,
  carbs_target INTEGER DEFAULT 250,
  fats_target INTEGER DEFAULT 70,
  meal_count INTEGER DEFAULT 3,
  preferences_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_nutrition_preferences UNIQUE (user_id)
);

-- Create table for daily observations from StartDay
CREATE TABLE public.daily_observations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  whoops_summary TEXT,
  observations TEXT,
  selected_lunch TEXT,
  selected_dinner TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_daily_observations UNIQUE (user_id, date)
);

-- Create table for nutrition chat messages
CREATE TABLE public.nutrition_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nutrition_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for nutrition_preferences
CREATE POLICY "Users can view their own nutrition preferences" 
ON public.nutrition_preferences FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own nutrition preferences" 
ON public.nutrition_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own nutrition preferences" 
ON public.nutrition_preferences FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for daily_observations
CREATE POLICY "Users can view their own daily observations" 
ON public.daily_observations FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own daily observations" 
ON public.daily_observations FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily observations" 
ON public.daily_observations FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for nutrition_chat_messages
CREATE POLICY "Users can view their own nutrition chat messages" 
ON public.nutrition_chat_messages FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own nutrition chat messages" 
ON public.nutrition_chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own nutrition chat messages" 
ON public.nutrition_chat_messages FOR DELETE USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_nutrition_preferences_updated_at
BEFORE UPDATE ON public.nutrition_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_daily_observations_updated_at
BEFORE UPDATE ON public.daily_observations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();