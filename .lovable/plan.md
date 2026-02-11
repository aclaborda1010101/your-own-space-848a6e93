

## Integrar Correos Electronicos con JARVIS

### Objetivo

Crear un sistema que sincronice automaticamente emails de multiples proveedores (Gmail, Outlook, iCloud) y los haga accesibles tanto en la UI de Comunicaciones como para la IA central (gateway).

### Arquitectura

```text
Gmail (API REST)  ──┐
Outlook (Graph API) ─┤──> Edge Function "email-sync" ──> jarvis_emails_cache
iCloud (IMAP)  ──────┘          (cron cada 15 min)            |
                                                              v
                                                     JARVIS Gateway
                                                  (contexto de emails)
```

### Paso 1: Tabla de configuracion de cuentas

Crear una tabla `email_accounts` para almacenar las cuentas configuradas por el usuario:

- id, user_id, provider (gmail/outlook/icloud/imap)
- credentials_encrypted (token OAuth o password de app)
- email_address
- is_active, last_sync_at
- RLS por user_id

### Paso 2: Edge Function `email-sync`

Una sola funcion que maneje los 4 proveedores:

| Proveedor | Metodo | Requisitos |
|-----------|--------|------------|
| **Gmail** | API REST con OAuth token | Ya tienes Google OAuth; se amplia scope con `gmail.readonly` |
| **Outlook** | Microsoft Graph API | Requiere registrar app en Azure AD, obtener Client ID/Secret |
| **iCloud** | IMAP via fetch | Contrasena de app de Apple (ya la tienes para Calendar) |
| **IMAP generico** | IMAP via fetch | Servidor, puerto, email, password |

La funcion:
1. Lee las cuentas activas del usuario
2. Para cada cuenta, segun el provider, conecta y descarga emails nuevos (desde last_sync_at)
3. Almacena subject, from, preview, fecha en `jarvis_emails_cache`
4. Actualiza last_sync_at

### Paso 3: UI de configuracion

Anadir en Settings > Integraciones una seccion para gestionar cuentas de correo:
- Boton "Anadir cuenta" con selector de proveedor
- Para Gmail: redirige a OAuth con scope ampliado
- Para Outlook: redirige a OAuth de Microsoft
- Para iCloud/IMAP: formulario con email + contrasena de app

### Paso 4: Cron job

Configurar un cron job con `pg_cron` para ejecutar `email-sync` cada 15 minutos automaticamente.

### Paso 5: Integracion con JARVIS Gateway

Modificar `jarvis-gateway` para que consulte los emails recientes y los incluya como contexto cuando el usuario pregunte sobre correos o comunicaciones.

### Secrets necesarios

| Secret | Estado | Nota |
|--------|--------|------|
| `GOOGLE_AI_API_KEY` | Ya existe | Para IA |
| `OPENAI_API_KEY` | Ya existe | Para embeddings |
| `APPLE_ID_EMAIL` | Verificar | Reutilizar de iCloud Calendar |
| `APPLE_APP_SPECIFIC_PASSWORD` | Verificar | Reutilizar de iCloud Calendar |
| `MICROSOFT_CLIENT_ID` | Nuevo | Para Outlook (cuando se configure) |
| `MICROSOFT_CLIENT_SECRET` | Nuevo | Para Outlook (cuando se configure) |

### Orden de implementacion sugerido

1. **Gmail primero** -- ya tienes OAuth de Google configurado, solo falta ampliar el scope
2. **iCloud Mail** -- ya tienes las credenciales de iCloud Calendar
3. **Outlook** -- requiere registrar app en Azure, se hace despues
4. **IMAP generico** -- como fallback para cualquier otro proveedor

### Seccion tecnica

- Gmail usa la API REST `https://gmail.googleapis.com/gmail/v1/users/me/messages` con token OAuth
- Outlook usa Microsoft Graph `https://graph.microsoft.com/v1.0/me/messages`
- iCloud/IMAP se conecta via protocolo IMAP (en Deno hay limitaciones, se usaria un proxy o fetch a un servicio IMAP-to-REST)
- Los tokens OAuth se almacenan cifrados en `email_accounts`
- La tabla `jarvis_emails_cache` ya existe con la estructura correcta (id, user_id, account, from_addr, subject, preview, synced_at, is_read)
- Se reutiliza la pagina de Communications.tsx que ya muestra los emails agrupados por cuenta

