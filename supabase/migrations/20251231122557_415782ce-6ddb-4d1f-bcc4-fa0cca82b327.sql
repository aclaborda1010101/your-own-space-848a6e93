-- Create coach_sessions table for JARVIS Coach memory
CREATE TABLE public.coach_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  session_type TEXT NOT NULL DEFAULT 'daily', -- daily, weekly, intervention
  protocol TEXT, -- anxiety, block, push, tired, crisis
  emotional_state JSONB, -- { energy, mood, stress, anxiety, motivation }
  topics JSONB, -- Array of topics discussed
  insights JSONB, -- AI-generated insights
  interventions JSONB, -- Actions taken during session
  messages JSONB NOT NULL DEFAULT '[]'::jsonb, -- Chat history
  summary TEXT, -- Session summary
  next_steps TEXT, -- Recommended next steps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.coach_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own coach sessions" 
ON public.coach_sessions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own coach sessions" 
ON public.coach_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own coach sessions" 
ON public.coach_sessions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own coach sessions" 
ON public.coach_sessions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_coach_sessions_updated_at
BEFORE UPDATE ON public.coach_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_coach_sessions_user_date ON public.coach_sessions(user_id, date DESC);
CREATE INDEX idx_coach_sessions_protocol ON public.coach_sessions(user_id, protocol);