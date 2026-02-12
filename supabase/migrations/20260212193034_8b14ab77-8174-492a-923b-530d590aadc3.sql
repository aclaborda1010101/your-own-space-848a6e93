
-- Transcripciones (Plaud, manual, email)
CREATE TABLE public.transcriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('plaud', 'manual', 'email', 'whatsapp', 'telegram')),
  raw_text TEXT NOT NULL,
  brain TEXT CHECK (brain IN ('professional', 'personal', 'bosco')),
  title TEXT,
  summary TEXT,
  entities_json JSONB,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own transcriptions" ON public.transcriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_transcriptions_user_date ON public.transcriptions(user_id, created_at DESC);
CREATE INDEX idx_transcriptions_brain ON public.transcriptions(brain);

-- Contactos / CRM personal
CREATE TABLE public.people_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  relationship TEXT,
  brain TEXT CHECK (brain IN ('professional', 'personal', 'bosco')),
  context TEXT,
  last_contact TIMESTAMPTZ,
  interaction_count INT NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.people_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own contacts" ON public.people_contacts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_people_contacts_user ON public.people_contacts(user_id);

-- Follow-ups / temas abiertos
CREATE TABLE public.follow_ups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  topic TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'expired')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_mention TIMESTAMPTZ,
  related_person_id UUID REFERENCES public.people_contacts(id) ON DELETE SET NULL,
  resolve_by TIMESTAMPTZ,
  source_transcription_id UUID REFERENCES public.transcriptions(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own follow_ups" ON public.follow_ups
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_follow_ups_user_status ON public.follow_ups(user_id, status);

-- Compromisos detectados
CREATE TABLE public.commitments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  description TEXT NOT NULL,
  commitment_type TEXT NOT NULL DEFAULT 'own' CHECK (commitment_type IN ('own', 'third_party')),
  person_name TEXT,
  deadline TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'expired')),
  source_transcription_id UUID REFERENCES public.transcriptions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own commitments" ON public.commitments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_commitments_user_status ON public.commitments(user_id, status);
