-- 1. Add external_id for idempotency
ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS external_id text;

-- Unique partial index: only enforce when external_id is provided
CREATE UNIQUE INDEX IF NOT EXISTS contact_messages_user_external_id_uniq
  ON public.contact_messages (user_id, external_id)
  WHERE external_id IS NOT NULL;

-- 2. One-shot dedupe: delete duplicates, keep oldest
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, contact_id, content, message_date, direction
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.contact_messages
  WHERE contact_id IS NOT NULL
)
DELETE FROM public.contact_messages cm
USING ranked r
WHERE cm.id = r.id AND r.rn > 1;

-- 3. Merge duplicate contacts sharing same wa_id within a user
-- Reassign messages to oldest contact, then delete duplicates
DO $$
DECLARE
  rec RECORD;
  keeper_id uuid;
BEGIN
  FOR rec IN
    SELECT user_id, wa_id, MIN(created_at) AS first_created
    FROM public.people_contacts
    WHERE wa_id IS NOT NULL AND wa_id <> ''
    GROUP BY user_id, wa_id
    HAVING COUNT(*) > 1
  LOOP
    -- Pick the oldest contact as keeper
    SELECT id INTO keeper_id
    FROM public.people_contacts
    WHERE user_id = rec.user_id AND wa_id = rec.wa_id
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    -- Move messages from duplicates to keeper
    UPDATE public.contact_messages
    SET contact_id = keeper_id
    WHERE user_id = rec.user_id
      AND contact_id IN (
        SELECT id FROM public.people_contacts
        WHERE user_id = rec.user_id AND wa_id = rec.wa_id AND id <> keeper_id
      );

    -- Move project links if any
    UPDATE public.business_project_contacts
    SET contact_id = keeper_id
    WHERE contact_id IN (
      SELECT id FROM public.people_contacts
      WHERE user_id = rec.user_id AND wa_id = rec.wa_id AND id <> keeper_id
    );

    -- Delete duplicates
    DELETE FROM public.people_contacts
    WHERE user_id = rec.user_id AND wa_id = rec.wa_id AND id <> keeper_id;
  END LOOP;
END $$;