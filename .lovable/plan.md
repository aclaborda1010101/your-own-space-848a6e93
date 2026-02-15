
# Conectar Google Calendar a la pagina del Calendario

## Problema

La pagina `/calendar` usa el hook `useCalendar` que solo conecta con iCloud Calendar via CalDAV. El hook `useGoogleCalendar` existe con toda la logica de tokens, refresh automatico y sincronizacion, pero no se usa en la pagina del calendario.

Cuando el usuario pulsa "Conectar" en la pagina del calendario, solo aparece un toast diciendo "Ve a Ajustes para reconectar tu calendario de iCloud", en vez de conectar con Google Calendar.

## Solucion

Modificar el hook `useCalendar` para que use Google Calendar como proveedor principal (ya que el usuario se autentica con Google OAuth y tiene tokens disponibles), manteniendo la misma interfaz publica para no romper nada.

## Cambios

### Archivo: `src/hooks/useCalendar.tsx`

Reescribir el hook para que internamente use la logica de `useGoogleCalendar` en vez de iCloud:

1. **checkConnection**: Verificar si hay tokens de Google (provider_token o refresh_token en localStorage), igual que hace `useGoogleCalendar`
2. **fetchEvents**: Llamar a la edge function `google-calendar` con action `list` en vez de `icloud-calendar`
3. **createEvent**: Llamar a `google-calendar` con action `create`
4. **updateEvent**: Llamar a `google-calendar` con action `update` (ya implementado en el hook de Google)
5. **deleteEvent**: Llamar a `google-calendar` con action `delete`
6. **reconnectGoogle**: Usar `supabase.auth.signInWithOAuth` con Google y scopes de calendario, igual que hace el hook de Google Calendar en settings

### Logica de tokens

- Reutilizar la misma logica de `useGoogleCalendar`: tokens en localStorage, refresh proactivo cada 30 minutos, buffer de 5 minutos antes de expiracion
- La conexion se considera activa si hay access_token o refresh_token almacenados

### Detalle tecnico

```text
// checkConnection: verificar tokens de Google en localStorage
const token = localStorage.getItem("google_provider_token");
const refreshToken = localStorage.getItem("google_provider_refresh_token");
const isConnected = !!(token || refreshToken);

// fetchEvents: llamar a google-calendar edge function
const { data } = await supabase.functions.invoke('google-calendar', {
  body: { action: 'list', eventData: { startDate, endDate } },
  headers: { 'x-google-token': token, 'x-google-refresh-token': refreshToken }
});

// reconnectGoogle: OAuth con Google
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    scopes: 'https://www.googleapis.com/auth/calendar',
    redirectTo: window.location.origin + '/calendar'
  }
});
```

### Sin cambios de esquema

No se necesitan migraciones. La edge function `google-calendar` ya existe y funciona. Solo se cambia que hook usa la pagina del calendario.

### Archivos afectados

- `src/hooks/useCalendar.tsx` - reescribir para usar Google Calendar en vez de iCloud
