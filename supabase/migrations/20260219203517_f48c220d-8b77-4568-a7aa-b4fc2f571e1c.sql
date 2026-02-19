
-- Fase 1: Ampliar jarvis_emails_cache con ~22 columnas nuevas para email intelligence

-- Contenido
ALTER TABLE public.jarvis_emails_cache ADD COLUMN IF NOT EXISTS to_addr text;
ALTER TABLE public.jarvis_emails_cache ADD COLUMN IF NOT EXISTS cc_addr text;
ALTER TABLE public.jarvis_emails_cache ADD COLUMN IF NOT EXISTS bcc_addr text;
ALTER TABLE public.jarvis_emails_cache ADD COLUMN IF NOT EXISTS body_text text;
ALTER TABLE public.jarvis_emails_cache ADD COLUMN IF NOT EXISTS body_html text;
ALTER TABLE public.jarvis_emails_cache ADD COLUMN IF NOT EXISTS reply_to_id text;
ALTER TABLE public.jarvis_emails_cache ADD COLUMN IF NOT EXISTS thread_id text;
ALTER TABLE public.jarvis_emails_cache ADD COLUMN IF NOT EXISTS direction text;
ALTER TABLE public.jarvis_emails_cache ADD COLUMN IF NOT EXISTS received_at timestamptz;

-- Adjuntos
ALTER TABLE public.jarvis_emails_cache ADD COLUMN IF NOT EXISTS has_attachments boolean DEFAULT false;
ALTER TABLE public.jarvis_emails_cache ADD COLUMN IF NOT EXISTS attachments_meta jsonb;

-- Firma
ALTER TABLE public.jarvis_emails_cache ADD COLUMN IF NOT EXISTS signature_raw text;
ALTER TABLE public.jarvis_emails_cache ADD COLUMN IF NOT EXISTS signature_parsed jsonb;

-- Clasificacion (pre-IA)
ALTER TABLE public.jarvis_emails_cache ADD COLUMN IF NOT EXISTS email_type text;
ALTER TABLE public.jarvis_emails_cache ADD COLUMN IF NOT EXISTS importance text;
ALTER TABLE public.jarvis_emails_cache ADD COLUMN IF NOT EXISTS is_forwarded boolean DEFAULT false;
ALTER TABLE public.jarvis_emails_cache ADD COLUMN IF NOT EXISTS original_sender text;
ALTER TABLE public.jarvis_emails_cache ADD COLUMN IF NOT EXISTS is_auto_reply boolean DEFAULT false;
ALTER TABLE public.jarvis_emails_cache ADD COLUMN IF NOT EXISTS email_language text;

-- Analisis IA
ALTER TABLE public.jarvis_emails_cache ADD COLUMN IF NOT EXISTS ai_processed boolean DEFAULT false;
ALTER TABLE public.jarvis_emails_cache ADD COLUMN IF NOT EXISTS ai_extracted jsonb;

-- Indices
CREATE INDEX IF NOT EXISTS idx_emails_ai_unprocessed ON public.jarvis_emails_cache (user_id, ai_processed) WHERE ai_processed = false;
CREATE INDEX IF NOT EXISTS idx_emails_thread ON public.jarvis_emails_cache (thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_type ON public.jarvis_emails_cache (email_type);
