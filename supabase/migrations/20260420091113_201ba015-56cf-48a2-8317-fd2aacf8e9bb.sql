-- Reparar fusión incorrecta Dani→Adolfo. Mover mensajes de Daniel desde Adolfo a Daniel Carvajal,
-- mover wa_id al dueño correcto y resincronizar last_contact de ambos.
DO $$
DECLARE
  v_adolfo uuid := '0fcf785d-fc27-4e1c-b94d-fcaf8e8cbc9a';
  v_daniel uuid := '0c157af8-a512-4a82-b533-688d13f20f99';
BEGIN
  -- 1) Mover mensajes mal ubicados: external_id no nulo (vinieron por Evolution),
  --    sender = 'Dani', o cualquier mensaje del 6-abril-2026 en adelante (todos son Daniel).
  UPDATE contact_messages
  SET contact_id = v_daniel
  WHERE contact_id = v_adolfo
    AND (
      external_id IS NOT NULL
      OR sender = 'Dani'
      OR message_date >= '2026-04-01'
      OR LOWER(content) LIKE '%farmamatch%'
    );

  -- 2) Mover wa_id al dueño correcto
  UPDATE people_contacts SET wa_id = NULL, phone_numbers = NULL
   WHERE id = v_adolfo AND wa_id = '34655442802';
  UPDATE people_contacts SET wa_id = '34655442802', phone_numbers = ARRAY['34655442802']
   WHERE id = v_daniel;

  -- 3) Recalcular last_contact basado en mensajes reales restantes/nuevos
  UPDATE people_contacts pc
  SET last_contact = sub.max_date
  FROM (
    SELECT contact_id, MAX(message_date) AS max_date
    FROM contact_messages
    WHERE contact_id IN (v_adolfo, v_daniel)
    GROUP BY contact_id
  ) sub
  WHERE pc.id = sub.contact_id;
END $$;