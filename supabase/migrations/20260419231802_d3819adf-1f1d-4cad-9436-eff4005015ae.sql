-- Reconciliar wa_message_count y last_contact desde contact_messages
WITH stats AS (
  SELECT 
    contact_id,
    COUNT(*) as msg_count,
    MAX(message_date) as ultimo
  FROM contact_messages
  WHERE contact_id IS NOT NULL
    AND source IN ('whatsapp', 'whatsapp_backup')
  GROUP BY contact_id
)
UPDATE people_contacts pc
SET 
  wa_message_count = stats.msg_count,
  last_contact = GREATEST(COALESCE(pc.last_contact, stats.ultimo), stats.ultimo)
FROM stats
WHERE pc.id = stats.contact_id
  AND (pc.wa_message_count IS DISTINCT FROM stats.msg_count
       OR pc.last_contact IS NULL
       OR pc.last_contact < stats.ultimo);