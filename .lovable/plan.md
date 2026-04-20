

## Plan: 4 fixes — tareas con contacto, privacidad por defecto, refresh real de perfiles, headlines obsoletos

### 1. Tareas vinculadas a contacto + alimentan Red Estratégica

**Problema:** las tareas tienen `contact_id` en BD pero la UI nunca lo escribe. Al crear una tarea no se enlaza con el contacto, así que la Red Estratégica no las ve.

**Cambios:**
- `useTasks.tsx > addTask`: aceptar `contactId` y persistirlo en `tasks.contact_id`. El `select` ya hace join con `people_contacts(name)`.
- `Tasks.tsx`: en el formulario rápido y en `EditTaskDialog`, añadir un selector ligero de contacto (Combobox con búsqueda) opcional. Al seleccionar, mostrar pill "→ Nombre" en la tarjeta de la tarea.
- En `SuggestedTasksDialog`: cuando JARVIS sugiere una tarea con `content.contact_name` o `content.contact_id`, intentar resolver a un contacto real (fuzzy via `search_contacts_fuzzy` RPC ya existente) y persistir `contact_id` al aceptar.
- `ContactDetail.tsx`: añadir bloque "Tareas asociadas" que consulta `tasks` filtradas por `contact_id = current` (pendientes y completadas en accordion). Esto cierra el bucle: la Red Estratégica ve actividad real con esa persona.

### 2. Privacidad por defecto + invertir el switch

**Estado actual auditado:**
- `tasks.is_personal` default `false` → tareas NACEN compartidas. La RLS sólo bloquea cuando `is_personal = true`.
- `business_projects.is_public` default `false` → ya está bien (privadas por defecto).
- `people_contacts`, `check_ins`, `calendar_events`: RLS basada sólo en `user_id` o en `resource_shares`. NO se comparten salvo entrada explícita en `resource_shares`. **Ya son privados por defecto.**

**Problema real**: sólo `tasks` está mal. Switch dice "Personal" pero la lógica natural debería ser "Compartida" (privada por defecto, marcas para compartir).

**Cambios (migración + código):**
- Migración: cambiar `tasks.is_personal` default a `true`. Backfill: las tareas existentes no se tocan (respeto al estado actual del usuario), salvo que el usuario lo pida.
- En `useTasks.addTask`: si no se pasa `isPersonal`, usar `true`.
- En `Tasks.tsx` y `EditTaskDialog`: invertir el switch a "Compartida con red" (off por defecto). Internamente sigue mapeando a `is_personal = !shared`.
- Badge en lista: cambiar `Lock + "Personal"` por `Users + "Compartida"` cuando NO sea personal (más informativo).

### 3. Botón "Refrescar perfiles" no actualiza

**Problema:** el toast dice "Perfiles regenerados: 0/0" porque el endpoint ahora responde `202` con `{queued, total, background:true}` pero el UI lee `data.refreshed`/`data.total`/`data.errors` que ya no existen → siempre 0/0 y NO se ve progreso. Además, varios contactos siguen con `updated_at` de febrero.

**Cambios:**
- `RedEstrategica.tsx > refreshAllProfiles`: leer `data.queued` y `data.message`. Mostrar toast "Refrescando N contactos en segundo plano. Vuelve en 1-2 minutos." y reintentar `load()` cada 30s durante 3 minutos para reflejar avance.
- En `contact-profiles-refresh-all`: ordenar por `updated_at NULLS FIRST` y priorizar los que no tienen `personality_profile` (Gorka, Fran, Cez actualmente sin perfil). Subir `MAX_PER_RUN` a 100.
- Añadir badge en cada `ContactCard` "Actualizado hace X días" para que el usuario vea cuáles van quedando rezagados.

### 4. Headlines: "Sin asunto vivo" pero "Próxima acción" sí dice algo

**Problema concreto Xuso Carbonell:** cache tiene `pending.title = "Sin asunto vivo"` con `freshness=stale` pero el LLM nunca regenera porque `isCachedPayloadExpired()` devuelve `false` cuando el `freshness_status` ya es `"stale"` y no hay `expires_at`. Mirando el código línea 330: SÍ devuelve `true` para stale. Pero en `get-contact-headlines` el regen sólo se dispara con delta de 20 mensajes nuevos o `force=true`. Si no llegan mensajes, queda eternamente "Sin asunto vivo".

Además la "Próxima acción" del header viene de `personality_profile.proxima_accion` (independiente de headlines), así que se desincroniza visiblemente.

**Cambios:**
- `get-contact-headlines`: si `cachedExpired === true` (stale/expired), regenerar SIEMPRE aunque no haya delta de 20 mensajes. Es el motivo por el que Xuso queda muerto.
- En `useContactHeadlines.ts`: tras detectar `freshness_status` ∈ `{expired, stale}`, llamar `refresh(true)` automáticamente una vez por carga.
- `ContactDetail.tsx`: si el header dice "Sin asunto vivo" pero `nextAction.que` existe, mostrar el bloque "Próxima acción" como **el** asunto vivo (caer back) en vez de mostrar la frase fría. Coherencia visual.
- Forzar regeneración masiva: añadir botón "Refrescar titulares" en RedEstrategica ya existe (`refreshHeadlines`). Tras desplegar este fix, ejecutarlo limpiará los stale.

### Archivos a tocar

- `src/hooks/useTasks.tsx` — soporte `contactId`, default `isPersonal=true`.
- `src/pages/Tasks.tsx` — selector de contacto, switch invertido "Compartida".
- `src/components/tasks/EditTaskDialog.tsx` — idem.
- `src/components/tasks/SuggestedTasksDialog.tsx` — resolver contacto al aceptar.
- `src/pages/ContactDetail.tsx` — bloque "Tareas asociadas", fallback de header.
- `src/pages/RedEstrategica.tsx` — leer respuesta nueva, polling, badge antigüedad.
- `src/hooks/useContactHeadlines.ts` — auto-refresh si stale.
- `supabase/functions/get-contact-headlines/index.ts` — regenerar siempre si `cachedExpired`.
- `supabase/functions/contact-profiles-refresh-all/index.ts` — priorizar sin perfil + nulls first.
- Migración: `ALTER TABLE tasks ALTER COLUMN is_personal SET DEFAULT true;`

### Fuera de alcance
- No tocar `business_projects` (ya privado por defecto, el usuario lo pidió).
- No tocar el listado real de contactos: Xuso y Raúl SÍ están importados en BD; la "ausencia" en sugerencias Plaud es por falta de menciones literales en el extracto, no por contacto faltante. Si tras el fix sigue ocurriendo, miramos el matcher.

