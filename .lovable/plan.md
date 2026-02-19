

# Borrar todos los contactos de la agenda oculta

## Problema
Hay 1812 registros en la tabla `phone_contacts` (agenda oculta) que el usuario quiere eliminar por completo.

## Solucion
Ejecutar una migracion SQL que borre todos los registros de `phone_contacts`.

## Detalle tecnico
- Ejecutar: `DELETE FROM phone_contacts;`
- Esto elimina los 1812 contactos importados de la agenda del telefono
- No afecta a `people_contacts` (contactos del CRM principal)
- No requiere cambios de codigo

