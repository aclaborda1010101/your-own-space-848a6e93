-- Re-pasada de enriquecimiento de teléfonos usando unaccent
-- Solo toca contactos sin wa_id Y sin phone_numbers válidos
WITH matches AS (
  SELECT DISTINCT ON (pc.id)
    pc.id AS contact_id,
    t.desired_wa,
    t.phones
  FROM people_contacts pc
  JOIN _tmp_mac_import t
    ON lower(unaccent(pc.name)) = lower(unaccent(t.name))
  WHERE pc.wa_id IS NULL
    AND (pc.phone_numbers IS NULL OR array_length(pc.phone_numbers, 1) IS NULL)
  ORDER BY pc.id, array_length(t.phones, 1) DESC NULLS LAST
),
upd AS (
  UPDATE people_contacts pc
  SET wa_id = m.desired_wa,
      phone_numbers = m.phones,
      updated_at = now()
  FROM matches m
  WHERE pc.id = m.contact_id
  RETURNING pc.id
)
DELETE FROM contact_headlines
WHERE contact_id IN (SELECT id FROM upd);