
## Plan: Reprocesar multimedia pendiente de todos los contactos activos

### Qué quieres
Que vaya a `contact_messages` de todos tus contactos de la red estratégica/favoritos, encuentre todos los audios, imágenes y PDFs que llegaron antes de tener el pipeline (o que se quedaron como `[Audio]`, `[Imagen]`, `[Documento]` sin transcribir), y los procese ahora con Whisper/Gemini Vision para que cuenten en headlines y personalidad.

### Diagnóstico previo (lo hago al ejecutar)
Consultaré `contact_messages` para ver cuántos mensajes multimedia sin procesar existen, identificándolos por patrones:
- `content` empieza por `[Audio]`, `[Imagen]`, `[Foto]`, `[Documento]`, `[PDF]`, `[Video]`
- O `content` está vacío/null pero tiene `external_id` (mensaje de Evolution sin texto)
- Filtrados por `user_id = tu_id` y limitados a contactos `is_favorite = true OR in_strategic_network = true`

Esto me dirá el volumen real antes de lanzar nada (puede ser 50 o 5000, cambia la estrategia).

### Solución

**Nueva edge function `reprocess-whatsapp-media-backlog`**
- Input: `{ limit?: number, contactId?: string }` (opcional para probar con 1 contacto primero).
- Lee mensajes candidatos del usuario autenticado (favoritos + estratégicos), ordenados por más recientes primero.
- Para cada mensaje:
  - Si tiene `metadata.evolution_key` (la `messageKey` original de Evolution) → llama a `process-whatsapp-media` reutilizando la lógica que ya funciona.
  - Si NO tiene `evolution_key` (mensajes antiguos importados o sin metadata) → marca como `[⚠️ Multimedia antigua no recuperable]` y sigue (Evolution solo guarda media unas semanas, no podemos recuperar audios de hace meses).
- Procesamiento en background con `EdgeRuntime.waitUntil` + delay de 1.5s entre items para no saturar Groq/Gemini.
- Devuelve inmediatamente `{ queued: N, recoverable: X, unrecoverable: Y }`.

**Verificación previa que voy a hacer**
Antes de implementar miro:
1. La estructura de `contact_messages.metadata` para confirmar si guardamos `evolution_key` (clave para poder pedir el base64 de nuevo).
2. Cuántos mensajes multimedia "huérfanos" hay realmente.
3. Si `evolution-webhook` actual ya guarda esa key (si no, los multimedia futuros sí se podrán reprocesar pero los pasados no).

**Botón en UI** (`RedEstrategica.tsx`)
Junto a "Refrescar perfiles" añado **"Reprocesar multimedia"** que invoca la nueva función. Toast muestra cuántos se han encolado y cuántos no eran recuperables.

### Limitación honesta
Evolution API **no guarda los media para siempre**. Los audios/imágenes que llegaron hace más de ~2-4 semanas probablemente ya no están descargables. Para esos marcaremos el contenido con un aviso claro y JARVIS sabrá ignorarlos. Los recientes (últimas semanas) sí se transcribirán perfectamente.

### Archivos a tocar
- `supabase/functions/reprocess-whatsapp-media-backlog/index.ts` (nueva)
- `supabase/config.toml` (registrar la función)
- `src/pages/RedEstrategica.tsx` (botón nuevo)

### Resultado esperado
Pulsas el botón "Reprocesar multimedia" → en 2-5 minutos todos los audios/imágenes recientes de tus contactos activos pasan por Whisper/Gemini → el siguiente refresh de headlines ya tiene en cuenta lo que dijo tu nena en aquel audio, lo que se vio en aquella foto del cartel, etc.
