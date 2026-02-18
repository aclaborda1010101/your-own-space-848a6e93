
-- First delete messages (child table)
DELETE FROM contact_messages;

-- Then delete contacts (parent table)
DELETE FROM people_contacts;
