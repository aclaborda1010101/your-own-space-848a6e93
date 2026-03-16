

## Actualizar app password de Outlook y reintentar sincronización

La autenticación IMAP falló con la contraseña anterior. El usuario ha proporcionado una nueva contraseña de aplicación.

### Plan

1. **Actualizar el secret `OUTLOOK_APP_PASSWORD`** con el nuevo valor `dzyupzfhufgwmswt`
2. **Limpiar `sync_error`** en la cuenta de Outlook (por si quedó marcado del intento anterior)
3. **Reintentar la sincronización** invocando `email-sync` con `action: sync` y `account_id: 702e48a3-057a-4a15-b8a3-8d2d787fb249`

### Detalle técnico

- El edge function `email-sync` lee `Deno.env.get("OUTLOOK_APP_PASSWORD")` cuando las credenciales contienen `ENV:OUTLOOK_APP_PASSWORD`
- La conexión IMAP va a `outlook.office365.com:993` con usuario `aclaborda@outlook.com`
- Si la nueva app password es válida, los emails recientes se cachearán en `jarvis_emails_cache`

