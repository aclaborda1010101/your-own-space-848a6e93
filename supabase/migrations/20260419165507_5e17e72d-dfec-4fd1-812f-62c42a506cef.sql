ALTER TABLE public.contact_podcasts DROP CONSTRAINT IF EXISTS contact_podcasts_format_check;
ALTER TABLE public.contact_podcasts ADD CONSTRAINT contact_podcasts_format_check CHECK (format IN ('informative', 'narrator', 'dialogue'));

ALTER TABLE public.contact_podcast_segments DROP CONSTRAINT IF EXISTS contact_podcast_segments_format_check;
ALTER TABLE public.contact_podcast_segments ADD CONSTRAINT contact_podcast_segments_format_check CHECK (format IN ('informative', 'narrator', 'dialogue'));