

# Borrar todos los mensajes de WhatsApp para reimportacion individual

## Situacion actual
- 996,857 mensajes en contact_messages
- 997 contactos con wa_message_count > 0

## Plan

### Paso 1: Borrar todos los mensajes
Ejecutar DELETE masivo sobre `contact_messages` y resetear contadores en `people_contacts`.

### Paso 2: Borrar sugerencias de vinculacion pendientes
Limpiar tambien `contact_link_suggestions` para evitar residuos de importaciones anteriores.

## Detalles tecnicos

### Archivos a modificar
- Ninguno, solo operaciones de datos via SQL

### Operaciones SQL
```text
DELETE FROM contact_messages;
UPDATE people_contacts SET wa_message_count = 0 WHERE wa_message_count > 0;
DELETE FROM contact_link_suggestions;
```

Tras ejecutar esto, la base queda limpia y lista para importar chats uno a uno desde `/data-import`.
