

# Reimportar mensajes de Carls Primo (prueba)

## Situacion actual

Los 24.458 mensajes de Carls Primo (distribuidos en ~30 chats diferentes) contienen solo timestamps como `"2022-10-06 12:49:12"` en el campo `content`. El parser ya esta corregido con validacion de columnas.

## Plan

### Paso 1: Borrar mensajes corruptos de Carls Primo

Ejecutar un DELETE en `contact_messages` para el contact_id `32f8bd4f-37ac-4000-b4b2-5efafb004927`. Tambien resetear `wa_message_count` a 0 en `people_contacts`.

### Paso 2: Anadir boton "Purgar y reimportar" en la UI

En la seccion de backup de `DataImport.tsx`, anadir un boton visible que permita:
- Borrar todos los mensajes existentes de un contacto antes de reimportar
- Esto evita duplicados al reimportar

### Paso 3: Reimportar

Tu subes de nuevo el CSV del backup de WhatsApp en la pagina /data-import, seleccionas los chats de Carls Primo y los importas. El parser corregido detectara la columna correcta de mensaje.

### Paso 4: Verificar

Despues de importar, consultar `contact_messages` para confirmar que el `content` contiene texto real y no timestamps.

## Detalles tecnicos

### Datos a borrar (via SQL directo)
```text
DELETE FROM contact_messages WHERE contact_id = '32f8bd4f-37ac-4000-b4b2-5efafb004927';
UPDATE people_contacts SET wa_message_count = 0 WHERE id = '32f8bd4f-37ac-4000-b4b2-5efafb004927';
```

### Archivos a modificar
- `src/pages/DataImport.tsx` — Anadir logica para que al reimportar un chat que ya tiene mensajes, pregunte si quiere borrar los existentes primero (o los borre automaticamente si detecta que son corruptos)

### Validacion post-importacion
Despues de importar verificaremos con:
```text
SELECT content, LENGTH(content) FROM contact_messages 
WHERE contact_id = '32f8bd4f-...' 
ORDER BY RANDOM() LIMIT 10
```
Si el contenido tiene texto real (longitud variable, no solo 19 chars), la correccion funciona y procedemos a reimportar todos los contactos.

