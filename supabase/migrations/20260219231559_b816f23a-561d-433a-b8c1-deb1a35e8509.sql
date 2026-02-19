
-- =============================================
-- ONBOARDING WIZARD: Phase 1 - Database Schema
-- =============================================

-- 1. contact_aliases
CREATE TABLE public.contact_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid NOT NULL REFERENCES public.people_contacts(id) ON DELETE CASCADE,
  alias text NOT NULL,
  source text NOT NULL,
  confidence numeric DEFAULT 1.0,
  context text,
  is_dismissed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, contact_id, alias)
);

ALTER TABLE public.contact_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own aliases" ON public.contact_aliases
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. contact_link_suggestions
CREATE TABLE public.contact_link_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mentioned_name text NOT NULL,
  mentioned_in_source text NOT NULL,
  mentioned_in_id text,
  mentioned_by uuid REFERENCES public.people_contacts(id) ON DELETE SET NULL,
  suggested_contact uuid REFERENCES public.people_contacts(id) ON DELETE CASCADE,
  confidence numeric DEFAULT 0.5,
  confidence_reasons jsonb,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.contact_link_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own suggestions" ON public.contact_link_suggestions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. contact_relationships
CREATE TABLE public.contact_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_a_id uuid NOT NULL REFERENCES public.people_contacts(id) ON DELETE CASCADE,
  contact_b_id uuid NOT NULL REFERENCES public.people_contacts(id) ON DELETE CASCADE,
  relationship_type text,
  context text,
  source text,
  first_detected timestamptz DEFAULT now(),
  mention_count int DEFAULT 1,
  UNIQUE(user_id, contact_a_id, contact_b_id)
);

ALTER TABLE public.contact_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own relationships" ON public.contact_relationships
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Add onboarding_completed to user_settings
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

-- 5. Add vcard_raw to people_contacts
ALTER TABLE public.people_contacts ADD COLUMN IF NOT EXISTS vcard_raw jsonb;
