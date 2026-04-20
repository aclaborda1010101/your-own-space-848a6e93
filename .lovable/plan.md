

## Diagnóstico confirmado

Ayer hice una fusión equivocada: el contacto "Dani" duplicado que metí dentro de **Adolfo Alvaro Benito** era en realidad **Daniel de Carvajal**. Resultado:

1. El número `34655442802` (que es de Daniel Carvajal) está mal asignado al contacto Adolfo.
2. Los mensajes recientes de Daniel sobre **Farmamatch** ("grupo de farmamatch", "lo monto ahora", "que tal", del 6, 7 y 20 de abril 2026) están dentro de la ficha de Adolfo.
3. La ficha de Daniel Carvajal (`0c157af8-a512-4a82-b533-688d13f20f99`) se quedó sin wa_id y sin esos mensajes.
4. Cualquier mensaje nuevo que entre desde el WhatsApp de Daniel se sigue metiendo en Adolfo.

Los mensajes históricos de Adolfo (Toledo, luxpurple, 2022-enero 2026) **sí son suyos** y se quedan donde están.

## Plan de reparación

### 1. Identificar exactamente qué mensajes son de Daniel y cuáles de Adolfo
Criterio:
- Todos los mensajes con `external_id IS NOT NULL` (los 7 que entraron por Evolution el 20-abril) → **Daniel**.
- Todos los mensajes con `sender = 'Dani'` → **Daniel**.
- Todos los mensajes outgoing que mencionen "farmamatch" → **Daniel**.
- Resto (mensajes con `sender = 'Adolfo Alvaro Benito'`, "luxpurple", "Toledo", grupos antiguos) → **Adolfo, se queda**.

### 2. Mover esos mensajes de Adolfo → Daniel Carvajal
Migración SQL puntual que reasigna `contact_id` de los mensajes mal ubicados al id de Daniel Carvajal (`0c157af8-a512-4a82-b533-688d13f20f99`).

### 3. Mover el wa_id al dueño correcto
- Quitar `wa_id = '34655442802'` de Adolfo.
- Ponerlo en Daniel de Carvajal.
- Así el `evolution-webhook` rutea los próximos mensajes al contacto correcto.

### 4. Recalcular `last_contact` de ambos
El trigger ya lo hace al insertar, pero aquí hago un UPDATE manual para los dos contactos basado en sus mensajes reales.

### 5. Endurecer el webhook para que esto no vuelva a pasar
El bug raíz: cuando llega un mensaje de un wa_id nuevo, el webhook hace fuzzy-match por nombre ("Dani" → "Adolfo Alvaro Benito" o similar) y mete los mensajes ahí en vez de crear contacto nuevo. Dos cambios:
- **Match estricto por nombre solo si es exacto** (sin contains "Dani" → "Daniel" → "Daniela").
- Si no hay match exacto y el `pushName` es genérico tipo "Dani", crear contacto nuevo en vez de fusionar.

### 6. Validación
- Comprobar que la ficha de Adolfo en `/red-estrategica/0fcf785d...` ya no tiene los mensajes de Farmamatch.
- Comprobar que Daniel de Carvajal ahora tiene wa_id y esos 7 mensajes recientes.
- Mandar un mensaje de prueba a Daniel desde WhatsApp y verificar que aterriza en Daniel, no en Adolfo.

## Archivos a tocar
- Nueva migración SQL para reasignar mensajes y mover wa_id.
- `supabase/functions/evolution-webhook/index.ts` para endurecer el matching de contactos.

## Resultado esperado
- Adolfo vuelve a su histórico real (Toledo, luxpurple, grupos viejos).
- Daniel de Carvajal recupera su wa_id y sus mensajes recientes de Farmamatch.
- El próximo mensaje del 34655442802 entra correctamente en Daniel.
- El webhook deja de fusionar contactos por coincidencias parciales de nombre.

