
-- Add new WHOOP metric columns to whoop_data
ALTER TABLE public.whoop_data
  ADD COLUMN IF NOT EXISTS spo2 numeric,
  ADD COLUMN IF NOT EXISTS skin_temp numeric,
  ADD COLUMN IF NOT EXISTS respiratory_rate numeric,
  ADD COLUMN IF NOT EXISTS calories numeric,
  ADD COLUMN IF NOT EXISTS avg_hr integer,
  ADD COLUMN IF NOT EXISTS max_hr integer,
  ADD COLUMN IF NOT EXISTS sleep_efficiency numeric,
  ADD COLUMN IF NOT EXISTS sleep_consistency numeric,
  ADD COLUMN IF NOT EXISTS sleep_latency_min numeric,
  ADD COLUMN IF NOT EXISTS sleep_need_hours numeric,
  ADD COLUMN IF NOT EXISTS deep_sleep_hours numeric,
  ADD COLUMN IF NOT EXISTS rem_sleep_hours numeric,
  ADD COLUMN IF NOT EXISTS light_sleep_hours numeric,
  ADD COLUMN IF NOT EXISTS awake_hours numeric,
  ADD COLUMN IF NOT EXISTS disturbances integer,
  ADD COLUMN IF NOT EXISTS time_in_bed_hours numeric,
  ADD COLUMN IF NOT EXISTS time_asleep_hours numeric,
  ADD COLUMN IF NOT EXISTS sleep_debt_hours numeric;
