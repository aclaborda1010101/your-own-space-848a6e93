-- Purga completa de mensajes WhatsApp para reimportación individual
DELETE FROM contact_messages;
DELETE FROM contact_link_suggestions;
UPDATE people_contacts SET wa_message_count = 0 WHERE wa_message_count > 0;