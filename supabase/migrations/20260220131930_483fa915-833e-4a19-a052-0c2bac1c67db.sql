-- Delete contacts whose name has no letters (phone numbers, emojis, symbols)
DELETE FROM public.people_contacts
WHERE name !~ '[a-zA-ZáéíóúÁÉÍÓÚñÑàèìòùüäëïöüçÀÈÌÒÙÜÄËÏÖÇ]';
