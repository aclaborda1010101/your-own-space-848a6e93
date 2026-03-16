
-- Clean duplicate rows for same (user_id, data_date) keeping the one with most data
DELETE FROM whoop_data a
USING whoop_data b
WHERE a.user_id = b.user_id
  AND a.data_date = b.data_date
  AND a.id < b.id;

-- Clean rows with ALL null metrics
DELETE FROM whoop_data
WHERE recovery_score IS NULL
  AND hrv IS NULL
  AND strain IS NULL
  AND sleep_hours IS NULL
  AND resting_hr IS NULL
  AND calories IS NULL
  AND avg_hr IS NULL
  AND max_hr IS NULL;

-- Add UNIQUE constraint
ALTER TABLE whoop_data
ADD CONSTRAINT whoop_data_user_date_unique UNIQUE (user_id, data_date);
