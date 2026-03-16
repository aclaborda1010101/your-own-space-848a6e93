

## Sincronizar Outlook: actualizar credenciales y reintentar

### Estado actual
- El secret `OUTLOOK_APP_PASSWORD` existe pero contiene la contraseña anterior (que falló).
- La cuenta tiene `sync_error: "Authentication failed: A0002 NO AUTHENTICATE failed."` y `last_sync_at: null`.

### Plan

1. **Actualizar el secret `OUTLOOK_APP_PASSWORD`** con el valor `dzyupzfhufgwmswt` (la nueva app password).

2. **Limpiar `sync_error`** en `email_accounts` para el registro `702e48a3`.

3. **Invocar `email-sync`** con `action: sync` y `account_id: 702e48a3-057a-4a15-b8a3-8d2d787fb249` para probar la conexión IMAP.

### Resultado esperado
Si la app password es válida y IMAP está habilitado en la cuenta de Outlook, los emails recientes se descargarán a `jarvis_emails_cache`.

