-- Add goal_type column to challenge_goals to distinguish between objetivo, proposito, prohibicion, excepcion
ALTER TABLE public.challenge_goals 
ADD COLUMN goal_type text NOT NULL DEFAULT 'objetivo';

-- Remove category from challenges since types are now on goals
ALTER TABLE public.challenges 
DROP COLUMN IF EXISTS category;