
-- Step 1: For each duplicated name, pick the contact with most messages as winner
-- Step 2: Reassign all contact_messages from duplicates to winner
-- Step 3: Sum wa_message_count to winner
-- Step 4: Delete duplicates

-- Create a temp table with winners (contact with most messages per normalized name)
CREATE TEMP TABLE dedup_winners AS
WITH ranked AS (
  SELECT 
    pc.id,
    pc.name,
    LOWER(TRIM(pc.name)) as normalized_name,
    pc.user_id,
    COALESCE(pc.wa_message_count, 0) as msg_count,
    COALESCE(msg_counts.real_count, 0) as real_msg_count,
    ROW_NUMBER() OVER (
      PARTITION BY pc.user_id, LOWER(TRIM(pc.name))
      ORDER BY COALESCE(msg_counts.real_count, 0) DESC, COALESCE(pc.wa_message_count, 0) DESC, pc.created_at ASC
    ) as rn
  FROM people_contacts pc
  LEFT JOIN (
    SELECT contact_id, COUNT(*) as real_count
    FROM contact_messages
    GROUP BY contact_id
  ) msg_counts ON msg_counts.contact_id = pc.id
)
SELECT 
  r.id as winner_id,
  r.normalized_name,
  r.user_id
FROM ranked r
WHERE r.rn = 1
  AND EXISTS (
    SELECT 1 FROM people_contacts pc2 
    WHERE LOWER(TRIM(pc2.name)) = r.normalized_name 
      AND pc2.user_id = r.user_id 
      AND pc2.id != r.id
  );

-- Reassign contact_messages from losers to winners
UPDATE contact_messages cm
SET contact_id = dw.winner_id
FROM dedup_winners dw
JOIN people_contacts pc ON LOWER(TRIM(pc.name)) = dw.normalized_name 
  AND pc.user_id = dw.user_id 
  AND pc.id != dw.winner_id
WHERE cm.contact_id = pc.id;

-- Reassign follow_ups from losers to winners
UPDATE follow_ups fu
SET related_person_id = dw.winner_id
FROM dedup_winners dw
JOIN people_contacts pc ON LOWER(TRIM(pc.name)) = dw.normalized_name 
  AND pc.user_id = dw.user_id 
  AND pc.id != dw.winner_id
WHERE fu.related_person_id = pc.id;

-- Update wa_message_count on winners (sum all duplicates)
UPDATE people_contacts pc_winner
SET wa_message_count = totals.total_count
FROM (
  SELECT 
    dw.winner_id,
    SUM(COALESCE(pc.wa_message_count, 0)) as total_count
  FROM dedup_winners dw
  JOIN people_contacts pc ON LOWER(TRIM(pc.name)) = dw.normalized_name 
    AND pc.user_id = dw.user_id
  GROUP BY dw.winner_id
) totals
WHERE pc_winner.id = totals.winner_id;

-- Delete duplicate contacts (losers)
DELETE FROM people_contacts pc
USING dedup_winners dw
WHERE LOWER(TRIM(pc.name)) = dw.normalized_name
  AND pc.user_id = dw.user_id
  AND pc.id != dw.winner_id;

-- Clean up
DROP TABLE dedup_winners;
