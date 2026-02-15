
# Arreglar Login con Google para incluir permisos de calendario desde el primer login

## Problema

El `handleGoogleLogin` en `Login.tsx` no pide `access_type: 'offline'` ni `prompt: 'consent'`, por lo que Google no devuelve un refresh token. Sin refresh token, el calendario no puede mantenerse conectado y muestra el error "Faltan permisos de Google Calendar (scopes)".

La funcion `reconnectGoogle` en `useGoogleCalendar.tsx` ya tiene estos parametros correctos, pero el login inicial no.

## Solucion

Modificar `handleGoogleLogin` en `Login.tsx` para incluir los mismos parametros que ya usa `reconnectGoogle`:

### Archivo: `src/pages/Login.tsx`

**Cambio 1** - Actualizar la constante `GOOGLE_SCOPES` para incluir `gmail.readonly` (consistente con `OAuthGoogle.tsx`):

```text
const GOOGLE_SCOPES =
  "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.readonly";
```

**Cambio 2** - Anadir `queryParams` con `access_type`, `prompt` e `include_granted_scopes` al `signInWithOAuth`:

```text
const { error } = await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: `${window.location.origin}/oauth/google/callback`,
    scopes: GOOGLE_SCOPES,
    queryParams: {
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    },
  },
});
```

### Resultado

Desde el primer login con Google, el usuario obtendra un refresh token y los scopes de calendario y email. No sera necesario reconectar manualmente despues.

**Nota importante**: Los usuarios que ya estan logueados necesitaran cerrar sesion y volver a hacer login con Google una vez para que se apliquen los nuevos permisos. Alternativamente, pueden pulsar "Reconectar" en la pagina del calendario.
