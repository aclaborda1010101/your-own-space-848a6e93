-- =====================================================================
-- SANEAMIENTO DE CONTACTOS DUPLICADOS POR wa_id (v2 — fix MAX(uuid))
-- =====================================================================

-- FASE 1 — borrar duplicados vacíos del import 20-abr 10:22
WITH dup_groups AS (
  SELECT wa_id
  FROM people_contacts
  WHERE wa_id IS NOT NULL AND wa_id <> ''
  GROUP BY wa_id
  HAVING COUNT(*) > 1
),
empty_dups AS (
  SELECT pc.id
  FROM people_contacts pc
  JOIN dup_groups g ON g.wa_id = pc.wa_id
  WHERE pc.created_at >= '2026-04-20 10:00:00+00'
    AND pc.created_at <  '2026-04-20 11:00:00+00'
    AND pc.last_contact IS NULL
    AND COALESCE(pc.wa_message_count, 0) = 0
    AND NOT EXISTS (SELECT 1 FROM contact_messages cm WHERE cm.contact_id = pc.id)
    AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.contact_id = pc.id)
    AND NOT EXISTS (SELECT 1 FROM emails e WHERE e.contact_id = pc.id)
    AND NOT EXISTS (SELECT 1 FROM interactions i WHERE i.contact_id = pc.id)
    AND NOT EXISTS (SELECT 1 FROM suggestions s WHERE s.contact_id = pc.id)
)
DELETE FROM people_contacts pc
USING empty_dups e
WHERE pc.id = e.id;

-- FASE 2 — plan de merge
CREATE TEMP TABLE _merge_plan ON COMMIT DROP AS
WITH dup_groups AS (
  SELECT wa_id
  FROM people_contacts
  WHERE wa_id IS NOT NULL AND wa_id <> ''
  GROUP BY wa_id
  HAVING COUNT(*) > 1
),
ranked AS (
  SELECT
    pc.id,
    pc.wa_id,
    pc.name,
    pc.is_favorite,
    pc.in_strategic_network,
    pc.created_at,
    ROW_NUMBER() OVER (
      PARTITION BY pc.wa_id
      ORDER BY
        pc.is_favorite DESC NULLS LAST,
        pc.in_strategic_network DESC NULLS LAST,
        (SELECT COUNT(*) FROM contact_messages cm WHERE cm.contact_id = pc.id) DESC,
        (CASE WHEN position(' ' in pc.name) > 0 THEN 1 ELSE 0 END) DESC,
        length(pc.name) DESC,
        pc.created_at ASC
    ) AS rk
  FROM people_contacts pc
  JOIN dup_groups g ON g.wa_id = pc.wa_id
)
SELECT
  r.wa_id,
  (ARRAY_AGG(r.id) FILTER (WHERE r.rk = 1))[1] AS canonical_id,
  ARRAY_AGG(r.id) FILTER (WHERE r.rk > 1)      AS duplicate_ids
FROM ranked r
GROUP BY r.wa_id;

CREATE TEMP TABLE _merge_map ON COMMIT DROP AS
SELECT unnest(duplicate_ids) AS dup_id, canonical_id
FROM _merge_plan
WHERE duplicate_ids IS NOT NULL;

-- ── contact_messages: dedup por external_id, luego reasignar ────────
DELETE FROM contact_messages cm
USING _merge_map m
WHERE cm.contact_id = m.dup_id
  AND cm.external_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM contact_messages cm2
    WHERE cm2.contact_id = m.canonical_id
      AND cm2.external_id = cm.external_id
  );
UPDATE contact_messages cm
SET contact_id = m.canonical_id
FROM _merge_map m
WHERE cm.contact_id = m.dup_id;

-- ── headlines / podcasts / refresh_state: borrar los del duplicado ──
DELETE FROM contact_headlines ch
USING _merge_map m
WHERE ch.contact_id = m.dup_id;

DELETE FROM contact_headline_dismissals chd
USING _merge_map m
WHERE chd.contact_id = m.dup_id
  AND EXISTS (
    SELECT 1 FROM contact_headline_dismissals chd2
    WHERE chd2.contact_id = m.canonical_id
      AND chd2.signature = chd.signature
  );
