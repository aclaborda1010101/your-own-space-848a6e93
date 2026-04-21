-- Archive Agustito Group WhatsApp messages so they stop appearing in personal pending/feed.
-- Reversible: just UPDATE source back to 'whatsapp'.
UPDATE public.contact_messages
SET source = 'whatsapp_agustito'
WHERE source = 'whatsapp'
  AND user_id = 'f103da90-81d4-43a2-ad34-b33db8b9c369';

-- Clear the instance owner so no new Agustito messages get attributed to this user
DELETE FROM public.whatsapp_instance_owners
WHERE instance_name = 'jarvis-whatsapp';