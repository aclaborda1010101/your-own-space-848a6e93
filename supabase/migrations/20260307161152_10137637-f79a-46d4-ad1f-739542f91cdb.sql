
-- Table for individual public responses (one per respondent)
CREATE TABLE public.bl_public_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES public.bl_audits(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.bl_questionnaire_templates(id),
  respondent_name TEXT,
  respondent_email TEXT,
  respondent_company TEXT,
  responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bl_public_responses_audit ON public.bl_public_responses(audit_id);

ALTER TABLE public.bl_public_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit owner can read public responses"
  ON public.bl_public_responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bl_audits a
      WHERE a.id = bl_public_responses.audit_id
        AND (a.user_id = auth.uid() OR public.has_shared_access(auth.uid(), 'bl_audit', a.id))
    )
  );

CREATE POLICY "Audit owner can delete public responses"
  ON public.bl_public_responses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bl_audits a
      WHERE a.id = bl_public_responses.audit_id
        AND a.user_id = auth.uid()
    )
  );

-- Discovery categories
CREATE TYPE public.discovery_category AS ENUM ('need', 'competitor', 'research', 'client_feedback', 'opportunity', 'document');

CREATE TABLE public.business_project_discovery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.business_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category discovery_category NOT NULL DEFAULT 'need',
  content_text TEXT,
  source TEXT DEFAULT 'manual',
  attachment_path TEXT,
  attachment_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_discovery_project ON public.business_project_discovery(project_id);

ALTER TABLE public.business_project_discovery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner or shared can read discovery"
  ON public.business_project_discovery FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_shared_access_via_project(auth.uid(), project_id)
  );

CREATE POLICY "Owner or shared editor can insert discovery"
  ON public.business_project_discovery FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_shared_edit_via_project(auth.uid(), project_id)
  );

CREATE POLICY "Owner can update discovery"
  ON public.business_project_discovery FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owner can delete discovery"
  ON public.business_project_discovery FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
