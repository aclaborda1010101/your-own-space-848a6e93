

# Importar las sesiones de WhatsApp que faltan (315 de 837)

## Situacion actual

| Dato | En base de datos | En archivo |
|------|-------------------|------------|
| Contactos de agenda (phone_contacts) | 1.850 | ~1.813 en XLSX |
| Contactos CRM (people_contacts) | 1.162 | -- |
| Mensajes WhatsApp (contact_messages) | 336.062 | 837 sesiones |
| Chats unicos con mensajes | 522 | 837 sesiones |

**Contactos de agenda**: OK, estan todos (incluso hay mas en DB de importaciones anteriores).

**WhatsApp**: Faltan ~315 sesiones de las 837 del archivo. Esto es el problema principal.

## Solucion: deteccion de duplicados en importacion de backup

El sistema de importacion actual (`/data-import`, seccion "backup") NO detecta sesiones ya importadas. Si subes el XLSX de 837 sesiones, duplicara los 336K mensajes existentes.

### Cambio necesario: skip de sesiones ya importadas

Modificar `handleBackupImport()` en `src/pages/DataImport.tsx` para que:

1. **Antes de importar**, consultar `contact_messages` para obtener la lista de `chat_name` unicos que ya tienen mensajes
2. **Para cada chat del backup**, comparar con la lista existente (normalizando el nombre)
3. **Si el chat ya existe**: saltarlo (skip) y contabilizarlo como "ya importado"
4. **Si el chat NO existe**: importarlo normalmente
5. **Mostrar resumen**: "X sesiones importadas, Y sesiones saltadas (ya existian)"

### Cambio adicional: marcar visualmente en la review

En el paso de "review" del backup (`backupStep === 'review'`), antes de importar:

1. Consultar la lista de chats existentes en DB
2. Marcar cada chat con un badge: "Ya importado" (verde) o "Nuevo" (azul)
3. Los chats "Ya importados" se deseleccionan por defecto pero el usuario puede forzar su reimportacion si lo desea

## Archivos a modificar

### `src/pages/DataImport.tsx`

1. **En `handleBackupAnalyze()`**: despues de parsear los chats, consultar `SELECT DISTINCT chat_name FROM contact_messages WHERE user_id = X` y comparar para marcar los ya importados
2. **Anadir propiedad al tipo de chat**: `alreadyImported: boolean` al tipo de chat en la review
3. **En la UI de review**: mostrar badge de estado y deseleccionar los ya importados
4. **En `handleBackupImport()`**: saltar los chats marcados como ya importados (a menos que el usuario los haya seleccionado manualmente)

## Flujo del usuario

```text
1. Ve a /data-import > pestaña WhatsApp > Importacion masiva (backup)
2. Sube el XLSX de 837 sesiones
3. Sistema analiza: detecta 837 sesiones, marca 522 como "Ya importado" y 315 como "Nuevo"
4. Las 315 nuevas estan seleccionadas por defecto
5. Las 522 existentes estan deseleccionadas (pero se pueden seleccionar para reimportar)
6. Click en "Importar seleccionados"
7. Solo se importan las 315 nuevas -> ~60K-100K mensajes nuevos
8. Total en DB: ~400K-430K mensajes, 837 sesiones
```

## Detalle tecnico

```text
// En handleBackupAnalyze, despues de parsear:
const { data: existingChats } = await supabase
  .from('contact_messages')
  .select('chat_name')
  .eq('user_id', user.id);

const existingChatNames = new Set(
  (existingChats || []).map(c => c.chat_name?.toLowerCase().trim())
);

// Marcar cada chat
const chatsWithStatus = chats.map(c => ({
  ...c,
  selected: !existingChatNames.has(c.chatName.toLowerCase().trim()),
  alreadyImported: existingChatNames.has(c.chatName.toLowerCase().trim()),
}));
```

La consulta de chats existentes usa `SELECT DISTINCT chat_name` que con 336K filas puede ser lenta, pero solo se ejecuta una vez al analizar. Alternativa: usar una query con `GROUP BY chat_name` y `LIMIT 5000` para cubrir todos los chats.
