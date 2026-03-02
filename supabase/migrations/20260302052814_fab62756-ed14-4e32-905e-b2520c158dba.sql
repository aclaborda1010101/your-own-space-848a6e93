ALTER TABLE bl_diagnostics 
  ALTER COLUMN score_drivers SET DEFAULT '{}'::jsonb,
  ALTER COLUMN financial_scenarios SET DEFAULT '{}'::jsonb;

ALTER TABLE bl_recommendations
  ALTER COLUMN dependencies SET DEFAULT '[]'::jsonb;

ALTER TABLE bl_roadmaps
  ALTER COLUMN dependencies_map SET DEFAULT '[]'::jsonb;