
-- Add message_id column for deduplication
ALTER TABLE public.jarvis_emails_cache ADD COLUMN IF NOT EXISTS message_id text;

-- Create unique constraint on (user_id, account, message_id) to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_jarvis_emails_cache_unique_msg 
ON public.jarvis_emails_cache (user_id, account, message_id) 
WHERE message_id IS NOT NULL;
