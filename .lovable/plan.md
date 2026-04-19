

## Problema

En la pestaña por defecto del contacto (Alicia → `/red-estrategica/:id`), la "Línea del tiempo" agrupa los mensajes por mes y muestra solo 8 por mes con `msgs.slice(0, 8)`. Como los mensajes en `ContactDetail.load()` se cargan `desc` y luego se invierten a `asc` (más antiguos primero), el slice devuelve los **8 más antiguos del mes**, no los más recientes. Por eso "faltan los WhatsApp de ayer y hoy" aunque están en BD (verificado: 17 mensajes hoy 19 abr en `contact_messages`).

Comprobado:
- BD: 17 msgs hoy, último 13:44h. Source `whatsapp`. Ok.
- `ContactDetail.tsx` línea 122: `setMessages(((msgs as MsgRow[]) || []).reverse());` → orden ascendente.
- `ConversationTimeline.tsx` línea 53: `msgs.slice(0, 8)` → corta los más recientes del mes corriente.

## Fix

**`src/components/contact/ConversationTimeline.tsx`**:
- Dentro de cada grupo mensual, ordenar de **más reciente a más antiguo** y mostrar los 8 primeros (los recientes).
- Cambio: `.sort((a,b)=> new Date(b.message_date) - new Date(a.message_date)).slice(0,8)`.
- El texto "+ N más en este mes" sigue igual.

Con esto el mes corriente mostrará los mensajes de hoy/ayer arriba en lugar de mensajes de principios de mes.

## Mejora opcional incluida

Para evitar confusión futura cuando el primer mensaje cargado del mes sí es reciente, también revertimos el ordenamiento de cada bubble a desc (más reciente arriba) **solo dentro del mes**. La cabecera de mes sigue ordenada desc (mes más reciente arriba), que ya funciona.

## Sin cambios en BD ni edge functions

Solo un archivo de UI. Bug puramente de presentación.

