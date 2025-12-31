-- Add font_size and language columns to user_settings
ALTER TABLE public.user_settings 
ADD COLUMN font_size TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN language TEXT NOT NULL DEFAULT 'es';