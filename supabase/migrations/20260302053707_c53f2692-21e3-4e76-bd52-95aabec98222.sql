
-- Fix security definer views by recreating with security_invoker = true
CREATE OR REPLACE VIEW public.bl_calibration_metrics
WITH (security_invoker = true)
AS
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

CREATE OR REPLACE VIEW public.bl_score_distribution
WITH (security_invoker = true)
AS
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
