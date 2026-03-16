

## Probar sincronización de Outlook vía IMAP

### Estado actual
- La cuenta `aclaborda@outlook.com` ya existe en `email_accounts` (id: `702e48a3`) con `provider: outlook`, `imap_host: outlook.office365.com`, `imap_port: 993`.
- Las credenciales están configuradas como `{ password: "ENV:OUTLOOK_APP_PASSWORD" }`, lo que significa que el edge function `email-sync` leerá el secret `OUTLOOK_APP_PASSWORD` del entorno.
- El secret `OUTLOOK_APP_PASSWORD` ya existe en Supabase pero tiene el error "Azure tenant bloqueado - OAuth no disponible", lo que sugiere que el valor actual no es correcto o no se había probado con IMAP.
- El código de `syncOutlook` ya detecta correctamente cuando hay `password` sin `access_token` y redirige a `syncIMAP`.

### Plan

**1. Actualizar el secret `OUTLOOK_APP_PASSWORD`**
- Establecer el valor a `mgfodlwvqrojkvgg` (la contraseña de aplicación que has proporcionado).

**2. Limpiar el error de sincronización**
- Ejecutar un UPDATE en `email_accounts` para borrar `sync_error` del registro de Outlook.

**3. Probar la sincronización**
- Invocar `email-sync` con `action: sync` y `account_id: 702e48a3-057a-4a15-b8a3-8d2d787fb249` para verificar que la conexión IMAP funciona.

### Resultado esperado
Si la app password es válida, el sistema conectará vía IMAP a `outlook.office365.com:993` con `aclaborda@outlook.com` y descargará los emails recientes a `jarvis_emails_cache`.

