-- Academy progress tracking for AI Course, Coach, and English
-- This will store progress for skills, lessons, projects and sessions

-- AI Course Skills Progress
CREATE TABLE public.ai_course_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  skill_id TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  status TEXT DEFAULT 'in_progress',
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, skill_id)
);

-- AI Course Lessons Progress
CREATE TABLE public.ai_course_lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lesson_id INTEGER NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- AI Course Projects Progress
CREATE TABLE public.ai_course_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  status TEXT DEFAULT 'planned',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id)
);

-- Coach Stats (scoreboard, habits, KPIs)
CREATE TABLE public.coach_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  streak_days INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  total_insights INTEGER DEFAULT 0,
  goal_90_days TEXT,
  goal_progress INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Coach Habits
CREATE TABLE public.coach_habits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  streak INTEGER DEFAULT 0,
  target INTEGER DEFAULT 30,
  last_completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Coach KPIs
CREATE TABLE public.coach_kpis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  value NUMERIC DEFAULT 0,
  target NUMERIC NOT NULL,
  unit TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, category, name)
);

-- English Academy Stats
CREATE TABLE public.english_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  streak_days INTEGER DEFAULT 0,
  total_chunks_learned INTEGER DEFAULT 0,
  total_practice_minutes INTEGER DEFAULT 0,
  shadowing_sessions INTEGER DEFAULT 0,
  roleplay_sessions INTEGER DEFAULT 0,
  mini_tests_completed INTEGER DEFAULT 0,
  bosco_games_played INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- English Chunks (learned phrases)
CREATE TABLE public.english_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  phrase_en TEXT NOT NULL,
  phrase_es TEXT NOT NULL,
  category TEXT,
  mastered BOOLEAN DEFAULT false,
  times_practiced INTEGER DEFAULT 0,
  last_practiced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_course_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_course_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.english_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.english_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for all tables
CREATE POLICY "Users can view their own ai_course_skills" ON public.ai_course_skills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own ai_course_skills" ON public.ai_course_skills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own ai_course_skills" ON public.ai_course_skills FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own ai_course_lessons" ON public.ai_course_lessons FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own ai_course_lessons" ON public.ai_course_lessons FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own ai_course_lessons" ON public.ai_course_lessons FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own ai_course_projects" ON public.ai_course_projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own ai_course_projects" ON public.ai_course_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own ai_course_projects" ON public.ai_course_projects FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own coach_stats" ON public.coach_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own coach_stats" ON public.coach_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own coach_stats" ON public.coach_stats FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own coach_habits" ON public.coach_habits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own coach_habits" ON public.coach_habits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own coach_habits" ON public.coach_habits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own coach_habits" ON public.coach_habits FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own coach_kpis" ON public.coach_kpis FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own coach_kpis" ON public.coach_kpis FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own coach_kpis" ON public.coach_kpis FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own coach_kpis" ON public.coach_kpis FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own english_stats" ON public.english_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own english_stats" ON public.english_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own english_stats" ON public.english_stats FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own english_chunks" ON public.english_chunks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own english_chunks" ON public.english_chunks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own english_chunks" ON public.english_chunks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own english_chunks" ON public.english_chunks FOR DELETE USING (auth.uid() = user_id);