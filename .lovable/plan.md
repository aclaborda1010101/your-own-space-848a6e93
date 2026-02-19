
# Integracion Plaud — Fase 1 ✅ COMPLETADA

## Cambios implementados

### 1. ✅ Migracion SQL — Tabla `plaud_transcriptions`
- Tabla creada con RLS (user_id = auth.uid()) para SELECT/INSERT/UPDATE/DELETE
- Service role policy para llamadas internas desde edge functions
- Indice en (user_id, recording_date)

### 2. ✅ Modificacion de `email-sync/index.ts`
- **Excepcion Plaud** añadida ANTES de auto_reply y newsletters en `preClassifyEmail`
- **Trigger automatico**: despues del upsert, detecta emails `plaud_transcription` y llama a `plaud-intelligence` con service role key

### 3. ✅ Nueva edge function `plaud-intelligence/index.ts`
- Parser `parsePlaudReport()` basado en regex (sin IA)
- Extrae: tareas, citas, oportunidades, contactos, decisiones, alertas
- Genera sugerencias en tabla `suggestions` con tipos: task_from_plaud, event_from_plaud, opportunity_from_plaud, contact_from_plaud
- Vincula contactos por nombre con people_contacts + contact_aliases
- Marca email como leido, actualiza processing_status

### 4. ✅ Eliminado `plaud-email-check`
- Funcion obsoleta borrada y des-deployada

### 5. ✅ Config actualizado
- `plaud-intelligence` con verify_jwt = false

## Pendiente — Fase 2
- Descarga de adjuntos .txt (transcripcion completa con speakers/timestamps)
- Flujo "Crear proyecto" desde oportunidad
- Vinculacion de speakers con contactos (aliases)
- UI de sugerencias Plaud en dashboard
