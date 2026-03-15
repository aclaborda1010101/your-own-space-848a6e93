

## Plan: Carga automática de transcripciones Plaud desde email con clasificación

### Situación actual

- **32 emails de Plaud** en `jarvis_emails_cache` (from `no-reply@plaud.ai`), todos **sin body ni attachments** (IMAP solo descarga envelopes)
- **0 registros** en `plaud_transcriptions`
- La cuenta IMAP es `agustin@hustleovertalks.com` en `imap.ionos.es:993`
- Los emails de Plaud llevan **adjuntos** con la transcripción y resumen
- La tabla `plaud_transcriptions` no tiene campo de clasificación (personal/profesional/familiar)

### Cambios necesarios

**1. Migración DB: Añadir columna `context_type` a `plaud_transcriptions`**

```sql
ALTER TABLE plaud_transcriptions 
ADD COLUMN context_type text DEFAULT 'professional' 
CHECK (context_type IN ('personal', 'professional', 'family'));
```

**2. Nueva Edge Function: `plaud-fetch-transcriptions`**

Función dedicada que:
- Conecta por IMAP a `imap.ionos.es` con credenciales de la cuenta
- Busca emails de `no-reply@plaud.ai` **con body + attachments** (BODY.PEEK[] o bodyParts)
- Para cada email: extrae el body (resumen estructurado) y los adjuntos (transcripción .txt/.md)
- Actualiza `jarvis_emails_cache` con `body_text`, `body_html`, `attachments_meta`
- Crea un registro en `plaud_transcriptions` con título (del subject), transcript_raw (del adjunto), summary_structured (del body)
- **No procesa automáticamente** — deja `processing_status = 'pending_review'` para que el usuario clasifique
- Procesa en lotes de 5 para no agotar CPU (25s timeout)

**3. UI en DataImport.tsx: Sección "Transcripciones Plaud desde Email"**

Reemplazar/ampliar el tab Plaud actual con:

- **Botón "Cargar desde correo"**: invoca `plaud-fetch-transcriptions`
- **Lista de transcripciones cargadas**: muestra título y resumen (snippet del body)
- **Selector de tipo** por cada transcripción: Personal / Profesional / Familiar (radio/select)
- **Botón "Confirmar y procesar"**: actualiza `context_type` en DB, y opcionalmente invoca `plaud-intelligence` para extraer tareas/eventos/oportunidades
- Mantener la opción de subir archivo manual como fallback

**4. Actualizar `plaud-intelligence`**

Recibir opcionalmente `context_type` y guardarlo en la transcripción. El `parsed_data` ya se genera correctamente del body.

### Flujo del usuario

```text
1. Usuario abre DataImport → Tab Plaud
2. Pulsa "Cargar desde correo"
3. Edge function descarga bodies+adjuntos de los 32 emails de Plaud
4. UI muestra lista: [Título] — [Resumen corto] — [Personal/Profesional/Familiar]
5. Usuario clasifica cada una
6. Pulsa "Procesar seleccionadas"
7. Se ejecuta plaud-intelligence para generar sugerencias
```

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `supabase/functions/plaud-fetch-transcriptions/index.ts` | Nueva edge function |
| `supabase/config.toml` | Registrar nueva función |
| `src/pages/DataImport.tsx` | UI de carga, listado y clasificación |
| `supabase/functions/plaud-intelligence/index.ts` | Aceptar `context_type` |
| Migración SQL | Añadir `context_type` a `plaud_transcriptions` |

