ALTER TABLE public.user_settings 
ADD COLUMN section_visibility JSONB NOT NULL DEFAULT '{
  "content": true,
  "bosco": true,
  "finances": true,
  "nutrition": true,
  "ai_news": true,
  "sports": true,
  "health": true,
  "communications": true,
  "academy": true
}'::jsonb;