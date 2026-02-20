-- Backfill last_contact from contact_messages
UPDATE people_contacts pc
SET last_contact = sub.last_msg
FROM (
  SELECT contact_id, MAX(message_date) as last_msg
  FROM contact_messages
  WHERE contact_id IS NOT NULL
  GROUP BY contact_id
) sub
WHERE pc.id = sub.contact_id
  AND sub.last_msg IS NOT NULL;