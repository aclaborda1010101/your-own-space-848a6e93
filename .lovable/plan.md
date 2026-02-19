

# Borrar todos los contact_messages

## Accion
Ejecutar un DELETE sobre la tabla `contact_messages` para vaciarla y poder reimportar sin duplicados.

## Detalle tecnico
- SQL: `DELETE FROM contact_messages;`
- No requiere cambios de codigo
- Despues de ejecutar, puedes reimportar el backup XLSX limpiamente

