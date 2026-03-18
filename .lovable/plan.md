

# Plan: Pestañas Nuevos/Procesados en Plaud + Descarga de adjuntos de transcripción

## Resumen

Hay dos problemas independientes:
1. **UI**: La sección Plaud necesita dos pestañas ("Nuevos" / "Procesados") para separar transcripciones pendientes de las ya procesadas. Las eliminadas no deben reaparecer.
2. **Backend**: Los emails de Plaud contienen transcripciones como **adjuntos** (archivos .txt/.pdf), no en el cuerpo del email. El sistema actual solo extrae el body text, que suele estar vacío o ser un resumen corto → "Cuerpo pendiente de sincronización". Necesitamos descargar y extraer el contenido de los adjuntos.

---

## Cambio 1: Pestañas Nuevos / Procesados en UI

**Archivo**: `src/pages/DataImport.tsx`

- Dentro del `TabsContent value="plaud"`, añadir sub-tabs con `Tabs` de shadcn:
  - **Nuevos**: Filtra `plaudTranscriptions` donde `processing_status !== "completed"`. Muestra las tarjetas actuales con los botones Procesar/Eliminar.
  - **Procesados**: Filtra `plaudTranscriptions` donde `processing_status === "completed"`. Muestra las tarjetas en modo solo lectura (sin botón Procesar, solo Eliminar).
- Badge con contador en cada pestaña.
- El botón "Cargar desde correo" se mantiene fuera de las sub-tabs (arriba).
- La lógica de dismiss (`plaud_dismissed_emails`) ya existe y funciona correctamente para evitar que los eliminados reaparezcan.

---

## Cambio 2: Descargar adjuntos de emails Plaud vía IMAP/Gmail

**Problema raíz**: Plaud envía la transcripción como archivo adjunto (.txt, .pdf, .docx). El `email-sync` detecta estos emails como `plaud_transcription` y fetcha el body, pero el body solo contiene un resumen corto o está vacío. La transcripción real está en el attachment.

### 2a. Extraer contenido de adjuntos IMAP en `email-sync`

**Archivo**: `supabase/functions/email-sync/index.ts`

- Cuando se detecta un email tipo `plaud_transcription`, además de buscar el body en `TEXT/1/1.1/2`, también buscar partes MIME que sean adjuntos de texto (`.txt`, `text/plain` con `Content-Disposition: attachment`).
- Para adjuntos `.txt`: decodificar el contenido (base64 o quoted-printable) y concatenarlo al `body_text`.
- Para adjuntos `.pdf`/`.docx`: almacenar los metadatos del adjunto pero no el contenido (limitación del edge function).
- Guardar el texto extraído del adjunto en `body_text` del cache.

### 2b. Extraer adjuntos Gmail

**Archivo**: `supabase/functions/email-sync/index.ts`

- Gmail provee `attachmentId` en los metadatos. Para emails Plaud, hacer un fetch adicional a `GET /gmail/v1/users/me/messages/{id}/attachments/{attachmentId}` para descargar el contenido del adjunto `.txt`.
- Decodificar el base64url y concatenar al `body_text`.

### 2c. Mejorar `plaud-fetch-transcriptions` para usar adjuntos

**Archivo**: `supabase/functions/plaud-fetch-transcriptions/index.ts`

- Cuando se procesa un email con `has_attachments: true` y `attachments_meta` contiene archivos `.txt`, intentar usar ese contenido como `transcript_raw` en lugar del body.
- Si el adjunto no se pudo extraer durante sync, marcar como `body_pending` pero con un mensaje más descriptivo: "Adjunto pendiente de descarga".

---

## Detalle técnico

### Sub-tabs UI (DataImport.tsx)
```text
┌──────────────────────────────────────┐
│ [Cargar desde correo]                │
│                                      │
│  ┌─────────┐  ┌────────────┐        │
│  │ Nuevos 5│  │ Procesados 3│       │
│  └─────────┘  └────────────┘        │
│                                      │
│  (tarjetas filtradas por status)     │
└──────────────────────────────────────┘
```

### IMAP attachment fetch (email-sync)
- Añadir bodyPart `"HEADER"` o partes numéricas adicionales (`"2"`, `"3"`) para buscar adjuntos.
- Detectar MIME type `text/plain` con `filename` → es el adjunto de transcripción.
- Decodificar y guardar en `body_text`.

### Gmail attachment fetch (email-sync)  
- En `fetchGmailMessages`, cuando un email es `plaud_transcription` y tiene adjuntos `.txt`:
  - Fetch `GET messages/{id}/attachments/{attachmentId}`
  - Decode base64url → texto
  - Concatenar a `body_text`

---

## Archivos a modificar

1. `src/pages/DataImport.tsx` — Sub-tabs Nuevos/Procesados
2. `supabase/functions/email-sync/index.ts` — Extraer adjuntos para Plaud emails (IMAP + Gmail)
3. `supabase/functions/plaud-fetch-transcriptions/index.ts` — Usar adjuntos como transcript_raw

