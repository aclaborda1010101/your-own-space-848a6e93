ALTER TABLE jarvis_whoop_data 
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS resting_hr integer,
  ADD COLUMN IF NOT EXISTS sleep_performance integer,
  ADD COLUMN IF NOT EXISTS data_date date;

ALTER TABLE jarvis_whoop_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own whoop data" ON jarvis_whoop_data
  FOR SELECT USING (auth.uid() = user_id);