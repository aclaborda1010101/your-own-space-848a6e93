

# Plan: Búsqueda inteligente JARVIS (Plaud + aliases) + Extracción de adjuntos Plaud

## Dos problemas claros

1. **JARVIS no busca en Plaud**: Solo tiene `search_whatsapp_messages` (tabla `contact_messages`). Las transcripciones de Plaud están en `plaud_transcriptions` y `conversation_embeddings` — el agente no las consulta.

2. **JARVIS no resuelve aliases**: Si escribes "mi madre", "dani carvajal" o "mi padre", la búsqueda fuzzy (`pg_trgm`) falla porque "madre" no tiene similitud con "mama". Necesita un paso previo de resolución de aliases familiares y nombres parciales.

3. **Los adjuntos de Plaud NO se extraen**: El `email-sync` detecta emails Plaud pero NO descarga los archivos `.txt` adjuntos donde va la transcripción real. La función `fetchGmailTxtAttachment` del plan anterior no llegó a implementarse.

---

## Cambio 1: Nueva herramienta `search_plaud_transcriptions` en JARVIS

**Archivo**: `supabase/functions/jarvis-agent/index.ts`

- Añadir tool definition `search_plaud_transcriptions` con params `query` y `contact_name` (opcional).
- Implementación `executeSearchPlaudTranscriptions`:
  - Busca en `plaud_transcriptions` por `ilike` en `transcript_raw` y `summary_structured`.
  - También busca en `conversation_embeddings` con `ilike` en `content`.
  - Si hay `contact_name`, resuelve a IDs y filtra por `linked_contact_ids`.
  - Devuelve fecha, título y fragmento relevante (max 6000 chars).
- Registrar en `executeTool` switch.

## Cambio 2: Resolución de aliases familiares y nombres parciales

**Archivo**: `supabase/functions/jarvis-agent/index.ts`

- Crear función `resolveContactName(sb, userId, rawName)` que:
  1. Intenta `ilike` directo con `%rawName%`.
  2. Si falla, consulta un mapa de aliases: `madre→mama/mamá/mami`, `padre→papa/papá/papi`, etc.
  3. Para nombres como "dani carvajal", busca con `ilike` cada parte por separado si el nombre completo no matchea.
  4. Fallback final: `search_contacts_fuzzy` con threshold 0.25.
  5. Devuelve los contactos encontrados + un mensaje indicando la resolución (ej: "No encontré 'madre' pero encontré 'Mama'").
- Usar esta función en `executeSearchWhatsAppMessages` y `executeSearchPlaudTranscriptions`.

## Cambio 3: Actualizar System Prompt

**Archivo**: `supabase/functions/jarvis-agent/index.ts`

- Añadir al `SYSTEM_PROMPT`:
  - "TRANSCRIPCIONES PLAUD: Tienes acceso a grabaciones de voz. Si te preguntan sobre conversaciones presenciales, reuniones, o datos que no están en WhatsApp, USA search_plaud_transcriptions."
  - "ALIASES: Cuando el usuario diga 'mi madre', 'mi padre', 'dani carvajal', etc., pásalo directamente como contact_name. El sistema resolverá automáticamente el nombre real."
  - "BÚSQUEDA COMBINADA: Para preguntas como '¿cuándo le hicieron el TAC a mi madre?', usa AMBAS herramientas."

## Cambio 4: Extracción de adjuntos .txt en email-sync (Gmail)

**Archivo**: `supabase/functions/email-sync/index.ts`

- Cuando un email se clasifica como `plaud_transcription` y tiene partes con `filename` que termine en `.txt` o `.md`:
  - Gmail: Usar `GET messages/{id}/attachments/{attachmentId}` para descargar el contenido base64url.
  - Decodificar y usar como `body_text` (reemplaza el body vacío/corto).
- Para IMAP: Intentar fetch de partes MIME adicionales (`2`, `3`) que contengan el adjunto inline.

---

## Archivos a modificar

1. `supabase/functions/jarvis-agent/index.ts` — Nueva tool + aliases + prompt
2. `supabase/functions/email-sync/index.ts` — Extracción de adjuntos Gmail para Plaud

