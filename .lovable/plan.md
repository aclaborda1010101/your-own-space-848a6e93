
El usuario quiere verificar si hay más contactos con el mismo problema (nombre incorrecto "Agustín" o similar) antes de aplicar el fix.

Voy a:
1. Consultar BD para detectar contactos con nombres "basura" (= waId, numérico puro, o = "Agustín" cuando hay mensajes incoming con `pushName` distinto y válido).
2. Listar los candidatos para corregir en bloque.
3. Aplicar el fix masivo + el cambio estructural en el webhook.

## Plan

**1. Auditoría previa (SELECT)**
Detectar todos los `people_contacts` donde:
- `name` = "Agustín" / "Agustin" / waId puro / numérico, **Y**
- existe al menos un `contact_messages` incoming con `sender` válido (≠ waId, con letras, ≠ "Yo", ≠ "Agustín").

Usaré el sender más frecuente de los mensajes incoming como nombre real candidato.

**2. Migración de corrección masiva**
`UPDATE people_contacts` por cada candidato detectado, asignando el sender más frecuente como `name`. Solo toca filas con nombre "basura" confirmado.

**3. Fix estructural en `supabase/functions/evolution-webhook/index.ts`**
Tras resolver `contactId`, si el mensaje es incoming y `pushName` es válido (tiene letras, ≠ waId, no numérico puro) y el nombre actual del contacto es "basura" (= waId, numérico puro, = "Agustín" o nombre del dueño), auto-actualizar `people_contacts.name = pushName`. Solo en incoming, nunca en outgoing.

**4. Cache-bust** en `src/main.tsx`.

## Qué NO se toca
- Contactos con nombre legítimo manual.
- `wa_id`, `phone_numbers`, favoritos, categoría (excepto Alicia → personal).
- Mensajes ni `contact_id` existentes.
