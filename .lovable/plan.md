

# Plan: Mostrar mensajes sincronizados tras importación

## Problema
Cuando una importación termina (bulk o backup), el resumen final muestra "X chats importados, Y contactos nuevos" pero **no muestra cuántos mensajes se almacenaron**. El contador `importProgress.messagesStored` se pierde al completar porque `setImportProgress(null)` lo elimina.

## Cambios en `src/pages/DataImport.tsx`

### 1. Ampliar los tipos de resultados para incluir mensajes

Modificar los tipos de `waBulkResults` y `backupResults` para añadir `messagesStored` y `messagesFailed`:

```typescript
// Línea ~508
useState<{ imported: number; newContacts: number; messagesStored: number; messagesFailed: number } | null>(null);

// Línea ~532
useState<{ imported: number; newContacts: number; groupsProcessed: number; messagesStored: number; messagesFailed: number } | null>(null);
```

### 2. Capturar el total de mensajes al completar

Antes de `setImportProgress(null)`, guardar los valores del progreso en los resultados:

- Línea ~757 (bulk): añadir `messagesStored: importProgress?.messagesStored || 0, messagesFailed: importProgress?.messagesFailed || 0`
- Línea ~1031 (backup): lo mismo

### 3. Mostrar en el resumen de "Importación completada"

En ambos bloques de resultados (líneas ~1920 y ~2128), añadir el total de mensajes:

```
✓ Importación completada
X chats importados · Y contactos nuevos · Z mensajes sincronizados (W errores)
```

### 4. También mostrar el total global de mensajes en BD

Tras completar la importación, disparar `loadWaLiveStats()` para que el panel Live (si el usuario cambia a esa pestaña) refleje el total actualizado. Opcionalmente, mostrar en el propio resumen de importación una query rápida del total de `contact_messages` con source `whatsapp`.

## Archivo tocado

| Archivo | Cambio |
|---------|--------|
| `src/pages/DataImport.tsx` | Añadir `messagesStored`/`messagesFailed` a resultados, mostrar en resumen final, refrescar stats tras importación |

