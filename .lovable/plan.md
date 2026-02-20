

# Corregir contador inconsistente de wa_message_count

## Problema
La purga masiva borró todos los registros de `contact_messages` (0 filas), pero el contacto "Carls Primo" mantiene `wa_message_count = 17487`. Esto causa que aparezca en la lista pero sin datos reales para analizar.

## Causa
El UPDATE de la migración anterior no afectó a este registro (posible race condition o reimportación posterior).

## Solución
Ejecutar un UPDATE forzado para resetear TODOS los `wa_message_count` a 0, sin excepción:

```text
UPDATE people_contacts SET wa_message_count = 0 WHERE wa_message_count > 0;
```

## Resultado esperado
- La lista de contactos quedará vacía (solo aparecerán los que tengan hilos Plaud)
- Al reimportar chats individuales desde /data-import, los contactos irán apareciendo con datos reales

## Archivos a modificar
Ninguno. Solo una operación SQL de datos.

