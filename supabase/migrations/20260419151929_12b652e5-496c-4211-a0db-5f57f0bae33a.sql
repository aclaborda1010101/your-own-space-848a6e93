-- Extensions for cron + http calls
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =========================================
-- contact_podcasts
-- =========================================
CREATE TABLE public.contact_podcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.people_contacts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','queued','generating','ready','error')),
  format text NOT NULL DEFAULT 'narrator' CHECK (format IN ('dialogue','narrator')),
  total_segments int NOT NULL DEFAULT 0,
  last_message_count int NOT NULL DEFAULT 0,
  last_generated_at timestamptz,
  total_duration_seconds int NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contact_id, user_id)
);

CREATE INDEX idx_contact_podcasts_user ON public.contact_podcasts(user_id);
CREATE INDEX idx_contact_podcasts_contact ON public.contact_podcasts(contact_id);

ALTER TABLE public.contact_podcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_contact_podcasts_select" ON public.contact_podcasts
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own_contact_podcasts_insert" ON public.contact_podcasts
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_contact_podcasts_update" ON public.contact_podcasts
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "own_contact_podcasts_delete" ON public.contact_podcasts
  FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER trg_contact_podcasts_updated_at
  BEFORE UPDATE ON public.contact_podcasts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- contact_podcast_segments
-- =========================================
CREATE TABLE public.contact_podcast_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  podcast_id uuid NOT NULL REFERENCES public.contact_podcasts(id) ON DELETE CASCADE,
  segment_number int NOT NULL,
  message_range_start int NOT NULL,
  message_range_end int NOT NULL,
  message_count int NOT NULL,
  format text NOT NULL,
  script text NOT NULL,
  audio_storage_path text NOT NULL,
  duration_seconds int NOT NULL DEFAULT 0,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (podcast_id, segment_number)
);

CREATE INDEX idx_segments_podcast ON public.contact_podcast_segments(podcast_id, segment_number);

ALTER TABLE public.contact_podcast_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_segments_select" ON public.contact_podcast_segments
  FOR SELECT USING (podcast_id IN (SELECT id FROM public.contact_podcasts WHERE user_id = auth.uid()));
CREATE POLICY "own_segments_insert" ON public.contact_podcast_segments
  FOR INSERT WITH CHECK (podcast_id IN (SELECT id FROM public.contact_podcasts WHERE user_id = auth.uid()));
CREATE POLICY "own_segments_update" ON public.contact_podcast_segments
  FOR UPDATE USING (podcast_id IN (SELECT id FROM public.contact_podcasts WHERE user_id = auth.uid()));
CREATE POLICY "own_segments_delete" ON public.contact_podcast_segments
  FOR DELETE USING (podcast_id IN (SELECT id FROM public.contact_podcasts WHERE user_id = auth.uid()));

-- =========================================
-- contact_headlines
-- =========================================
CREATE TABLE public.contact_headlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.people_contacts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  payload jsonb NOT NULL,
  message_count_at_generation int NOT NULL DEFAULT 0,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contact_id, user_id)
);

CREATE INDEX idx_contact_headlines_user ON public.contact_headlines(user_id);

ALTER TABLE public.contact_headlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_headlines_select" ON public.contact_headlines
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own_headlines_insert" ON public.contact_headlines
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_headlines_update" ON public.contact_headlines
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "own_headlines_delete" ON public.contact_headlines
  FOR DELETE USING (user_id = auth.uid());

-- =========================================
-- podcast_generation_queue
-- =========================================
CREATE TABLE public.podcast_generation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.people_contacts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  format text NOT NULL DEFAULT 'narrator' CHECK (format IN ('dialogue','narrator')),
  force_full_regenerate boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','error')),
  attempts int NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX idx_queue_status ON public.podcast_generation_queue(status, created_at);
CREATE INDEX idx_queue_user ON public.podcast_generation_queue(user_id);

ALTER TABLE public.podcast_generation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_queue_select" ON public.podcast_generation_queue
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own_queue_insert" ON public.podcast_generation_queue
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- =========================================
-- Storage bucket: contact-podcasts (private)
-- =========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('contact-podcasts', 'contact-podcasts', false)
ON CONFLICT (id) DO NOTHING;

-- Each user can only access files under their own folder {userId}/...
CREATE POLICY "users_select_own_podcast_files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'contact-podcasts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "users_insert_own_podcast_files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'contact-podcasts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "users_update_own_podcast_files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'contact-podcasts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "users_delete_own_podcast_files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'contact-podcasts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- =========================================
-- Cron job: process podcast queue every minute
-- =========================================
SELECT cron.schedule(
  'process-podcast-queue-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/process-podcast-queue',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmamx3eHNzeGZ2aGJpeXRjb2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDI4MDUsImV4cCI6MjA4NTIxODgwNX0.EgH-i0SBnlWH3lF4ZgZ3b8SRdBZc5fZruWmyaIu9GIQ"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  );
  $$
);