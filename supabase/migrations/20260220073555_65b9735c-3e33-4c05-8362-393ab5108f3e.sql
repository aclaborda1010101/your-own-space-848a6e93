UPDATE people_contacts pc
SET wa_message_count = sub.msg_count
FROM (
  SELECT contact_id, COUNT(*) as msg_count
  FROM contact_messages
  WHERE contact_id IS NOT NULL
  GROUP BY contact_id
) sub
WHERE pc.id = sub.contact_id;