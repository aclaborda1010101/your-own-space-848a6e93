
# Fix: wa_message_count en 0 para contactos con mensajes

## Problema

Raul Agustito tiene 870 mensajes en `contact_messages` vinculados a su contacto, y `last_contact` se actualizo correctamente con la migracion anterior. Sin embargo, `wa_message_count` sigue en 0.

La UI depende de `wa_message_count` para:
- Mostrar el badge "870 msgs WA" junto al nombre
- Filtrar contactos "activos" vs inactivos
- Ordenar contactos por cantidad de mensajes
- Mostrar "Sin WhatsApp vinculado" cuando es 0

Esto afecta a todos los contactos, no solo a Raul.

## Solucion

### Migracion SQL: rellenar wa_message_count desde contact_messages

Ejecutar un UPDATE masivo que calcule el conteo real de mensajes para cada contacto:

```sql
UPDATE people_contacts pc
SET wa_message_count = sub.msg_count
FROM (
  SELECT contact_id, COUNT(*) as msg_count
  FROM contact_messages
  WHERE contact_id IS NOT NULL
  GROUP BY contact_id
) sub
WHERE pc.id = sub.contact_id;
```

Esto recalcula `wa_message_count` para todos los contactos que tengan mensajes vinculados.

No se necesitan cambios en el codigo frontend - la UI ya usa `wa_message_count` correctamente. El unico problema es que el dato estaba en 0 en la base de datos.

## Resultado esperado

- Raul Agustito mostrara "870 msgs WA" en lugar de aparecer sin mensajes
- Todos los contactos con mensajes tendran su conteo correcto
- El filtro "activos" funcionara correctamente
- El ordenamiento por cantidad de mensajes sera preciso
