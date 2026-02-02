-- Add iCloud Calendar fields to user_integrations
ALTER TABLE public.user_integrations 
ADD COLUMN IF NOT EXISTS icloud_email TEXT,
ADD COLUMN IF NOT EXISTS icloud_password_encrypted TEXT,
ADD COLUMN IF NOT EXISTS icloud_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS icloud_calendars JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS icloud_last_sync TIMESTAMP WITH TIME ZONE;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_integrations_icloud 
ON public.user_integrations (user_id) 
WHERE icloud_enabled = true;