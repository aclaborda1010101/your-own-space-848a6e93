
-- Sincronizar wa_message_count con el COUNT real de contact_messages (source='whatsapp')
UPDATE people_contacts pc
SET wa_message_count = sub.real_count
FROM (
  SELECT contact_id, COUNT(*)::int AS real_count
  FROM contact_messages
  WHERE source = 'whatsapp'
  GROUP BY contact_id
) sub
WHERE pc.id = sub.contact_id
  AND (pc.wa_message_count IS DISTINCT FROM sub.real_count);
