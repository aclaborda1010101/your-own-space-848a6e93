-- Broader cleanup: delete contacts with junk names
-- 1. Names with fewer than 2 basic Latin letters (catches emoji-only, symbol-only, unicode-art names)
-- 2. Names that are HTML/script injection
-- 3. Names that are clearly not person names (measurements, numeric expressions)
DELETE FROM public.people_contacts
WHERE 
  -- fewer than 2 basic latin letters (a-z with accents)
  length(regexp_replace(name, '[^a-zA-ZáéíóúÁÉÍÓÚñÑàèìòùüäëïöüçÀÈÌÒÙÜÄËÏÖÜÇ]', '', 'g')) < 2
  -- OR HTML/script tags
  OR name ~* '<\/?script'
  -- OR starts with & (VCF encoding artifact)
  OR name ~ '^&'
  -- OR invisible unicode characters as prefix with common words
  OR regexp_replace(name, '[^\x20-\x7E]', '', 'g') IN ('T', 'WhatsApp', '')
  -- OR numeric measurement patterns like "30cm x 30cm", "4 rpm**"
  OR name ~ '^\d+\s*(cm|rpm|de\s|a\s\d)'
  OR name ~ '\*\*\)?\s*$';