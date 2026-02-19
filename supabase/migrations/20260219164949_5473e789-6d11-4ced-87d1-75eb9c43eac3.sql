
-- Create contact_links table for linking second-level contacts to system contacts
CREATE TABLE public.contact_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_contact_id uuid NOT NULL REFERENCES public.people_contacts(id) ON DELETE CASCADE,
  target_contact_id uuid NOT NULL REFERENCES public.people_contacts(id) ON DELETE CASCADE,
  mentioned_name text NOT NULL,
  context text,
  first_mention_date text,
  status text NOT NULL DEFAULT 'linked' CHECK (status IN ('linked', 'ignored', 'pending')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_links ENABLE ROW LEVEL SECURITY;

-- RLS policies: only owner can CRUD
CREATE POLICY "Users can view their own contact links"
  ON public.contact_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own contact links"
  ON public.contact_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contact links"
  ON public.contact_links FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contact links"
  ON public.contact_links FOR DELETE
  USING (auth.uid() = user_id);

-- Index for efficient lookups
CREATE INDEX idx_contact_links_source ON public.contact_links(source_contact_id);
CREATE INDEX idx_contact_links_target ON public.contact_links(target_contact_id);
CREATE INDEX idx_contact_links_user ON public.contact_links(user_id);
