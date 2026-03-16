

## Plan: Arreglar persistencia y navegación de datos WHOOP

He identificado **3 bugs raíz** que explican todo lo que describes:

### Bug 1: "Sincronizar" siempre trae datos de hoy, no del día seleccionado
El botón "Sincronizar" llama a `fetchData()` que invoca `whoop-auth` con `action: "fetch_data"`. Esta función **siempre** pide ayer+hoy a la API de WHOOP, ignorando completamente la fecha seleccionada. Por eso al ir al día anterior y sincronizar, ves los datos de hoy.

**Fix**: Pasar `selectedDate` al edge function para que pida el rango correcto a la API de WHOOP.

### Bug 2: Los datos no se guardan (desaparecen al salir)
El edge function `whoop-auth` hace upsert con `onConflict: "user_id,data_date"`, pero el schema original tenía `UNIQUE(user_id)` (sin data_date). Aunque hay una migración posterior que intenta cambiar el constraint, si falló parcialmente el upsert falla silenciosamente (el error se loguea pero no se propaga). Además, el objeto retornado por la API no incluye `data_date`, así que el dato solo vive en memoria.

**Fix**: Asegurar el constraint composite existe, y que el edge function retorne `data_date` en la respuesta.

### Bug 3: "Cargar 30 días" no descarga todo
La API de WHOOP pagina resultados y devuelve un `next_token`. El código actual NO maneja paginación, así que solo obtiene la primera página (típicamente ~10 registros por endpoint). Para 30 días, se pierden la mayoría.

**Fix**: Implementar paginación en `fetchWhoopDataForDateRange` del edge function `whoop-sync`.

### Bug 4 (UX): Al entrar en Salud sin datos, no se auto-sincroniza
Si ya estás conectado pero no hay datos locales, deberías auto-sincronizar sin tener que pulsar botón.

---

### Cambios por archivo

**1. `supabase/functions/whoop-auth/index.ts`** (edge function)
- Aceptar parámetro `date` opcional en `fetch_data`
- Si se recibe `date`, usar ese día como centro del rango (date-1 a date)
- Incluir `data_date` en cada objeto del `dayMap` antes del upsert
- Retornar `data_date` en la respuesta

**2. `supabase/functions/whoop-sync/index.ts`** (edge function)
- Añadir paginación en `fetchWhoopDataForDateRange`: seguir `next_token` hasta agotar resultados de cada endpoint (recovery, cycle, sleep)
- Esto arregla el backfill de 30 días

**3. `src/hooks/useWhoop.tsx`** (frontend)
- `fetchData`: pasar `selectedDate` al edge function como `date` parameter
- Eliminar el fallback de `loadDateData` que muestra datos de otro día (confuso)
- Auto-sincronizar al montar si conectado pero sin datos para hoy
- Tras backfill exitoso, refrescar los datos y las fechas disponibles

**4. Migración SQL** (si el constraint no existe)
- `ALTER TABLE whoop_data DROP CONSTRAINT IF EXISTS whoop_data_user_id_key; ALTER TABLE whoop_data ADD CONSTRAINT whoop_data_user_date_unique UNIQUE (user_id, data_date);` — idempotente para asegurar que el constraint composite existe

### Resultado esperado
- Entrar en Salud → carga datos de hoy desde BD. Si no hay, auto-sincroniza
- Navegar a otro día → muestra datos de ese día (o "sin datos" real)
- Sincronizar en cualquier día → descarga datos de ESE día desde WHOOP
- Cargar 30 días → descarga los 30 días completos con paginación
- Datos persisten entre sesiones

