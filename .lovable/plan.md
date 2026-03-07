

## Barra de progreso en tiempo real para importación WhatsApp

Actualmente, cuando se importan chats de WhatsApp, solo se muestra un spinner genérico con "Importando chats...". No hay forma de saber cuántos chats se han procesado ni cuántos mensajes se han guardado.

### Cambios en `src/pages/DataImport.tsx`

**1. Añadir estado de progreso:**
- Nuevo state: `waBulkProgress` con `{ currentChat: number, totalChats: number, currentChatName: string, messagesStored: number, messagesFailed: number, startTime: number }`

**2. Actualizar `handleBulkImport` para reportar progreso:**
- Antes de procesar cada chat, actualizar `waBulkProgress` con el índice actual, nombre del chat, y contadores acumulados de mensajes ok/fail
- Tras cada lote de inserción, actualizar el contador de mensajes

**3. Reemplazar el spinner genérico (líneas 1723-1728) con un panel informativo:**
- Barra de progreso (`Progress` component) mostrando chats procesados / total
- Nombre del chat actual que se está importando
- Contador de mensajes almacenados en tiempo real
- Tiempo transcurrido (calculado desde `startTime`)
- Indicador de mensajes fallidos si hay alguno

**4. Aplicar lo mismo a `handleBackupImport` (backup CSV)** si existe un flujo similar con spinner.

### Ejemplo visual
```text
┌─────────────────────────────────────────┐
│  Importando: "Juan García"              │
│  ████████████░░░░░░░░  Chat 5 de 12    │
│  1,847 mensajes guardados · 0 errores   │
│  Tiempo: 00:45                          │
└─────────────────────────────────────────┘
```

### Archivos a editar
- `src/pages/DataImport.tsx`: Estado de progreso, actualización en bucle de importación, UI del panel

