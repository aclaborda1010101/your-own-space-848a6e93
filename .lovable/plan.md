

# Conectar cuenta Gmail hustleovertalks via OAuth

## Problema actual

La cuenta `agustin@hustleovertalks.com` existe en `email_accounts` pero tiene `credentials_encrypted: null`. Sin un `access_token` y `refresh_token` de Google, no puede sincronizar emails.

Los secrets `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` ya estan configurados, pero solo sirven para **refrescar** tokens existentes. Falta el paso inicial de **obtener** los tokens.

## Solucion

Crear un flujo de autorizacion OAuth de Google para cuentas de email adicionales (independiente del login de Supabase).

```text
[Usuario] --> Boton "Conectar Gmail" --> [Google OAuth Consent] --> [Callback] --> Guarda tokens en email_accounts
```

### Paso 1: Crear Edge Function `google-email-oauth`

Nueva Edge Function que genera la URL de autorizacion de Google y maneja el callback:

- **Endpoint `start`**: Genera la URL de consentimiento de Google con scopes `gmail.readonly` y `userinfo.email`, incluyendo el `account_id` en el `state` parameter
- **Endpoint `callback`**: Recibe el code de Google, lo intercambia por `access_token` + `refresh_token`, y los guarda en `email_accounts.credentials_encrypted`

### Paso 2: Crear pagina de callback `/oauth/gmail-callback`

Nueva ruta en la app que:
1. Recibe el `code` y `state` de Google
2. Llama a la Edge Function con el code para intercambiarlo
3. Muestra mensaje de exito/error
4. Redirige de vuelta a Settings

### Paso 3: Actualizar `EmailAccountsSettingsCard`

Agregar un boton "Conectar Gmail" junto a cada cuenta Gmail que no tenga tokens:
- Llama a la Edge Function `google-email-oauth/start` para obtener la URL
- Abre la URL en una nueva ventana o redirige al usuario
- Al volver del callback, la cuenta ya tendra los tokens guardados

### Paso 4: Configurar Redirect URI en Google Cloud Console

Necesitaras agregar esta URI de redireccion en tu proyecto de Google Cloud:
- `https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/google-email-oauth?action=callback`

## Requisito previo del usuario

En tu Google Cloud Console (el mismo proyecto donde creaste GOOGLE_CLIENT_ID):
1. Ve a **APIs & Services > Credentials**
2. Edita el OAuth Client ID que creaste
3. En **Authorized redirect URIs**, agrega: `https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/google-email-oauth?action=callback`
4. Asegurate de que la **Gmail API** esta habilitada en APIs & Services > Enabled APIs

## Detalles tecnicos

### Edge Function `google-email-oauth/index.ts`
- Action `start`: Construye URL `https://accounts.google.com/o/oauth2/v2/auth` con scopes `https://www.googleapis.com/auth/gmail.readonly email profile`, redirect_uri apuntando al propio endpoint, y `access_type=offline` + `prompt=consent` para obtener refresh_token
- Action `callback`: Intercambia el `code` en `https://oauth2.googleapis.com/token`, extrae `access_token` y `refresh_token`, los guarda en `email_accounts.credentials_encrypted`, y redirige al usuario a la app

### Redirect URI
Se usa la propia Edge Function como callback (patron comun): `https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/google-email-oauth?action=callback`

### Config
La funcion necesita `verify_jwt = false` en `config.toml` porque Google redirige al usuario sin JWT.

### Scope minimo
- `https://www.googleapis.com/auth/gmail.readonly` - leer emails
- `email` - saber que cuenta se conecto
- `profile` - nombre del usuario

### Archivos a crear/modificar
1. **Crear** `supabase/functions/google-email-oauth/index.ts`
2. **Modificar** `supabase/config.toml` - agregar verify_jwt = false
3. **Modificar** `src/components/settings/EmailAccountsSettingsCard.tsx` - boton "Conectar Gmail"

