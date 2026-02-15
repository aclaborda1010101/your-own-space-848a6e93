
# Arreglar Google Calendar + Historico de tareas en calendario

## Problema 1: Google Calendar no carga

El calendario de Google no hace ni una sola peticion a la edge function. La causa raiz:

1. `getProviderToken()` busca en localStorage `google_provider_token` -- esta vacio porque Supabase solo proporciona el `provider_token` en el momento del login OAuth inicial, no cuando la sesion se refresca automaticamente
2. `refreshTokenIfNeeded()` comprueba si el token ha expirado, pero si NO hay token guardado ni fecha de expiracion, la logica falla silenciosamente en vez de intentar usar el `refresh_token` para obtener uno nuevo
3. `fetchEvents()` tiene la condicion `if (!token || !session?.access_token)` que aborta sin hacer nada cuando no hay provider token, incluso si hay un refresh token disponible

En resumen: despues de cerrar y abrir la app (o refrescar la pagina), el access token de Google desaparece y el sistema no intenta recuperarlo aunque tenga el refresh token guardado.

## Solucion Calendar

Modificar `refreshTokenIfNeeded` en `useGoogleCalendar.tsx` para que:
- Si NO hay access token en localStorage pero SI hay refresh token, haga el refresh inmediatamente (sin comprobar expiracion)
- Solo compruebe la expiracion cuando SI hay un access token guardado

Modificar `fetchEvents` para que:
- Si `refreshTokenIfNeeded` devuelve true, vuelva a leer el token actualizado de localStorage
- No aborte si el token inicial esta vacio pero el refresh fue exitoso

## Problema 2: Historico de tareas

Las tareas completadas no aparecen en el calendario ni tienen un historico visible con fecha de creacion y completado. El usuario quiere:
- Ver en el calendario cuando se creo y cuando se completo cada tarea
- Tener un historico de tareas completadas con sus fechas

## Solucion Historico

1. En `Tasks.tsx`, mejorar la seccion de tareas completadas para mostrar las fechas de creacion y completado
2. Mostrar tareas completadas en el calendario como eventos de tipo especial (marcadas visualmente diferente) usando `createdAt` y `completedAt` del modelo Task existente

## Seccion tecnica

### Archivo: `src/hooks/useGoogleCalendar.tsx`

Cambio en `refreshTokenIfNeeded`:

```text
ANTES:
  if (expiresAt && expiresAt - now > TOKEN_REFRESH_BUFFER_MS) {
    return true; // Token still valid
  }

DESPUES:
  const currentToken = getProviderToken();
  // Si hay token y no ha expirado, no hacer nada
  if (currentToken && expiresAt && expiresAt - now > TOKEN_REFRESH_BUFFER_MS) {
    return true;
  }
  // Si no hay token o ha expirado, intentar refresh
```

Cambio en `fetchEvents`:

```text
ANTES:
  const token = getProviderToken();
  if (!token || !session?.access_token) {
    setEvents([]);
    return;
  }

DESPUES:
  let token = getProviderToken();
  if (!token && !getRefreshToken()) {
    setEvents([]);
    return;
  }
  if (!token) {
    // refreshTokenIfNeeded ya se ejecuto arriba, re-leer
    token = getProviderToken();
    if (!token) {
      setEvents([]);
      return;
    }
  }
  if (!session?.access_token) {
    setEvents([]);
    return;
  }
```

### Archivo: `src/pages/Tasks.tsx`

En la seccion de tareas completadas, anadir las fechas:
- Mostrar "Creada: DD/MM" y "Completada: DD/MM" debajo de cada tarea completada
- Mostrar todas las completadas (no solo las 10 primeras) con scroll

### Archivo: `src/pages/Calendar.tsx`

Anadir tareas completadas como eventos visuales en el calendario:
- Mapear `completedTasks` a formato `CalendarEvent` usando `completedAt` como fecha
- Mostrarlas con un estilo diferenciado (opacidad reducida, icono de check)
- Esto permite ver en el calendario cuando se completaron las tareas
