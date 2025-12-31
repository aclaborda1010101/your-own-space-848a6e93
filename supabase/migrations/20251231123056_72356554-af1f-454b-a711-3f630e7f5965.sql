-- Create challenges table for JARVIS Reto
CREATE TABLE public.challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  duration_days INTEGER NOT NULL DEFAULT 30, -- 30, 90, 180, 365
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active, completed, abandoned
  category TEXT DEFAULT 'personal', -- personal, health, work, learning
  motivation TEXT, -- Why this challenge
  reward TEXT, -- What happens on completion
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create challenge_goals table for objectives within a challenge
CREATE TABLE public.challenge_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL DEFAULT 'daily', -- daily, weekly, once
  target_count INTEGER DEFAULT 1, -- How many times per frequency
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create challenge_logs table for daily check-ins
CREATE TABLE public.challenge_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.challenge_goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  mood INTEGER, -- 1-5 rating for the day
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(goal_id, date) -- One log per goal per day
);

-- Enable Row Level Security
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_logs ENABLE ROW LEVEL SECURITY;

-- Challenges policies
CREATE POLICY "Users can view their own challenges" 
ON public.challenges FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own challenges" 
ON public.challenges FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own challenges" 
ON public.challenges FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own challenges" 
ON public.challenges FOR DELETE USING (auth.uid() = user_id);

-- Challenge goals policies
CREATE POLICY "Users can view their own challenge goals" 
ON public.challenge_goals FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own challenge goals" 
ON public.challenge_goals FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own challenge goals" 
ON public.challenge_goals FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own challenge goals" 
ON public.challenge_goals FOR DELETE USING (auth.uid() = user_id);

-- Challenge logs policies
CREATE POLICY "Users can view their own challenge logs" 
ON public.challenge_logs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own challenge logs" 
ON public.challenge_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own challenge logs" 
ON public.challenge_logs FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own challenge logs" 
ON public.challenge_logs FOR DELETE USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_challenges_updated_at
BEFORE UPDATE ON public.challenges
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_challenges_user_status ON public.challenges(user_id, status);
CREATE INDEX idx_challenge_goals_challenge ON public.challenge_goals(challenge_id);
CREATE INDEX idx_challenge_logs_challenge_date ON public.challenge_logs(challenge_id, date);
CREATE INDEX idx_challenge_logs_goal_date ON public.challenge_logs(goal_id, date);