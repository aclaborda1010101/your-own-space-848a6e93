
-- 1) Fusionar duplicado específico Dani -> Adolfo
DO $$
DECLARE
  v_dani uuid := '0784bcf3-ee46-4b5b-a354-0e8f181acb2b';
  v_adolfo uuid := '0fcf785d-fc27-4e1c-b94d-fcaf8e8cbc9a';
BEGIN
  -- Mover mensajes
  UPDATE contact_messages SET contact_id = v_adolfo WHERE contact_id = v_dani;
  -- Copiar wa_id al contacto bueno
  UPDATE people_contacts SET wa_id = '34655442802' WHERE id = v_adolfo AND wa_id IS NULL;
  -- Eliminar duplicado
  DELETE FROM people_contacts WHERE id = v_dani;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Merge skipped: %', SQLERRM;
END $$;

-- 2) Sincronizar last_contact de TODOS los contactos con su mensaje más reciente
UPDATE people_contacts pc
SET last_contact = sub.max_date
FROM (
  SELECT contact_id, MAX(message_date) AS max_date
  FROM contact_messages
  WHERE contact_id IS NOT NULL
  GROUP BY contact_id
) sub
WHERE pc.id = sub.contact_id
  AND (pc.last_contact IS NULL OR pc.last_contact < sub.max_date);

-- 3) Trigger automático: al insertar un mensaje, bumpear last_contact si procede
CREATE OR REPLACE FUNCTION public.bump_contact_last_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL AND NEW.message_date IS NOT NULL THEN
    UPDATE public.people_contacts
    SET last_contact = NEW.message_date
    WHERE id = NEW.contact_id
      AND (last_contact IS NULL OR last_contact < NEW.message_date);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_contact_last_contact ON public.contact_messages;
CREATE TRIGGER trg_bump_contact_last_contact
AFTER INSERT ON public.contact_messages
FOR EACH ROW
EXECUTE FUNCTION public.bump_contact_last_contact();
