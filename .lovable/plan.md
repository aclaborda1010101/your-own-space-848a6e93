

# Fix Outlook Sync: Cambiar de IMAP a OAuth (Microsoft Graph)

## Problema
Microsoft desactivó la autenticación basica (IMAP con usuario/contrasena) para cuentas de consumidor @outlook.com. El error `A0004 BAD Command Error` confirma que el servidor rechaza la sesion IMAP.

## Solucion

### Paso 1: Registrar una app en Azure (lo hace el usuario)
Necesitas crear una aplicacion en el portal de Azure para obtener el Client ID y Client Secret:

1. Ir a https://portal.azure.com > "App registrations" > "New registration"
2. Nombre: "Jarvis Email Sync"
3. Tipo de cuenta: "Personal Microsoft accounts only"
4. Redirect URI: `https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/microsoft-email-oauth?action=callback`
5. Crear un Client Secret en "Certificates & secrets"
6. En "API permissions" agregar: `Mail.Read` y `User.Read` (delegated)

### Paso 2: Configurar secrets en Supabase
Agregar `MICROSOFT_CLIENT_ID` y `MICROSOFT_CLIENT_SECRET` como secrets en el dashboard de Supabase (Settings > Edge Functions > Secrets).

### Paso 3: Actualizar la cuenta Outlook en la base de datos
Limpiar las credenciales IMAP de la cuenta Outlook para prepararla para OAuth:

```sql
UPDATE email_accounts 
SET credentials_encrypted = '{}'::jsonb
WHERE email_address = 'aclaborda@outlook.com';
```

### Paso 4: Agregar boton "Conectar Outlook" en la UI
En la pagina `/data-import` (seccion email), agregar un boton que inicie el flujo OAuth de Microsoft:

1. Llama a `microsoft-email-oauth` con `action: 'start'` y el `account_id` de la cuenta Outlook
2. Redirige al usuario a la URL de Microsoft para autorizar
3. Microsoft redirige de vuelta con un token que se guarda automaticamente en `email_accounts`
4. Despues de eso, `syncOutlook()` usara el Graph API en vez de IMAP

### Paso 5: Asegurar que syncOutlook use Graph API
El codigo actual en `syncOutlook()` ya soporta Graph API cuando hay `access_token`. Una vez que OAuth guarde los tokens, la sincronizacion funcionara automaticamente via `https://graph.microsoft.com/v1.0/me/messages`.

## Archivos a modificar
- `src/pages/DataImport.tsx` -- agregar boton "Conectar Outlook via OAuth"
- Base de datos -- limpiar credenciales IMAP de la cuenta Outlook

## Prerequisito del usuario
Crear la app en Azure y proporcionar el Client ID y Client Secret. Sin esto, el flujo OAuth no puede funcionar.

