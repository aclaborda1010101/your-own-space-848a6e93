
-- Ground truth labels table
CREATE TABLE public.bl_diagnostics_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id uuid REFERENCES public.bl_diagnostics(id) ON DELETE CASCADE NOT NULL,
  digital_maturity_label text CHECK (digital_maturity_label IN ('baja','media','alta')),
  ai_opportunity_label text CHECK (ai_opportunity_label IN ('baja','media','alta')),
  automation_level_label text CHECK (automation_level_label IN ('baja','media','alta')),
  data_readiness_label text CHECK (data_readiness_label IN ('baja','media','alta')),
  recommendation_correct boolean,
  notes text,
  labeled_by uuid DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now()
);

-- Unique constraint: one label per diagnostic
CREATE UNIQUE INDEX idx_bl_diagnostics_labels_diagnostic ON public.bl_diagnostics_labels(diagnostic_id);

-- Enable RLS
ALTER TABLE public.bl_diagnostics_labels ENABLE ROW LEVEL SECURITY;

-- RLS: users who own the audit can manage labels
CREATE POLICY "Users can view labels for their audits"
ON public.bl_diagnostics_labels FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bl_diagnostics d
    JOIN public.bl_audits a ON a.id = d.audit_id
    WHERE d.id = diagnostic_id AND (a.user_id = auth.uid() OR public.has_shared_access(auth.uid(), 'bl_audit', a.id))
  )
);

CREATE POLICY "Users can insert labels for their audits"
ON public.bl_diagnostics_labels FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bl_diagnostics d
    JOIN public.bl_audits a ON a.id = d.audit_id
    WHERE d.id = diagnostic_id AND (a.user_id = auth.uid() OR public.has_shared_edit_access(auth.uid(), 'bl_audit', a.id))
  )
);

CREATE POLICY "Users can update labels for their audits"
ON public.bl_diagnostics_labels FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bl_diagnostics d
    JOIN public.bl_audits a ON a.id = d.audit_id
    WHERE d.id = diagnostic_id AND (a.user_id = auth.uid() OR public.has_shared_edit_access(auth.uid(), 'bl_audit', a.id))
  )
);

CREATE POLICY "Users can delete labels for their audits"
ON public.bl_diagnostics_labels FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bl_diagnostics d
    JOIN public.bl_audits a ON a.id = d.audit_id
    WHERE d.id = diagnostic_id AND (a.user_id = auth.uid() OR public.has_shared_edit_access(auth.uid(), 'bl_audit', a.id))
  )
);

