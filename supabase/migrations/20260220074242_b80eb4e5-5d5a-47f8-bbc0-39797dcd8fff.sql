
-- Step 1: Delete messages linked to garbage contacts
DELETE FROM contact_messages
WHERE contact_id IN (
  SELECT id FROM people_contacts
  WHERE (
    LENGTH(name) > 40
    OR name LIKE '%Ubicación%'
    OR name LIKE '%Ubicacion%'
    OR (LENGTH(name) BETWEEN 31 AND 40 AND name ~ '^[a-záéíóúñ]')
    OR (LENGTH(name) BETWEEN 31 AND 40 AND name LIKE 'ES %')
  )
  AND name NOT IN (
    'Valentyna Zalievska Language School',
    'Javier Calduch - Psicología Deportiva',
    'Alejandro Contabilidad Control De Costes'
  )
);

-- Step 2: Delete contact_aliases references
DELETE FROM contact_aliases
WHERE contact_id IN (
  SELECT id FROM people_contacts
  WHERE (
    LENGTH(name) > 40
    OR name LIKE '%Ubicación%'
    OR name LIKE '%Ubicacion%'
    OR (LENGTH(name) BETWEEN 31 AND 40 AND name ~ '^[a-záéíóúñ]')
    OR (LENGTH(name) BETWEEN 31 AND 40 AND name LIKE 'ES %')
  )
  AND name NOT IN (
    'Valentyna Zalievska Language School',
    'Javier Calduch - Psicología Deportiva',
    'Alejandro Contabilidad Control De Costes'
  )
);

-- Step 3: Delete contact_links references
DELETE FROM contact_links
WHERE source_contact_id IN (
  SELECT id FROM people_contacts
  WHERE (
    LENGTH(name) > 40
    OR name LIKE '%Ubicación%'
    OR name LIKE '%Ubicacion%'
    OR (LENGTH(name) BETWEEN 31 AND 40 AND name ~ '^[a-záéíóúñ]')
    OR (LENGTH(name) BETWEEN 31 AND 40 AND name LIKE 'ES %')
  )
  AND name NOT IN (
    'Valentyna Zalievska Language School',
    'Javier Calduch - Psicología Deportiva',
    'Alejandro Contabilidad Control De Costes'
  )
)
OR target_contact_id IN (
  SELECT id FROM people_contacts
  WHERE (
    LENGTH(name) > 40
    OR name LIKE '%Ubicación%'
    OR name LIKE '%Ubicacion%'
    OR (LENGTH(name) BETWEEN 31 AND 40 AND name ~ '^[a-záéíóúñ]')
    OR (LENGTH(name) BETWEEN 31 AND 40 AND name LIKE 'ES %')
  )
  AND name NOT IN (
    'Valentyna Zalievska Language School',
    'Javier Calduch - Psicología Deportiva',
    'Alejandro Contabilidad Control De Costes'
  )
);

-- Step 4: Delete contact_link_suggestions references
DELETE FROM contact_link_suggestions
WHERE mentioned_by IN (
  SELECT id FROM people_contacts
  WHERE (
    LENGTH(name) > 40
    OR name LIKE '%Ubicación%'
    OR name LIKE '%Ubicacion%'
    OR (LENGTH(name) BETWEEN 31 AND 40 AND name ~ '^[a-záéíóúñ]')
    OR (LENGTH(name) BETWEEN 31 AND 40 AND name LIKE 'ES %')
  )
  AND name NOT IN (
    'Valentyna Zalievska Language School',
    'Javier Calduch - Psicología Deportiva',
    'Alejandro Contabilidad Control De Costes'
  )
)
OR suggested_contact IN (
  SELECT id FROM people_contacts
  WHERE (
    LENGTH(name) > 40
    OR name LIKE '%Ubicación%'
    OR name LIKE '%Ubicacion%'
    OR (LENGTH(name) BETWEEN 31 AND 40 AND name ~ '^[a-záéíóúñ]')
    OR (LENGTH(name) BETWEEN 31 AND 40 AND name LIKE 'ES %')
  )
  AND name NOT IN (
    'Valentyna Zalievska Language School',
    'Javier Calduch - Psicología Deportiva',
    'Alejandro Contabilidad Control De Costes'
  )
);

-- Step 5: Delete contact_relationships references
DELETE FROM contact_relationships
WHERE contact_a_id IN (
  SELECT id FROM people_contacts
  WHERE (
    LENGTH(name) > 40
    OR name LIKE '%Ubicación%'
    OR name LIKE '%Ubicacion%'
    OR (LENGTH(name) BETWEEN 31 AND 40 AND name ~ '^[a-záéíóúñ]')
    OR (LENGTH(name) BETWEEN 31 AND 40 AND name LIKE 'ES %')
  )
  AND name NOT IN (
    'Valentyna Zalievska Language School',
    'Javier Calduch - Psicología Deportiva',
    'Alejandro Contabilidad Control De Costes'
  )
)
OR contact_b_id IN (
  SELECT id FROM people_contacts
  WHERE (
    LENGTH(name) > 40
    OR name LIKE '%Ubicación%'
    OR name LIKE '%Ubicacion%'
    OR (LENGTH(name) BETWEEN 31 AND 40 AND name ~ '^[a-záéíóúñ]')
    OR (LENGTH(name) BETWEEN 31 AND 40 AND name LIKE 'ES %')
  )
  AND name NOT IN (
    'Valentyna Zalievska Language School',
    'Javier Calduch - Psicología Deportiva',
    'Alejandro Contabilidad Control De Costes'
  )
);

-- Step 6: Delete business_project_contacts references
DELETE FROM business_project_contacts
WHERE contact_id IN (
  SELECT id FROM people_contacts
  WHERE (
    LENGTH(name) > 40
    OR name LIKE '%Ubicación%'
    OR name LIKE '%Ubicacion%'
    OR (LENGTH(name) BETWEEN 31 AND 40 AND name ~ '^[a-záéíóúñ]')
    OR (LENGTH(name) BETWEEN 31 AND 40 AND name LIKE 'ES %')
  )
  AND name NOT IN (
    'Valentyna Zalievska Language School',
    'Javier Calduch - Psicología Deportiva',
    'Alejandro Contabilidad Control De Costes'
  )
);

-- Step 7: Finally delete the garbage contacts
DELETE FROM people_contacts
WHERE (
  LENGTH(name) > 40
  OR name LIKE '%Ubicación%'
  OR name LIKE '%Ubicacion%'
  OR (LENGTH(name) BETWEEN 31 AND 40 AND name ~ '^[a-záéíóúñ]')
  OR (LENGTH(name) BETWEEN 31 AND 40 AND name LIKE 'ES %')
)
AND name NOT IN (
  'Valentyna Zalievska Language School',
  'Javier Calduch - Psicología Deportiva',
  'Alejandro Contabilidad Control De Costes'
);
