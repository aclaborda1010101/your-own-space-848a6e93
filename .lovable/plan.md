
## Plan: pipeline multimedia WhatsApp (audio + imagen + PDF)

### Objetivo
Que JARVIS procese automáticamente lo que llega por WhatsApp más allá del texto: audios → transcripción, imágenes → OCR + descripción, PDFs → texto extraído. Todo se guarda en `contact_messages` para que cuente en headlines, personalidad y RAG.

### Arquitectura

```text
evolution-webhook (rápido, no bloquea)
   │
   ├─ texto → flujo actual (sin cambios)
   │
   └─ audio/imagen/document detectado
        │
        ├─ inserta placeholder en contact_messages: "[⏳ Procesando audio…]"
        └─ EdgeRuntime.waitUntil( process-whatsapp-media )
                │
                ├─ fetch base64 vía Evolution API /chat/getBase64FromMediaMessage
                ├─ audio  → Groq Whisper  → "[🎙️ Audio] {transcripción}"
                ├─ imagen → Gemini Vision → "[🖼️ Imagen] {descripción + OCR}"
                ├─ pdf    → pdf.js/text   → "[📎 PDF: nombre] {texto}"
                └─ UPDATE contact_messages SET content = ... WHERE id = placeholderId
```

### Cambios

**1. `evolution-webhook/index.ts`** — detección y derivación
- Detectar `audioMessage`, `imageMessage`, `documentMessage`, `videoMessage` en `messages.upsert`.
- Insertar placeholder inmediato (`[⏳ Procesando {tipo}…]`) con `external_id` real para mantener idempotencia.
- Disparar `process-whatsapp-media` con `EdgeRuntime.waitUntil` (no bloquea webhook, no rompe ACK a Evolution).

**2. Nueva edge function `process-whatsapp-media/index.ts`**
- Input: `{ messageId, contactId, userId, instance, evolutionMessageKey, mediaType, caption }`.
- Llama `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/{instance}` con la key del mensaje.
- Según `mediaType`:
  - `audio`: POST a `https://api.groq.com/openai/v1/audio/transcriptions` (whisper-large-v3, lang `es`).
  - `image`: POST a Lovable AI Gateway con `google/gemini-3-flash-preview` y mensaje multimodal `image_url` base64 → pide descripción breve + OCR de cualquier texto visible.
  - `document` (pdf): si MIME es pdf → extraer texto con pdf.js (deno-compatible) o Gemini Vision como fallback; si es otro tipo → guardar `[📎 Documento: nombre]`.
  - `video`: por ahora `[🎬 Vídeo recibido]` (transcribir vídeo es caro; lo dejamos fuera del MVP).
- `UPDATE contact_messages SET content = '<prefijo> <texto>' WHERE id = messageId`.
- Si todo falla tras retries → `[⚠️ {tipo} no procesable]` (no se queda colgado en "procesando").

**3. UI mínima (sin pantalla nueva)**
- En `ContactTabs.tsx > WhatsAppTab` la lista de mensajes ya muestra `content`. Los prefijos `[🎙️] [🖼️] [📎]` los hacen reconocibles sin componente extra.
- (Opcional, fuera de MVP) un badge especial cuando el contenido empieza por esos prefijos. Lo dejo para una segunda iteración para no inflar este cambio.

**4. Headlines / personalidad**
- `get-contact-headlines` y `contact-analysis` ya leen `contact_messages.content`, así que el texto transcrito/descrito entra automáticamente al análisis. Cero cambios ahí.

### Secrets
- `GROQ_API_KEY` → ya existe (lo usa `jarvis-hybrid-voice`).
- `LOVABLE_API_KEY` → ya existe (Vision).
- `EVOLUTION_API_URL` + `EVOLUTION_API_KEY` → ya existen.

Nada nuevo que pedir.

### Resiliencia
- `fetchWithRetry` (ya en uso para Evolution) en la llamada a `getBase64FromMediaMessage`.
- Timeout de 60s por media (Whisper/Vision son rápidos; si tarda más, marcamos como no procesable).
- Idempotencia: el placeholder se inserta con `external_id` antes del `waitUntil`, así si Evolution reenvía el evento detectamos duplicado igual que con texto.
- Tamaño: si base64 > 8 MB (audios largos, vídeos) → no procesar (`[⚠️ Demasiado grande]`).

### Memoria a actualizar
Tras desplegar: actualizar `mem://integraciones/whatsapp-personal-limitacion-multimedia-v1` para reflejar que el límite ya no aplica a audio/imagen/pdf (solo a vídeo).

### Resultado esperado
Cuando alguien te mande por WhatsApp un audio explicando algo, una foto de un cartel, o un PDF de presupuesto: en ~5–15 s el mensaje aparecerá en el chat del contacto con su transcripción/descripción/texto, y JARVIS lo tendrá en cuenta en el siguiente headline y en su personalidad de ese contacto.