-- View: calibration metrics
CREATE OR REPLACE VIEW public.bl_calibration_metrics AS
WITH base AS (
  SELECT
    d.id AS diagnostic_id,
    d.digital_maturity_score,
    d.automation_level,
    d.data_readiness,
    d.ai_opportunity_score,
    d.priority_recommendation,
    l.digital_maturity_label,
    l.ai_opportunity_label,
    l.automation_level_label,
    l.data_readiness_label,
    l.recommendation_correct,
    CASE l.digital_maturity_label WHEN 'baja' THEN 0 WHEN 'media' THEN 50 WHEN 'alta' THEN 100 END AS dm_label_num,
    CASE l.ai_opportunity_label WHEN 'baja' THEN 0 WHEN 'media' THEN 50 WHEN 'alta' THEN 100 END AS ao_label_num,
    CASE l.automation_level_label WHEN 'baja' THEN 0 WHEN 'media' THEN 50 WHEN 'alta' THEN 100 END AS al_label_num,
    CASE l.data_readiness_label WHEN 'baja' THEN 0 WHEN 'media' THEN 50 WHEN 'alta' THEN 100 END AS dr_label_num
  FROM public.bl_diagnostics d
  LEFT JOIN public.bl_diagnostics_labels l ON l.diagnostic_id = d.id
  WHERE d.audit_id IS NOT NULL
)
SELECT
  COUNT(*)::int AS total_audits,
  COUNT(digital_maturity_label)::int AS labeled_audits,
  CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(digital_maturity_label)::numeric / COUNT(*)::numeric * 100, 1) ELSE 0 END AS labeling_pct,
  ROUND(AVG(digital_maturity_score)::numeric, 1) AS avg_digital_maturity,
  ROUND(AVG(ai_opportunity_score)::numeric, 1) AS avg_ai_opportunity,
  ROUND(AVG(automation_level)::numeric, 1) AS avg_automation_level,
  ROUND(AVG(data_readiness)::numeric, 1) AS avg_data_readiness,
  ROUND(AVG(ABS(COALESCE(digital_maturity_score,0) - dm_label_num))::numeric, 1) AS error_digital_maturity,
  ROUND(AVG(ABS(COALESCE(ai_opportunity_score,0) - ao_label_num))::numeric, 1) AS error_ai_opportunity,
  ROUND(AVG(ABS(COALESCE(automation_level,0) - al_label_num))::numeric, 1) AS error_automation_level,
  ROUND(AVG(ABS(COALESCE(data_readiness,0) - dr_label_num))::numeric, 1) AS error_data_readiness,
  CASE WHEN COUNT(recommendation_correct) > 0 
    THEN ROUND(COUNT(*) FILTER (WHERE recommendation_correct = true)::numeric / COUNT(recommendation_correct)::numeric * 100, 1) 
    ELSE NULL END AS priority_correct_pct
FROM base;

-- View: score distribution by buckets
CREATE OR REPLACE VIEW public.bl_score_distribution AS
WITH buckets AS (
  SELECT
    d.id,
    d.ai_opportunity_score,
    d.digital_maturity_score,
    d.automation_level,
    d.data_readiness
  FROM public.bl_diagnostics d
  WHERE d.audit_id IS NOT NULL
)
SELECT
  'ai_opportunity' AS score_name,
  COUNT(*) FILTER (WHERE ai_opportunity_score BETWEEN 0 AND 24)::int AS bucket_0_24,
  COUNT(*) FILTER (WHERE ai_opportunity_score BETWEEN 25 AND 49)::int AS bucket_25_49,
  COUNT(*) FILTER (WHERE ai_opportunity_score BETWEEN 50 AND 74)::int AS bucket_50_74,
  COUNT(*) FILTER (WHERE ai_opportunity_score BETWEEN 75 AND 100)::int AS bucket_75_100
FROM buckets
UNION ALL
SELECT
  'digital_maturity',
  COUNT(*) FILTER (WHERE digital_maturity_score BETWEEN 0 AND 24)::int,
  COUNT(*) FILTER (WHERE digital_maturity_score BETWEEN 25 AND 49)::int,
  COUNT(*) FILTER (WHERE digital_maturity_score BETWEEN 50 AND 74)::int,
  COUNT(*) FILTER (WHERE digital_maturity_score BETWEEN 75 AND 100)::int
FROM buckets
UNION ALL
SELECT
  'automation_level',
  COUNT(*) FILTER (WHERE automation_level BETWEEN 0 AND 24)::int,
  COUNT(*) FILTER (WHERE automation_level BETWEEN 25 AND 49)::int,
  COUNT(*) FILTER (WHERE automation_level BETWEEN 50 AND 74)::int,
  COUNT(*) FILTER (WHERE automation_level BETWEEN 75 AND 100)::int
FROM buckets
UNION ALL
SELECT
  'data_readiness',
  COUNT(*) FILTER (WHERE data_readiness BETWEEN 0 AND 24)::int,
  COUNT(*) FILTER (WHERE data_readiness BETWEEN 25 AND 49)::int,
  COUNT(*) FILTER (WHERE data_readiness BETWEEN 50 AND 74)::int,
  COUNT(*) FILTER (WHERE data_readiness BETWEEN 75 AND 100)::int
FROM buckets;
