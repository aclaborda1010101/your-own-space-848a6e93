ALTER TABLE plaud_transcriptions 
  ADD COLUMN IF NOT EXISTS family_sub_type text,
  ADD COLUMN IF NOT EXISTS linked_contact_ids uuid[],
  ADD COLUMN IF NOT EXISTS linked_project_id uuid;