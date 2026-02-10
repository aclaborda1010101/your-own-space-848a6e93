
-- 1. Add platform column to potus_chat
ALTER TABLE public.potus_chat ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'web';

-- 2. Add telegram/whatsapp columns to user_integrations
ALTER TABLE public.user_integrations ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
ALTER TABLE public.user_integrations ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;

-- 3. Create platform_users table for identity mapping
CREATE TABLE public.platform_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  platform TEXT NOT NULL,
  platform_user_id TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(platform, platform_user_id)
);

-- 4. Create linking_codes table for account linking flow
CREATE TABLE public.linking_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  code TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Enable RLS
ALTER TABLE public.platform_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linking_codes ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies for platform_users
CREATE POLICY "Users can view their own platform mappings"
  ON public.platform_users FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own platform mappings"
  ON public.platform_users FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own platform mappings"
  ON public.platform_users FOR DELETE
  USING (auth.uid() = user_id);

-- Service role access for webhooks (they use service role key)
CREATE POLICY "Service role can manage platform_users"
  ON public.platform_users FOR ALL
  USING (auth.role() = 'service_role');

-- 7. RLS policies for linking_codes
CREATE POLICY "Users can view their own linking codes"
  ON public.linking_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create linking codes"
  ON public.linking_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage linking codes"
  ON public.linking_codes FOR ALL
  USING (auth.role() = 'service_role');

-- 8. Index for fast lookups
CREATE INDEX idx_platform_users_lookup ON public.platform_users(platform, platform_user_id);
CREATE INDEX idx_platform_users_user ON public.platform_users(user_id);
CREATE INDEX idx_linking_codes_code ON public.linking_codes(code) WHERE used_at IS NULL;
