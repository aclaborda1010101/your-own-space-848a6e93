

# Plan: Sincronizacion de correo funcional (Outlook + Gmail)

## Situacion actual

- La cuenta de Outlook (`aclaborda@outlook.com`) NO tiene credenciales reales, solo una nota placeholder
- Las cuentas Gmail no tienen tokens OAuth
- No existen los secrets `MICROSOFT_CLIENT_ID` ni `MICROSOFT_CLIENT_SECRET`
- No existe una Edge Function de OAuth para Microsoft (solo existe `google-email-oauth`)
- El `email-sync` ya tiene la logica para sincronizar via Microsoft Graph API, pero necesita tokens validos

## Solucion: Crear flujo OAuth completo para Microsoft + arreglar Gmail

### Paso 1: Crear Edge Function `microsoft-email-oauth`

Crear `supabase/functions/microsoft-email-oauth/index.ts` con la misma estructura que `google-email-oauth`:
- Accion `start`: genera la URL de autorizacion de Microsoft con los scopes `Mail.Read offline_access`
- Accion `callback`: intercambia el codigo por tokens (access_token + refresh_token) y los guarda en `email_accounts.credentials_encrypted`
- Redirige de vuelta a `/settings?outlook_connected=true`

### Paso 2: Configurar secrets de Microsoft

Solicitar al usuario:
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`

El usuario necesita registrar una app en Azure AD / Microsoft Entra:
- Ir a https://portal.azure.com > Azure Active Directory > App registrations
- Crear nueva app, tipo "Web"
- Redirect URI: `https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/microsoft-email-oauth?action=callback`
- Copiar Application (client) ID y generar un Client Secret
- En API Permissions, agregar `Microsoft Graph > Mail.Read` (delegated)

### Paso 3: Actualizar UI de settings

En `EmailAccountsSettingsCard.tsx`:
- Extender `accountNeedsOAuth` para que tambien detecte cuentas Outlook sin tokens
- Agregar funcion `handleConnectOutlook` similar a `handleConnectGmail` pero llamando a `microsoft-email-oauth`
- Manejar query params `outlook_connected` y `outlook_error`

### Paso 4: Registrar nueva function en config.toml

Agregar:
```text
[functions.microsoft-email-oauth]
verify_jwt = false
```

### Paso 5: Configurar cron automatico (opcional, recomendado)

Crear un cron job con `pg_cron` que llame a `email-sync` cada 15 minutos para que la sincronizacion sea automatica y Plaud se procese sin intervencion manual.

## Seccion tecnica

### `supabase/functions/microsoft-email-oauth/index.ts`

```text
- Endpoint: /functions/v1/microsoft-email-oauth
- action=start: recibe account_id, genera URL OAuth de Microsoft
  - Authority: https://login.microsoftonline.com/common/oauth2/v2.0/authorize
  - Scopes: Mail.Read offline_access User.Read
  - Redirect URI: {SUPABASE_URL}/functions/v1/microsoft-email-oauth?action=callback
  - State: base64({ account_id, origin })

- action=callback: recibe code, intercambia por tokens
  - Token endpoint: https://login.microsoftonline.com/common/oauth2/v2.0/token
  - Guarda access_token y refresh_token en email_accounts.credentials_encrypted
  - Redirige a {origin}/settings?outlook_connected=true
```

### `src/components/settings/EmailAccountsSettingsCard.tsx`

- Linea 305-310: Extender `accountNeedsOAuth` para incluir `outlook`
- Linea 282-303: Crear `handleConnectOutlook` (similar a `handleConnectGmail` pero con `microsoft-email-oauth`)
- Linea 412-427: Mostrar boton "Conectar" tambien para Outlook sin tokens
- Linea 54-65: Agregar manejo de `outlook_connected` y `outlook_error` query params

### `supabase/config.toml`

Agregar seccion para `microsoft-email-oauth` con `verify_jwt = false`

### Resultado esperado

1. En Ajustes > Cuentas de correo, la cuenta Outlook mostrara un boton "Conectar"
2. Al hacer click, se abre Microsoft OAuth, el usuario autoriza
3. Los tokens se guardan y `email-sync` puede leer los correos via Microsoft Graph
4. Los correos de Plaud se detectan automaticamente via `plaud-email-check`
5. El mismo flujo ya funciona para Gmail con `google-email-oauth`

