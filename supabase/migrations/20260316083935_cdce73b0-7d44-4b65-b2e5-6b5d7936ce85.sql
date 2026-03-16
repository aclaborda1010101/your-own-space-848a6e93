-- Drop the single-column unique constraint that prevents multiple dates per user
ALTER TABLE public.whoop_data DROP CONSTRAINT IF EXISTS whoop_data_user_id_key;