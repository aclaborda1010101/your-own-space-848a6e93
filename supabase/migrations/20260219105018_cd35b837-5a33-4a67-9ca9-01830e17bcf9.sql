
-- Merge 7 pairs of contacts that differ only by extra spaces
-- For each pair: reassign messages, sum wa_message_count, normalize name, delete loser

DO $$
DECLARE
  pair RECORD;
  winner_id uuid;
  loser_id uuid;
  winner_count int;
  loser_count int;
BEGIN
  FOR pair IN
    SELECT 
      TRIM(REGEXP_REPLACE(name, '\s+', ' ', 'g')) AS normalized_name
    FROM people_contacts
    GROUP BY TRIM(REGEXP_REPLACE(name, '\s+', ' ', 'g'))
    HAVING COUNT(*) > 1
  LOOP
    -- Pick winner = most messages
    SELECT id, COALESCE(wa_message_count, 0) INTO winner_id, winner_count
    FROM people_contacts
    WHERE TRIM(REGEXP_REPLACE(name, '\s+', ' ', 'g')) = pair.normalized_name
    ORDER BY COALESCE(wa_message_count, 0) DESC, created_at ASC
    LIMIT 1;

    -- Process all losers
    FOR loser_id, loser_count IN
      SELECT id, COALESCE(wa_message_count, 0)
      FROM people_contacts
      WHERE TRIM(REGEXP_REPLACE(name, '\s+', ' ', 'g')) = pair.normalized_name
        AND id != winner_id
    LOOP
      -- Reassign contact_messages
      UPDATE contact_messages SET contact_id = winner_id WHERE contact_id = loser_id;
      -- Reassign follow_ups
      UPDATE follow_ups SET related_person_id = winner_id WHERE related_person_id = loser_id;
      -- Sum counts
      UPDATE people_contacts SET wa_message_count = COALESCE(wa_message_count, 0) + loser_count WHERE id = winner_id;
      -- Delete loser
      DELETE FROM people_contacts WHERE id = loser_id;
    END LOOP;

    -- Normalize winner name
    UPDATE people_contacts SET name = pair.normalized_name WHERE id = winner_id;
  END LOOP;
END $$;
