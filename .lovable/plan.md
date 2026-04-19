
El usuario aclara: el trigger de "100 mensajes / 20 emails" debe ser para **actualizar la bio/perfil del contacto** (no el podcast). El podcast debe generar un audio único de la **relación completa** con ese contacto, bajo demanda o cuando él lo pida — no en segmentos incrementales cada 100 mensajes.

Voy a corregir la arquitectura.

## Plan: separar "actualizar bio" de "generar podcast"

### A) Bio del contacto (auto-actualización)
- **Trigger 1**: tras cada inserción en `contact_messages`, si `count(messages WHERE contact_id) % 100 == 0` y hace >5 min del anterior → encolar refresh de bio.
- **Trigger 2**: tras procesar emails en `email-intelligence`, contar emails nuevos para ese contacto desde el último refresh. Si ≥20 → encolar refresh de bio.
- "Refresh de bio" = invocar `contact-analysis` (ya existe) + `get-contact-headlines` (invalidar cache).
- Quitar del `evolution-webhook` el encolado a `podcast_generation_queue`.

### B) Podcast del contacto (relación completa, on-demand)
- **Cambio funcional**: el podcast es **un único audio** que resume **toda la relación** (no segmentos de 100).
- Se genera cuando el usuario pulsa "Generar podcast" en la ficha (bajo demanda).
- Se puede regenerar manualmente. No hay auto-encolado.
- Internamente: si la conversación es muy larga (>500 msgs), `generate-contact-podcast-segment` hace **resumen jerárquico** (chunks → resumen global → guion único → 1 mp3). Pero la salida es **un solo audio** y **un solo "segmento"** en BD (segment_number=1 siempre, se sobrescribe al regenerar).
- Renombrar conceptualmente: en UI "Podcast de la relación" en lugar de "segmentos".
- `PodcastPlayer`: mostrar un solo reproductor sin tira de segmentos. Botón "Regenerar" rehace el audio completo.

### Cambios concretos

**Backend**:
1. `evolution-webhook/index.ts`: eliminar bloque de `podcast_generation_queue`. Añadir bloque que, al cruzar múltiplo de 100 msgs y >5 min del anterior, invoque `contact-analysis` (fire-and-forget) para refrescar bio + invalide `contact_headlines` para el contacto.
2. `email-intelligence/index.ts`: tras analizar, por cada contacto resuelto, contar emails procesados desde `last_bio_refresh_at` (campo nuevo en `people_contacts`). Si ≥20 → invocar `contact-analysis` + invalidar headlines.
3. `people_contacts`: añadir columna `last_bio_refresh_at timestamptz` (migración).
4. `generate-contact-podcast-segment/index.ts`: reescribir para procesar **toda la conversación** del contacto (con resumen jerárquico si >500 msgs); siempre genera segmento `1` (upsert), reemplazando el anterior. Renombrar internamente sigue OK; es la lógica la que cambia.
5. `process-podcast-queue` y `podcast_generation_queue`: dejar de usarse para auto-trigger. Mantener tabla por si el usuario quiere encolar manual desde UI, pero sin cron auto. Alternativa: borrar cron job y tabla. **Decisión**: borrar cron + tabla (no se usan).

**Frontend**:
6. `PodcastPlayer.tsx`: simplificar a un solo audio (sin tira de segmentos, sin auto-advance). Mostrar "Podcast generado · hace X" + botón Regenerar + selector formato + descarga.
7. `useContactPodcast.ts`: simplificar — solo 1 segmento esperado. `regenerate()` invoca `generate-contact-podcast-segment` con `force_full_regenerate: true` siempre.
8. `ContactDetail.tsx`: pequeño ajuste de copy ("Podcast de la relación").

### Lo que NO se toca
- Tablas `contact_podcasts` / `contact_podcast_segments` (estructura sigue OK, solo se usa segment 1).
- `get-contact-headlines` (sigue invalidando cada 20 msgs, ya estaba bien).
- UI de Red Estratégica.

### Resumen
- Auto: bio se refresca cada 100 msgs WhatsApp o 20 emails.
- Manual: podcast = audio único de toda la relación, generado al pulsar el botón.
