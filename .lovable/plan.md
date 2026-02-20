

# Fix: "Sin contacto reciente" para todos los contactos

## Problema

El campo `last_contact` esta `NULL` en los 1141 contactos de la base de datos. Nunca se actualizo durante las importaciones de WhatsApp. Esto causa que todos los contactos muestren "Sin contacto reciente" aunque tengan miles de mensajes (Xuso tiene 1690, Raul tiene mensajes hasta febrero 2026).

Los datos existen en `contact_messages` - por ejemplo Xuso Carbonell tiene su ultimo mensaje el 18 de febrero 2026, pero `people_contacts.last_contact` sigue en NULL.

## Solucion en 2 partes

### Parte 1: Migracion SQL - rellenar `last_contact` con datos existentes

Ejecutar un UPDATE masivo que calcule `last_contact` a partir de `contact_messages`:

```text
UPDATE people_contacts pc
SET last_contact = sub.last_msg
FROM (
  SELECT contact_id, MAX(message_date) as last_msg
  FROM contact_messages
  WHERE contact_id IS NOT NULL
  GROUP BY contact_id
) sub
WHERE pc.id = sub.contact_id
  AND sub.last_msg IS NOT NULL;
```

Esto rellena de golpe el campo para todos los contactos que tengan mensajes.

### Parte 2: Codigo - actualizar `last_contact` en futuras importaciones

**Archivo:** `src/pages/StrategicNetwork.tsx` (y/o `src/hooks/useOnboarding.tsx`, `src/pages/DataImport.tsx`)

En todos los flujos de importacion de WhatsApp, despues de insertar mensajes, actualizar `last_contact` del contacto con la fecha del mensaje mas reciente:

```typescript
// Despues de insertar mensajes para un contacto
const lastMessageDate = messages[messages.length - 1]?.messageDate;
if (contactId && lastMessageDate) {
  await supabase
    .from('people_contacts')
    .update({ last_contact: lastMessageDate })
    .eq('id', contactId);
}
```

Esto asegura que futuras importaciones mantengan el campo actualizado.

## Resultado esperado

- Xuso Carbonell mostrara "hace 2 dias" en vez de "Sin contacto reciente"
- Raul y todos los demas contactos con mensajes mostraran su fecha real de ultimo contacto
- Las futuras importaciones mantendran el campo actualizado automaticamente
