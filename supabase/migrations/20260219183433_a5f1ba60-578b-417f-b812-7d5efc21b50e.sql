
-- Step 1: Fix the unique constraint for upsert compatibility
DROP INDEX IF EXISTS idx_jarvis_emails_cache_unique_msg;

-- Set message_id to a fallback for existing NULLs
UPDATE jarvis_emails_cache SET message_id = id::text WHERE message_id IS NULL;

-- Make message_id NOT NULL going forward
ALTER TABLE jarvis_emails_cache ALTER COLUMN message_id SET NOT NULL;

-- Add a proper unique constraint (not partial index)
ALTER TABLE jarvis_emails_cache
  ADD CONSTRAINT uq_jarvis_emails_cache_msg UNIQUE (user_id, account, message_id);
