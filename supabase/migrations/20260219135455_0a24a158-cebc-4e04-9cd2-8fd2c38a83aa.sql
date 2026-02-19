-- Add categories text[] column to people_contacts
ALTER TABLE public.people_contacts 
ADD COLUMN IF NOT EXISTS categories text[] DEFAULT NULL;

-- Backfill categories from existing category field
UPDATE public.people_contacts 
SET categories = ARRAY[COALESCE(category, 'profesional')]
WHERE categories IS NULL;