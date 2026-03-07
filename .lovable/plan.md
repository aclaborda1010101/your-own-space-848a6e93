

## Sincronizar `wa_message_count` con datos reales

El campo `wa_message_count` en `people_contacts` no coincide con el COUNT real de filas en `contact_messages` (ej: Carls Primo muestra 2,575 pero tiene 7,945 mensajes reales). Esto ocurre porque múltiples importaciones suman/sobrescriben el campo de forma inconsistente.

### Solución

Ejecutar un UPDATE masivo que recalcule `wa_message_count` para todos los contactos basándose en el COUNT real de `contact_messages` donde `source = 'whatsapp'`.

```sql
UPDATE people_contacts pc
SET wa_message_count = sub.real_count
FROM (
  SELECT contact_id, COUNT(*) AS real_count
  FROM contact_messages
  WHERE source = 'whatsapp'
  GROUP BY contact_id
) sub
WHERE pc.id = sub.contact_id
  AND (pc.wa_message_count IS DISTINCT FROM sub.real_count);
```

Se ejecutará como operación de datos (INSERT tool), no como migración de esquema.

### Archivo: ninguno
No requiere cambios de código. Solo una operación de datos en Supabase.

