

# Limpiar y reconfigurar cuentas de correo

## Situacion actual

Hay 3 cuentas mal configuradas en la tabla `email_accounts`:
- iCloud con email de Outlook (no funciona)
- Outlook sin token OAuth (no funciona)  
- Gmail con email incorrecto "agustitogrupo.com" (no funciona)

## Cuentas objetivo

| Email | Proveedor | Metodo de sync |
|-------|-----------|----------------|
| agustin.cifuentes@agustitogrupo.com | Google Workspace | Gmail API (OAuth) |
| agustin@hustleovertalks.com | Google Workspace | Gmail API (OAuth) |
| aclaborda@outlook.com | Microsoft | Graph API (OAuth) |

## Pasos

### 1. Eliminar las 3 cuentas actuales mal configuradas
Borrar los registros existentes de `email_accounts` que tienen datos incorrectos.

### 2. Insertar las 3 cuentas nuevas con datos correctos
- Dos cuentas con `provider: "gmail"` para los dominios de Google Workspace
- Una cuenta con `provider: "outlook"` para Outlook

### 3. Limitaciones actuales de sync

**Gmail (Google Workspace)**: La Edge Function `email-sync` ya soporta Gmail via OAuth. Para que funcione necesitas:
- Tener la sesion de Google activa en la app (provider token), O
- Configurar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` como secrets para poder refrescar tokens automaticamente

**Outlook**: Necesita un `access_token` de Microsoft Graph. Actualmente no hay OAuth de Microsoft configurado, asi que no podra sincronizar hasta que se implemente. Los secrets `MICROSOFT_CLIENT_ID` y `MICROSOFT_CLIENT_SECRET` no existen aun.

### 4. Resultado
Las cuentas quedaran registradas correctamente. Gmail podra sincronizar si pasas el provider token desde la app. Outlook quedara lista pero pendiente de OAuth de Microsoft.

---

## Detalles tecnicos

### Operaciones en base de datos
```text
-- Eliminar cuentas mal configuradas
DELETE FROM email_accounts WHERE id IN ('1a4234e1-...', 'a64b6958-...', 'bd7386b1-...');

-- Insertar cuentas correctas
INSERT INTO email_accounts (user_id, provider, email_address, display_name, is_active)
VALUES 
  ('ef287d8b-...', 'gmail', 'agustin.cifuentes@agustitogrupo.com', 'Agustitogrupo', true),
  ('ef287d8b-...', 'gmail', 'agustin@hustleovertalks.com', 'Hustle Over Talks', true),
  ('ef287d8b-...', 'outlook', 'aclaborda@outlook.com', 'Outlook Personal', true);
```

No se requieren cambios de esquema ni de codigo. Solo operaciones de datos.
