
-- 1. Drop existing unique index on diagnostic_id alone, create composite
DROP INDEX IF EXISTS bl_diag_labels_unique;
DROP INDEX IF EXISTS bl_diagnostics_labels_diagnostic_id_key;

-- Remove any unique constraint on diagnostic_id alone
ALTER TABLE bl_diagnostics_labels DROP CONSTRAINT IF EXISTS bl_diagnostics_labels_diagnostic_id_key;

-- Create composite unique index
CREATE UNIQUE INDEX bl_diag_labels_unique ON bl_diagnostics_labels (diagnostic_id, labeled_by);

-- 2. Recreate bl_calibration_metrics view with percentile errors
DROP VIEW IF EXISTS bl_calibration_metrics;

CREATE OR REPLACE VIEW bl_calibration_metrics WITH (security_invoker = true) AS
WITH label_mapped AS (
  SELECT
    l.diagnostic_id,
    d.digital_maturity_score,
    d.ai_opportunity_score,
    d.automation_level,
    d.data_readiness,
    d.priority_recommendation,
    l.recommendation_correct,
    CASE l.digital_maturity_label WHEN 'baja' THEN 0 WHEN 'media' THEN 50 WHEN 'alta' THEN 100 END AS dm_label,
    CASE l.ai_opportunity_label   WHEN 'baja' THEN 0 WHEN 'media' THEN 50 WHEN 'alta' THEN 100 END AS ai_label,
    CASE l.automation_level_label WHEN 'baja' THEN 0 WHEN 'media' THEN 50 WHEN 'alta' THEN 100 END AS al_label,
    CASE l.data_readiness_label   WHEN 'baja' THEN 0 WHEN 'media' THEN 50 WHEN 'alta' THEN 100 END AS dr_label
  FROM bl_diagnostics_labels l
  JOIN bl_diagnostics d ON d.id = l.diagnostic_id
),
errors AS (
  SELECT
    ABS(digital_maturity_score - dm_label) AS err_dm,
    ABS(ai_opportunity_score - ai_label)   AS err_ai,
    ABS(automation_level - al_label)       AS err_al,
    ABS(data_readiness - dr_label)         AS err_dr
  FROM label_mapped
  WHERE dm_label IS NOT NULL OR ai_label IS NOT NULL OR al_label IS NOT NULL OR dr_label IS NOT NULL
)
SELECT
  (SELECT COUNT(*) FROM bl_diagnostics)::int AS total_audits,
  (SELECT COUNT(DISTINCT diagnostic_id) FROM bl_diagnostics_labels)::int AS labeled_audits,
  CASE WHEN (SELECT COUNT(*) FROM bl_diagnostics) > 0
    THEN ROUND((SELECT COUNT(DISTINCT diagnostic_id) FROM bl_diagnostics_labels)::numeric / (SELECT COUNT(*) FROM bl_diagnostics) * 100, 1)
    ELSE 0
  END AS labeling_pct,
  ROUND(AVG(digital_maturity_score)::numeric, 1) AS avg_digital_maturity,
  ROUND(AVG(ai_opportunity_score)::numeric, 1)   AS avg_ai_opportunity,
  ROUND(AVG(automation_level)::numeric, 1)        AS avg_automation_level,
  ROUND(AVG(data_readiness)::numeric, 1)          AS avg_data_readiness,
  (SELECT ROUND(AVG(err_dm)::numeric, 1) FROM errors WHERE err_dm IS NOT NULL) AS error_digital_maturity,
  (SELECT ROUND(AVG(err_ai)::numeric, 1) FROM errors WHERE err_ai IS NOT NULL) AS error_ai_opportunity,
  (SELECT ROUND(AVG(err_al)::numeric, 1) FROM errors WHERE err_al IS NOT NULL) AS error_automation_level,
  (SELECT ROUND(AVG(err_dr)::numeric, 1) FROM errors WHERE err_dr IS NOT NULL) AS error_data_readiness,
  -- P50 errors
  (SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY err_dm)::numeric, 1) FROM errors WHERE err_dm IS NOT NULL) AS p50_error_digital_maturity,
  (SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY err_ai)::numeric, 1) FROM errors WHERE err_ai IS NOT NULL) AS p50_error_ai_opportunity,
  (SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY err_al)::numeric, 1) FROM errors WHERE err_al IS NOT NULL) AS p50_error_automation_level,
  (SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY err_dr)::numeric, 1) FROM errors WHERE err_dr IS NOT NULL) AS p50_error_data_readiness,
  -- P90 errors
  (SELECT ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY err_dm)::numeric, 1) FROM errors WHERE err_dm IS NOT NULL) AS p90_error_digital_maturity,
  (SELECT ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY err_ai)::numeric, 1) FROM errors WHERE err_ai IS NOT NULL) AS p90_error_ai_opportunity,
  (SELECT ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY err_al)::numeric, 1) FROM errors WHERE err_al IS NOT NULL) AS p90_error_automation_level,
  (SELECT ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY err_dr)::numeric, 1) FROM errors WHERE err_dr IS NOT NULL) AS p90_error_data_readiness,
  -- Priority correct pct
  CASE WHEN (SELECT COUNT(*) FROM label_mapped WHERE recommendation_correct IS NOT NULL) > 0
    THEN ROUND(
      (SELECT COUNT(*) FROM label_mapped WHERE recommendation_correct = true)::numeric /
      (SELECT COUNT(*) FROM label_mapped WHERE recommendation_correct IS NOT NULL) * 100, 1)
    ELSE NULL
  END AS priority_correct_pct
FROM label_mapped;
