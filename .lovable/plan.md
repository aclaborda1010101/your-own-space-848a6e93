

## Plan: Soporte de importación masiva para TXT en formato bloque

### Problema

El archivo subido (`WhatsApp_-_844_sesiones_de_chat.txt`, 2.2M líneas) usa el formato de bloques con separadores `----`. El flujo de backup (`handleBackupAnalyze` / `handleBackupImport`) solo soporta CSV — llama a `parseBackupCSVByChat` y `extractMessagesFromBackupCSV`, que no entienden el formato bloque.

La diferencia 887→667 chats se debe a que ~220 chats solo contienen notificaciones del sistema (cifrado, "Fuiste añadido", etc.) que el parser actual descarta. Esos chats quedan con 0 mensajes y no aparecen.

### Cambios

**1. `src/lib/whatsapp-block-parser.ts`** — Añadir `parseBlockFormatByChat()`

Nueva función que agrupa mensajes por `chatName` (la línea después del separador), devolviendo `ParsedBackupChat[]` — mismo formato que `parseBackupCSVByChat`. Incluye:
- Contar notificaciones como mensajes válidos (no skip)
- Parsear headers de notificación sin contactName (formato `YYYY-MM-DD HH:MM:SS notification` sin ` - `)
- Agrupar por el nombre del chat (línea 2 de cada bloque)

Actualizar `parseBlockFormatTxt` para no descartar notificaciones ni mensajes vacíos (consistente con CSV).

**2. `src/pages/DataImport.tsx`** — `handleBackupAnalyze`

Después de leer el texto del archivo, detectar formato bloque con `detectBlockFormat(text)`:
- Si es bloque: usar `parseBlockFormatByChat(text, myIdentifiers)` en vez de `parseBackupCSVByChat`
- Guardar un flag (`isBlockFormat`) en estado para usarlo en la importación

**3. `src/pages/DataImport.tsx`** — `handleBackupImport`

Si `isBlockFormat`:
- Usar `parseBlockFormatTxt(text, '', myIdentifiers)` en vez de `extractMessagesFromBackupCSV`
- El resto del flujo (agrupar por chat, crear batches, enviar a edge function) queda igual

**4. Fix HEADER_REGEX** para notificaciones

Actualizar la regex para que las líneas de notificación (`2022-06-16 11:52:05 notification`) sin ` - contactName` también sean capturadas:
```
/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(from|to|notification)(?:\s+(.+?)(?:\s+\([\+\d]+\))?\s*-\s*.+)?$/i
```
Esto hace que el grupo de contactName sea opcional para notificaciones.

### Resultado esperado

- Los 887 chats del TXT serán detectados (incluyendo los que solo tienen notificaciones)
- El flujo completo de análisis → selección → importación por lotes funcionará con archivos TXT bloque
- Compatible con el sistema existente de background jobs

