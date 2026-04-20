

El usuario lo ha clavado: el problema raíz es que **muchos contactos antiguos no tienen `wa_id` rellenado**, así que cuando llega un mensaje de WhatsApp, el webhook no los encuentra por teléfono y acaba creando duplicados o metiendo el mensaje en el sitio equivocado.

Necesito:
1. Detectar cuántos contactos tienen teléfono "humano" pero `wa_id` vacío.
2. Rellenar `wa_id` automáticamente desde los teléfonos que ya tenemos guardados (campo `phone_numbers`, `metadata.phones`, etc).
3. Después de eso, fusionar los duplicados que el webhook ya creó (contactos sin nombre o con `pushName` genérico que en realidad son una persona ya existente).
4. Limpiar caches de IA contaminadas (`contact_headlines`) para los afectados.
5. Simplificar el webhook para que sea **estrictamente por teléfono**, sin fuzzy matching de nombre.

## Plan

### 1. Diagnóstico exprés
Antes de tocar nada, lanzo dos consultas para saber el tamaño del problema:
- Cuántos contactos tienen `phone_numbers` no vacío pero `wa_id IS NULL`.
- Cuántos contactos "fantasma" hay (creados por webhook con nombre tipo número o pushName corto) que tienen `wa_id` que coincide con teléfono de un contacto real.

### 2. Backfill masivo de `wa_id`
Migración SQL que para cada contacto sin `wa_id`:
- Coge el primer teléfono válido de `phone_numbers` (o de `metadata->>phone`).
- Lo normaliza (solo dígitos, prefijo país si falta).
- Lo guarda en `wa_id` siempre que no colisione con otro contacto que ya lo tenga.

Si hay colisión (otro contacto ya tiene ese `wa_id`), no sobrescribe; lo marca para revisión manual en una tabla de log temporal.

### 3. Fusión automática de duplicados creados por el webhook
Para los casos en los que el webhook ya creó un "Dani" / "Juan" / número suelto que coincide con un contacto real:
- Detectar pares: contacto A real (con teléfono) + contacto B fantasma (con `wa_id` igual al teléfono de A).
- Mover los mensajes de B → A.
- Mover el `wa_id` a A (si no lo tenía).
- Borrar el contacto fantasma B.
- Recalcular `last_contact` de A.

### 4. Invalidar caches contaminadas
- Borrar `contact_headlines` de todos los contactos tocados en pasos 2 y 3, para que se regeneren con los datos correctos la próxima vez que se abran.

### 5. Endurecer el webhook (`evolution-webhook`)
Cambiar la lógica de matching a **estrictamente por teléfono**:
- 1º `wa_id` exacto.
- 2º últimos 9 dígitos del `wa_id` contra `wa_id` y contra `phone_numbers`.
- 3º búsqueda en `phone_numbers` con normalización.
- Si no hay match por teléfono → **crear contacto nuevo siempre**, nunca por nombre.

Eliminar todo el bloque de fuzzy match por `pushName`. El nombre solo se usa para rellenar `name` al crear el contacto nuevo, jamás para fusionar con uno existente.

### 6. Validación
- Verificar que en Red Estratégica los contactos clave (Adolfo, Daniel, etc.) muestran `last_contact` actualizado y sin sugerencias de otra persona.
- Mandar un mensaje de prueba desde un número conocido y comprobar que aterriza en el contacto correcto sin duplicar.

## Archivos que toco

- Nueva migración SQL para:
  - Backfill de `wa_id` desde `phone_numbers`.
  - Fusión de duplicados detectados.
  - Limpieza de `contact_headlines` afectadas.
- `supabase/functions/evolution-webhook/index.ts` para quitar el fuzzy match por nombre.

## Resultado esperado

- Todos los contactos antiguos con teléfono pasan a tener `wa_id` correcto.
- Los duplicados que ya se habían creado se fusionan en su contacto real.
- Cualquier mensaje futuro entra por teléfono al contacto correcto, sin merges raros.
- Las sugerencias de IA dejan de mezclar conversaciones de personas distintas.

