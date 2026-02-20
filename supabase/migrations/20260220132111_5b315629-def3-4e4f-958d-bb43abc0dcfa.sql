-- Reset all wa_message_count to 0 since contact_messages is empty
UPDATE public.people_contacts SET wa_message_count = 0 WHERE wa_message_count > 0;