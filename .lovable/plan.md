

## Diagnóstico: 587K vs 299K mensajes importados

### Causa raíz

El parser client-side (`extractMessagesFromBackupCSV`) descarta ~288K filas del CSV por tres filtros:

1. **Notificaciones del sistema** (`dirClass === 'notification'`) — mensajes tipo "X cambió el asunto del grupo", "X se unió", cifrado de extremo a extremo, etc. Estos se descartan en línea 738.
2. **Mensajes sin contenido** — filas donde la columna `message` está vacía Y no hay `mediaType`. Descartados en línea 748.
3. **Filas malformadas** — filas con menos de 3 columnas (`cols.length < 3`), línea 732.

La diferencia de ~288K mensajes se explica casi seguro por notificaciones del sistema y mensajes multimedia sin texto (imágenes/vídeos/audios que en el CSV aparecen con la columna mensaje vacía y sin tipo de medio mapeado).

### Plan para capturar los mensajes faltantes

**Cambios en `src/lib/whatsapp-file-extract.ts`** (función `extractMessagesFromBackupCSV`):

1. **No descartar notificaciones** — en lugar de `continue`, marcarlas con `direction: 'notification'` y `sender: 'Sistema'` para que se almacenen como contexto.
2. **Capturar mensajes multimedia vacíos** — si `content` está vacío pero existe una columna de archivo multimedia (`media_file`), generar contenido tipo `[Archivo multimedia]` en vez de saltar la fila.
3. **Añadir columna `media_file` al `BackupColumnMap`** — detectar la columna de nombre de archivo multimedia para capturar adjuntos.

**Cambios en `supabase/functions/import-whatsapp-backup/index.ts`**:
- Aceptar `direction: 'notification'` sin error.

**Cambios en la tabla `contact_messages`** (migración):
- Confirmar que `direction` acepta valores distintos a `incoming`/`outgoing` o almacenar notificaciones como `incoming`.

### Resultado esperado

Con estos cambios, una reimportación capturaría los ~587K mensajes completos del CSV. El usuario deberá limpiar los 299K actuales antes de reimportar (o hacer upsert).

### Alternativa rápida (sin reimportar)

Si el usuario no quiere reimportar, simplemente aceptar que los 299K son los mensajes de texto reales (sin notificaciones ni multimedia vacía), que son los útiles para análisis y CRM. Los 587K incluyen ruido del sistema.

