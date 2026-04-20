-- Backfill last_contact desde contact_messages.message_date
-- para todos los contactos activos que tengan al menos un mensaje
UPDATE public.people_contacts pc
SET last_contact = sub.max_date
FROM (
  SELECT contact_id, MAX(message_date) AS max_date
  FROM public.contact_messages
  WHERE source IN ('whatsapp', 'whatsapp_backup')
  GROUP BY contact_id
) sub
WHERE pc.id = sub.contact_id
  AND (pc.last_contact IS NULL OR pc.last_contact < sub.max_date);