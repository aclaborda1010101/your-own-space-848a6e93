-- Create table for Pomodoro sessions
CREATE TABLE public.pomodoro_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  task_title TEXT,
  duration INTEGER NOT NULL DEFAULT 25,
  type TEXT NOT NULL DEFAULT 'work',
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pomodoro_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own pomodoro sessions"
ON public.pomodoro_sessions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own pomodoro sessions"
ON public.pomodoro_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pomodoro sessions"
ON public.pomodoro_sessions
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for efficient querying
CREATE INDEX idx_pomodoro_sessions_user_completed ON public.pomodoro_sessions(user_id, completed_at DESC);