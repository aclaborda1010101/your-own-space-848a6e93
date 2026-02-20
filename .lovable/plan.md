

# Purgar todos los mensajes corruptos y preparar reimportación masiva

## Situación actual

- **557.206 mensajes** en **1.053 contactos** — todos corruptos (avg length = 19 chars = timestamps)
- El parser ya está corregido con validación de columnas (`looksLikeDate` + `findRealMessageColumn`)
- Solo necesitamos limpiar la base de datos y reimportar

## Plan

### Paso 1: Borrar todos los mensajes corruptos

Ejecutar via migración SQL:

```text
DELETE FROM contact_messages;
UPDATE people_contacts SET wa_message_count = 0 WHERE wa_message_count > 0;
```

Esto borra los 557K registros corruptos y resetea los contadores.

### Paso 2: Reimportar

Ir a `/data-import`, subir el CSV del backup de WhatsApp, seleccionar todos los chats y importar. El parser corregido asignará la columna correcta de mensaje.

### Paso 3: Verificar

Tras importar, consultar una muestra para confirmar que el `content` tiene texto real.

## Detalles técnicos

### Archivos a modificar
- Ninguno — solo una migración SQL para el DELETE masivo

### Migración SQL
```text
DELETE FROM contact_messages;
UPDATE people_contacts SET wa_message_count = 0 WHERE wa_message_count > 0;
```