UPDATE contact_headline_dismissals chd
SET contact_id = m.canonical_id
FROM _merge_map m
WHERE chd.contact_id = m.dup_id;

DELETE FROM contact_podcasts cp
USING _merge_map m
WHERE cp.contact_id = m.dup_id;

DELETE FROM contact_refresh_state crs
USING _merge_map m
WHERE crs.contact_id = m.dup_id;

-- ── reasignaciones simples ──────────────────────────────────────────
UPDATE emails              SET contact_id = m.canonical_id FROM _merge_map m WHERE emails.contact_id              = m.dup_id;
UPDATE interactions        SET contact_id = m.canonical_id FROM _merge_map m WHERE interactions.contact_id        = m.dup_id;
UPDATE suggested_responses SET contact_id = m.canonical_id FROM _merge_map m WHERE suggested_responses.contact_id = m.dup_id;
UPDATE suggestion_feedback SET contact_id = m.canonical_id FROM _merge_map m WHERE suggestion_feedback.contact_id = m.dup_id;
UPDATE suggestions         SET contact_id = m.canonical_id FROM _merge_map m WHERE suggestions.contact_id         = m.dup_id;
UPDATE tasks               SET contact_id = m.canonical_id FROM _merge_map m WHERE tasks.contact_id               = m.dup_id;
UPDATE contact_aliases     SET contact_id = m.canonical_id FROM _merge_map m WHERE contact_aliases.contact_id     = m.dup_id;

-- business_project_contacts: dedup por (project_id, contact_id)
DELETE FROM business_project_contacts bpc
USING _merge_map m
WHERE bpc.contact_id = m.dup_id
  AND EXISTS (
    SELECT 1 FROM business_project_contacts bpc2
    WHERE bpc2.contact_id = m.canonical_id
      AND bpc2.project_id = bpc.project_id
  );
UPDATE business_project_contacts SET contact_id = m.canonical_id FROM _merge_map m WHERE business_project_contacts.contact_id = m.dup_id;

UPDATE business_project_timeline SET contact_id = m.canonical_id FROM _merge_map m WHERE business_project_timeline.contact_id = m.dup_id;

-- Borrar duplicados ya vacíos
DELETE FROM people_contacts pc
USING _merge_map m
WHERE pc.id = m.dup_id;

-- FASE 3 — recalcular last_contact y wa_message_count en canónicos
WITH affected AS (
  SELECT DISTINCT canonical_id AS id FROM _merge_plan WHERE canonical_id IS NOT NULL
),
stats AS (
  SELECT
    a.id,
    MAX(cm.message_date) AS last_msg,
    COUNT(*) FILTER (WHERE cm.source IN ('whatsapp','whatsapp_backup')) AS wa_count
  FROM affected a
  LEFT JOIN contact_messages cm ON cm.contact_id = a.id
  GROUP BY a.id
)
UPDATE people_contacts pc
SET
  last_contact     = COALESCE(s.last_msg, pc.last_contact),
  wa_message_count = COALESCE(s.wa_count, pc.wa_message_count, 0),
  updated_at       = now()
FROM stats s
WHERE pc.id = s.id;

-- Limpiar headlines de canónicos para regeneración
DELETE FROM contact_headlines
WHERE contact_id IN (SELECT canonical_id FROM _merge_plan WHERE canonical_id IS NOT NULL);

-- FASE 4 — índice único parcial para prevenir duplicados futuros
DO $$
DECLARE
  v_remaining int;
BEGIN
  SELECT COUNT(*) INTO v_remaining
  FROM (
    SELECT wa_id FROM people_contacts
    WHERE wa_id IS NOT NULL AND wa_id <> ''
    GROUP BY wa_id HAVING COUNT(*) > 1
  ) x;

  IF v_remaining = 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'people_contacts_user_waid_unique'
    ) THEN
      CREATE UNIQUE INDEX people_contacts_user_waid_unique
        ON public.people_contacts (user_id, wa_id)
        WHERE wa_id IS NOT NULL AND wa_id <> '';
    END IF;
  ELSE
    RAISE NOTICE 'Quedan % grupos de wa_id duplicados, no se crea indice unico', v_remaining;
  END IF;
END $$;