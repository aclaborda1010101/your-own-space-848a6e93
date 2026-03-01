
-- 1. Create bl_audits table
CREATE TABLE public.bl_audits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  project_id UUID REFERENCES public.business_projects(id) ON DELETE SET NULL,
  sector TEXT,
  business_size TEXT,
  business_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add audit_id to the 4 BL tables (nullable for gradual migration)
ALTER TABLE public.bl_questionnaire_responses ADD COLUMN audit_id UUID REFERENCES public.bl_audits(id) ON DELETE CASCADE;
ALTER TABLE public.bl_diagnostics ADD COLUMN audit_id UUID REFERENCES public.bl_audits(id) ON DELETE CASCADE;
ALTER TABLE public.bl_recommendations ADD COLUMN audit_id UUID REFERENCES public.bl_audits(id) ON DELETE CASCADE;
ALTER TABLE public.bl_roadmaps ADD COLUMN audit_id UUID REFERENCES public.bl_audits(id) ON DELETE CASCADE;

-- 3. Make project_id nullable in the 4 BL tables
ALTER TABLE public.bl_questionnaire_responses ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE public.bl_diagnostics ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE public.bl_recommendations ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE public.bl_roadmaps ALTER COLUMN project_id DROP NOT NULL;

-- 4. Drop the unique constraint on bl_diagnostics.project_id so multiple audits can exist
ALTER TABLE public.bl_diagnostics DROP CONSTRAINT IF EXISTS bl_diagnostics_project_id_key;

-- 5. Migrate existing data: create bl_audit per distinct project_id
INSERT INTO public.bl_audits (user_id, name, project_id, sector, business_size, business_type)
SELECT DISTINCT
  bp.user_id,
  'Auditoría - ' || bp.name,
  bp.id,
  bp.sector,
  bp.business_size,
  bp.business_type
FROM public.business_projects bp
WHERE EXISTS (SELECT 1 FROM public.bl_questionnaire_responses q WHERE q.project_id = bp.id)
   OR EXISTS (SELECT 1 FROM public.bl_diagnostics d WHERE d.project_id = bp.id)
   OR EXISTS (SELECT 1 FROM public.bl_recommendations r WHERE r.project_id = bp.id)
   OR EXISTS (SELECT 1 FROM public.bl_roadmaps rm WHERE rm.project_id = bp.id);

-- 6. Update audit_id in the 4 tables
UPDATE public.bl_questionnaire_responses qr
SET audit_id = a.id
FROM public.bl_audits a
WHERE a.project_id = qr.project_id AND qr.audit_id IS NULL;

UPDATE public.bl_diagnostics d
SET audit_id = a.id
FROM public.bl_audits a
WHERE a.project_id = d.project_id AND d.audit_id IS NULL;

UPDATE public.bl_recommendations r
SET audit_id = a.id
FROM public.bl_audits a
WHERE a.project_id = r.project_id AND r.audit_id IS NULL;

UPDATE public.bl_roadmaps rm
SET audit_id = a.id
FROM public.bl_audits a
WHERE a.project_id = rm.project_id AND rm.audit_id IS NULL;

-- 7. Add unique constraint on bl_diagnostics for audit_id
ALTER TABLE public.bl_diagnostics ADD CONSTRAINT bl_diagnostics_audit_id_key UNIQUE (audit_id);

-- 8. RLS on bl_audits
ALTER TABLE public.bl_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audits"
ON public.bl_audits FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own audits"
ON public.bl_audits FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own audits"
ON public.bl_audits FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own audits"
ON public.bl_audits FOR DELETE
USING (auth.uid() = user_id);
