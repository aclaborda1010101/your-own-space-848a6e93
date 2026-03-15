

# Plan: Panel de Estado WhatsApp Business en la sección de Importación

## Problema
Ahora que WhatsApp Business está conectado y recibe mensajes en tiempo real, la sección de importación manual de archivos .txt es redundante para el uso diario. Falta un panel que muestre el estado de la conexión en vivo y las estadísticas de sincronización automática.

## Solución
Añadir un nuevo modo/sección al tab de WhatsApp en DataImport que muestre:
1. **Estado de conexión** — badge verde/rojo indicando si el webhook está activo
2. **Última actividad** — timestamp del último mensaje recibido vía webhook
3. **Estadísticas** — total de mensajes recibidos hoy, contactos actualizados, chats activos
4. **Botón "Verificar conexión"** — hace un ping al webhook para confirmar que responde

## Cambios

### `src/pages/DataImport.tsx`
- Añadir un cuarto botón de modo en la sección WhatsApp: **"WhatsApp Business (Live)"** con icono de RefreshCw/señal
- Cuando está seleccionado, mostrar un panel con:
  - Badge de estado (consulta `contact_messages` donde `source='whatsapp'` para ver el último mensaje recibido)
  - Stats: mensajes últimas 24h, contactos con `wa_id` vinculado, último mensaje recibido (fecha/hora)
  - Botón "Verificar webhook" que llama al endpoint GET del webhook con el verify token
  - Nota informativa: "Los mensajes se sincronizan automáticamente. Ya no necesitas importar archivos .txt manualmente."
- Los otros 3 modos de importación manual se mantienen intactos para importar historial antiguo

### Datos consultados (solo lectura, sin cambios de backend)
- `contact_messages` filtrado por `source = 'whatsapp'` y `user_id` — último mensaje y conteo 24h
- `people_contacts` filtrado por `wa_id IS NOT NULL` — contactos vinculados
- No se necesitan cambios de base de datos ni edge functions

