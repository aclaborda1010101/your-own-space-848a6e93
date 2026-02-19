
# Integracion Plaud — Fase 1 Completa

## Cambios a implementar

### 1. Migracion SQL — Tabla `plaud_transcriptions`

Nueva tabla con RLS para almacenar las transcripciones procesadas de Plaud:
- `id`, `user_id`, `source_email_id`, `recording_date`, `title`
- `transcript_raw` (text, vacio en fase 1 — se llenara con adjuntos en fase 2)
- `summary_structured` (text — el body del email con el informe)
- `participants` (jsonb), `parsed_data` (jsonb)
- `ai_processed` (boolean), `processing_status` (text: pending/processing/completed/error)
- Indice en `(user_id, recording_date)`
- RLS: user_id = auth.uid() para SELECT/INSERT/UPDATE/DELETE

### 2. Modificacion de `email-sync/index.ts`

**Cambio 1 — Excepcion Plaud en `preClassifyEmail` (linea 56)**

Anadir ANTES de la regla de auto-reply (que esta antes de newsletters):

```
if (from.includes("plaud.ai") || subject.includes("[plaud-autoflow]"))
  return "plaud_transcription";
```

Esto evita que `no-reply@plaud.ai` caiga en la regla de newsletters `no-reply@`.

**Cambio 2 — Trigger automatico despues del upsert (linea 914)**

Despues de la linea `console.log(...Inserted/upserted...)`, anadir bloque que:
1. Filtra los emails del batch que tienen `email_type === 'plaud_transcription'`
2. Para cada uno, hace un `fetch` interno a `plaud-intelligence` con `{ email_id: message_id, user_id, account }`
3. Log del resultado

### 3. Nueva edge function `plaud-intelligence/index.ts`

Funcion que recibe `{ email_id, user_id, account }` (llamada interna desde email-sync):

**Flujo:**
1. Validar que `user_id` esta presente (seguridad interna, no JWT)
2. Buscar el email en `jarvis_emails_cache` por `message_id + user_id`
3. Extraer del asunto: fecha de grabacion (`[Plaud-AutoFlow] MM-DD`) y titulo
4. Usar `body_text` (o `body_html` como fallback) como `summary_structured`
5. Parsear el informe con `parsePlaudReport()` — regex puro, sin IA
6. Insertar en `plaud_transcriptions` con `parsed_data`
7. Generar sugerencias en tabla `suggestions`:
   - Tareas: `suggestion_type = 'task_from_plaud'`, content con description/responsible/deadline/priority/quote
   - Citas: `suggestion_type = 'event_from_plaud'`, content con description/date/time/location/participants
   - Oportunidades: `suggestion_type = 'opportunity_from_plaud'`, content con description/client/need/value/nextStep
   - Contactos: `suggestion_type = 'contact_from_plaud'`, content con name/role/newData
8. Marcar email como `is_read = true` en `jarvis_emails_cache`
9. Actualizar `processing_status = 'completed'` en `plaud_transcriptions`

**Parser `parsePlaudReport`:**
- Divide texto por headers `## SECCION` (TAREAS DETECTADAS, CITAS Y REUNIONES, etc.)
- Extrae campos por patron `- **CAMPO:** valor` con variantes (`CAMPO:`, `- CAMPO:`)
- Mapeo de prioridades: URGENTE→urgent, ALTA→high, MEDIA→medium, BAJA→low
- Parseo de fechas DD/MM/YYYY y relativas

### 4. Eliminar `plaud-email-check`

Borrar `supabase/functions/plaud-email-check/index.ts` y des-deployar. Queda obsoleta.

### 5. Actualizar `supabase/config.toml`

Anadir:
```
[functions.plaud-intelligence]
verify_jwt = false
```

## Archivos

| Archivo | Accion |
|---------|--------|
| Migracion SQL | CREATE TABLE plaud_transcriptions + RLS |
| `supabase/functions/email-sync/index.ts` | Excepcion Plaud + trigger post-upsert |
| `supabase/functions/plaud-intelligence/index.ts` | Nuevo — pipeline completo |
| `supabase/functions/plaud-email-check/index.ts` | Eliminar |
| `supabase/config.toml` | Anadir plaud-intelligence |
