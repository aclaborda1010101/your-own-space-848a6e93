-- Eliminar política débil que permite acceso total a cualquiera
DROP POLICY IF EXISTS "device_tokens_all" ON public.device_tokens;
DROP POLICY IF EXISTS "Users can manage their own device tokens" ON public.device_tokens;

-- Políticas separadas y explícitas para el usuario autenticado.
-- Permitimos que el usuario reclame filas con user_id NULL (huérfanas pre-auth)
-- haciendo UPDATE/INSERT cuyo NEW.user_id sea su propio uid.

CREATE POLICY "device_tokens_select_own"
ON public.device_tokens
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "device_tokens_insert_own"
ON public.device_tokens
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- UPDATE: permitir reclamar huérfanos (qual user_id IS NULL OR = uid)
-- pero only-if NEW.user_id = uid
CREATE POLICY "device_tokens_update_own_or_orphan"
ON public.device_tokens
FOR UPDATE
TO authenticated
USING (user_id IS NULL OR auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "device_tokens_delete_own"
ON public.device_tokens
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Permitir lectura/escritura sin auth solo para edge functions con service role
-- (el service role bypasea RLS por defecto, no requiere policy).