
-- Reasignar los nodos OpenClaw con telemetría real al usuario que mira el Hub
-- (agustin@hustleovertalks.com), borrando primero los duplicados seed obsoletos.

-- 1) Borrar las filas seed obsoletas del usuario agustin (sin last_seen_at, model gpt-5/gemini)
DELETE FROM public.openclaw_nodes
WHERE user_id = 'f103da90-81d4-43a2-ad34-b33db8b9c369'
  AND last_seen_at IS NULL
  AND name IN ('POTUS','TITAN');

-- 2) Reasignar los nodos vivos (los que reciben heartbeat real) al usuario que mira el Hub
UPDATE public.openclaw_nodes
SET user_id = 'f103da90-81d4-43a2-ad34-b33db8b9c369'
WHERE user_id = 'ef287d8b-c35f-42af-95eb-138a323fe638'
  AND name IN ('POTUS','TITAN');
