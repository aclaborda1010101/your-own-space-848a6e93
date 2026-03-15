

# Plan: Mejoras de sincronización y zona horaria en WhatsApp Live

## Problemas a resolver

1. **Hora incorrecta**: `toLocaleString('es-ES')` sin `timeZone` usa la zona del navegador. Si el servidor guarda UTC, necesitamos forzar `timeZone: 'Europe/Madrid'` para que siempre muestre hora de Madrid.

2. **No hay auto-sync**: No existe suscripción Realtime a `contact_messages`. Cuando llega un mensaje nuevo vía webhook, el panel no se entera hasta que el usuario pulsa refresh manualmente.

3. **No hay concepto de "mensajes sincronizados"**: El usuario quiere ver "Total mensajes" vs "Mensajes cargados/sincronizados" para saber si está todo al día.

4. **Auto-actualización del resumen de Red Estratégica**: Cuando se acumulan N mensajes nuevos desde el último análisis, debería dispararse automáticamente el `contact-analysis`. El botón manual siempre disponible.

## Cambios en `src/pages/DataImport.tsx`

### 1. Forzar timezone `Europe/Madrid` en todas las fechas
En todas las llamadas a `toLocaleString('es-ES', {...})`, añadir `timeZone: 'Europe/Madrid'`. Afecta a:
- Último mensaje (línea ~2206)
- Mensajes recientes (línea ~2240)

### 2. Suscripción Realtime a `contact_messages`
Añadir un `useEffect` que cree un canal Supabase Realtime escuchando `INSERT` en `contact_messages` filtrado por `source=eq.whatsapp`. Cuando llegue un evento:
- Recargar `loadWaLiveStats()` automáticamente
- Esto mantiene el panel actualizado sin intervención manual

```typescript
useEffect(() => {
  if (waImportMode !== 'live' || !user) return;
  const channel = supabase.channel('wa-live-sync')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'contact_messages',
      filter: 'source=eq.whatsapp',
    }, () => {
      loadWaLiveStats(); // auto-refresh on new message
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [waImportMode, user, loadWaLiveStats]);
```

### 3. Mostrar "Total mensajes" y "Mensajes sincronizados"
Renombrar las tarjetas del grid para que quede claro:
- **Total mensajes**: el count absoluto de `contact_messages` con source `whatsapp`
- **Sincronizados (24h)**: los del último día (ya existe como `messages24h`)

Ambos valores ya se obtienen en `loadWaLiveStats`. Solo es un cambio de etiquetas y presentación.

### 4. Auto-trigger de análisis de Red Estratégica
Añadir lógica que, al detectar que se han acumulado N mensajes nuevos (propongo **25 mensajes** como umbral razonable -- suficiente para que el análisis sea significativo sin gastar tokens en cada mensaje), dispare automáticamente `contact-analysis` para los contactos afectados. Implementación:
- Guardar en estado local el count de mensajes en el último refresh
- Cuando el Realtime detecte un nuevo mensaje y el delta acumulado >= 25, invocar `contact-analysis`
- Siempre mantener el botón manual de "Actualizar análisis"

Alternativamente, esto ya lo hace el webhook (`evolution-webhook` y `whatsapp-webhook`) que dispara `contact-analysis` para mensajes > 20 chars o al 5º mensaje del día. Lo que falta es **visibilidad en la UI** de que esto ocurre. Podemos añadir un indicador "Análisis automático activo" con el último análisis ejecutado.

## Archivo tocado

| Archivo | Cambio |
|---------|--------|
| `src/pages/DataImport.tsx` | Timezone Madrid en fechas, suscripción Realtime, labels de sync, indicador de análisis automático |

No se necesitan cambios de backend -- el webhook ya dispara análisis automáticos. Solo mejoramos la visibilidad del frontend.

