

# Conectar cuentas de email: limpieza y configuracion OAuth

## Estado actual

Hay 6 registros en `email_accounts` pero solo 3 cuentas reales, con duplicados y sin credenciales validas. Ademas, faltan los secrets necesarios para que el flujo OAuth funcione.

## Paso 1: Configurar secrets de Google OAuth

Necesitas tener una aplicacion en Google Cloud Console con:
- Gmail API habilitada
- URI de redireccion configurada: `https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/google-email-oauth?action=callback`

Los secrets que necesitamos añadir en Supabase:
- `GOOGLE_CLIENT_ID` - El Client ID de tu app de Google Cloud
- `GOOGLE_CLIENT_SECRET` - El Client Secret de tu app de Google Cloud

Sin estos, el boton "Conectar" de Gmail no puede funcionar.

## Paso 2: Limpiar cuentas duplicadas

Eliminar los 3 registros duplicados de la base de datos:
- `aclaborda@outlook.com` como "iCloud Mail" (error, no es iCloud)
- `aclaborda@outlook.com` duplicado de Outlook (uno de los dos)
- `agustin@hustleovertalks.com` como "IMAP" (duplicado del registro Gmail)

Esto se hace con una migracion SQL simple.

## Paso 3: Conectar las cuentas Gmail

Una vez configurados los secrets:
1. Ir a Ajustes > Cuentas de correo
2. Click en "Conectar" en cada cuenta Gmail
3. Se abre Google OAuth, autorizas, y los tokens se guardan automaticamente

## Paso 4 (opcional): Outlook

Para conectar Outlook necesitariamos:
- Registrar una app en Azure AD / Microsoft Entra
- Configurar `MICROSOFT_CLIENT_ID` y `MICROSOFT_CLIENT_SECRET`
- Implementar un flujo OAuth similar al de Gmail (actualmente no existe la edge function para Outlook OAuth)

## Seccion tecnica

### Migracion SQL - Limpiar duplicados

```sql
-- Eliminar aclaborda@outlook.com registrado erroneamente como iCloud
DELETE FROM email_accounts WHERE id = 'c5461994-1bce-43d1-ab8d-35adfbfbc1be';

-- Eliminar duplicado de Outlook (mantener el que tiene credenciales: 3dd25e8b)
DELETE FROM email_accounts WHERE id = '6f45b7a1-7ad2-4379-a29b-0f7bf297fe43';

-- Eliminar duplicado IMAP de hustleovertalks (mantener el registro Gmail: bd1bc32b)
DELETE FROM email_accounts WHERE id = '023fdf36-60bb-48d1-8104-c4f488449fab';
```

### Secrets a configurar

Se usara la herramienta de secrets de Supabase para pedir al usuario:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### Resultado esperado tras la limpieza

3 cuentas limpias:
- `agustin.cifuentes@agustitogrupo.com` (Gmail) - pendiente OAuth
- `agustin@hustleovertalks.com` (Gmail) - pendiente OAuth  
- `aclaborda@outlook.com` (Outlook) - con credenciales, pendiente OAuth de Microsoft

