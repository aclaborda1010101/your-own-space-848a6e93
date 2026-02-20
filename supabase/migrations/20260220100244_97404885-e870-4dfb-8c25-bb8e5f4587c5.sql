DELETE FROM contact_messages;
UPDATE people_contacts SET wa_message_count = 0 WHERE wa_message_count > 0;