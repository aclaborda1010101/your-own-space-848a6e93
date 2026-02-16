

# Fix: Cambiar OAuth de Microsoft a endpoint "consumers" para cuentas personales

## Problema

El error `AADSTS5000225: This tenant has been blocked due to inactivity` ocurre porque la app de Azure esta registrada bajo un tenant organizacional inactivo. Tu cuenta de Outlook (`aclaborda@outlook.com`) es una cuenta **personal** de Microsoft, no de empresa.

## Solucion

### Paso 1: Registrar nueva app en Azure para cuentas personales

1. Ve a [https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Inicia sesion con tu cuenta personal `aclaborda@outlook.com`
3. Click en **"New registration"**
4. Nombre: `Jarvis Email Sync`
5. En **"Supported account types"** selecciona: **"Personal Microsoft accounts only"**
6. Redirect URI (Web): `https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/microsoft-email-oauth?action=callback`
7. Click en "Register"
8. Copia el **Application (client) ID**
9. Ve a **Certificates & secrets** > **New client secret** > copia el valor
10. Ve a **API permissions** > **Add a permission** > **Microsoft Graph** > **Delegated** > selecciona `Mail.Read` y `User.Read`

### Paso 2: Actualizar la Edge Function

Cambiar las URLs de `login.microsoftonline.com/common/` a `login.microsoftonline.com/consumers/` en dos lugares:

- Linea 63: URL de autorizacion
- Linea 93: URL de intercambio de tokens

El endpoint `/consumers/` es el especifico para cuentas personales de Microsoft (Outlook.com, Hotmail, Live).

### Paso 3: Actualizar secrets

Una vez tengas el nuevo Client ID y Client Secret de la app registrada correctamente, actualizaremos `MICROSOFT_CLIENT_ID` y `MICROSOFT_CLIENT_SECRET`.

## Seccion tecnica

### Cambios en `supabase/functions/microsoft-email-oauth/index.ts`

Linea 63 - URL de autorizacion:
```text
// Antes:
const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;

// Despues:
const authUrl = `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?${params}`;
```

Linea 93 - URL de intercambio de tokens:
```text
// Antes:
const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {

// Despues:
const tokenRes = await fetch("https://login.microsoftonline.com/consumers/oauth2/v2.0/token", {
```

### Redespliegue

Tras el cambio, redesplegar la edge function `microsoft-email-oauth`.

