-- Purge junk contacts: message fragments, spaced-letter names, code snippets, emails-as-names
-- Only delete contacts with wa_message_count = 0 (no real interactions)
DELETE FROM people_contacts
WHERE wa_message_count = 0
  AND (
    -- All-lowercase names longer than 20 chars = sentence fragments
    (lower(name) = name AND length(name) > 20)
    -- Names longer than 50 chars = definitely not a person
    OR length(name) > 50
    -- Names ending with commas pattern (WhatsApp parse errors)
    OR name LIKE '%,,,%'
    -- Email addresses stored as names
    OR name ~ '^[^@]+@[^@]+\.[^@]+$'
    -- Code/script fragments
    OR name LIKE '%push(%' OR name LIKE '%gtm.%'
    -- Sentence fragments with periods at end
    OR (name ~ '\.\s*$' AND length(name) > 15 AND lower(name) = name)
    -- Spaced-out letters pattern like "K I K E ."
    OR name ~ '^[A-Za-z] [A-Za-z] [A-Za-z]'
    -- Names starting with lowercase containing spaces (sentence fragments)
    OR (name ~ '^[a-záéíóú]' AND length(name) > 25 AND name ~ '\s' AND name !~ '[A-Z]')
    -- Multiple consecutive punctuation
    OR name ~ '[\.\!]{3,}'
  );
