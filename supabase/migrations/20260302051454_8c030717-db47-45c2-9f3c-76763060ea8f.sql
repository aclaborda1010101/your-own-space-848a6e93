
-- bl_diagnostics: new columns for score drivers, confidence, priority, financial scenarios
ALTER TABLE bl_diagnostics ADD COLUMN IF NOT EXISTS score_drivers jsonb;
ALTER TABLE bl_diagnostics ADD COLUMN IF NOT EXISTS confidence_level text;
ALTER TABLE bl_diagnostics ADD COLUMN IF NOT EXISTS confidence_explanation text;
ALTER TABLE bl_diagnostics ADD COLUMN IF NOT EXISTS priority_recommendation text;
ALTER TABLE bl_diagnostics ADD COLUMN IF NOT EXISTS financial_scenarios jsonb;

-- bl_recommendations: new columns for dependencies, effort, time to value
ALTER TABLE bl_recommendations ADD COLUMN IF NOT EXISTS dependencies jsonb;
ALTER TABLE bl_recommendations ADD COLUMN IF NOT EXISTS unlocks text;
ALTER TABLE bl_recommendations ADD COLUMN IF NOT EXISTS skip_risk text;
ALTER TABLE bl_recommendations ADD COLUMN IF NOT EXISTS effort_level text;
ALTER TABLE bl_recommendations ADD COLUMN IF NOT EXISTS time_to_value text;

-- bl_roadmaps: new columns for priority recommendation and dependencies map
ALTER TABLE bl_roadmaps ADD COLUMN IF NOT EXISTS priority_recommendation text;
ALTER TABLE bl_roadmaps ADD COLUMN IF NOT EXISTS dependencies_map jsonb;
