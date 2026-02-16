

# Plan: IMAP universal para todas las cuentas (Gmail incluido)

## Resumen

Actualmente Gmail solo funciona via OAuth (REST API). El objetivo es que **todas las cuentas** (Gmail, Outlook, iCloud, IMAP generico) puedan configurarse con usuario + contrasena de aplicacion via IMAP, sin depender de OAuth.

---

## Cambios necesarios

### 1. Edge Function `email-sync/index.ts`

**Modificar el case `gmail` (linea 382-397)** para anadir fallback a IMAP:
- Si la cuenta Gmail tiene `password` en credenciales pero no tiene `access_token`, usar IMAP con host `imap.gmail.com` puerto `993`
- Si tiene OAuth tokens, seguir usando el flujo actual (REST API)

```text
case "gmail": {
  const gmailCreds = account.credentials_encrypted;
  
  // IMAP fallback: si tiene password pero no OAuth token
  if (gmailCreds?.password && !gmailCreds?.access_token) {
    account.imap_host = account.imap_host || "imap.gmail.com";
    account.imap_port = account.imap_port || 993;
    emails = await syncIMAP(account);
    break;
  }
  
  // OAuth flow existente
  if (provider_token) { ... }
  emails = await syncGmailViaProviderToken(account, supabase);
  break;
}
```

### 2. UI Settings `EmailAccountsSettingsCard.tsx`

**Formulario de anadir cuenta (linea 538)**: Anadir Gmail a la condicion que muestra el campo de contrasena:

- Cambiar `(provider === "icloud" || provider === "imap" || provider === "outlook")` a `(provider === "icloud" || provider === "imap" || provider === "outlook" || provider === "gmail")`
- Anadir texto de ayuda para Gmail indicando que debe crear una contrasena de aplicacion en https://myaccount.google.com/apppasswords
- Anadir el `imap_host` y `imap_port` automaticamente para Gmail en `handleAdd` (linea 226-235): `imap.gmail.com:993`

**Mensaje informativo de Gmail (linea 605-609)**: Cambiar el texto para indicar que se puede conectar tanto via OAuth como via contrasena de aplicacion IMAP.

### 3. Seccion tecnica - Detalle de cambios

**`email-sync/index.ts` - case gmail (~linea 382-397)**:
Insertar check de IMAP antes del flujo OAuth existente.

**`EmailAccountsSettingsCard.tsx` - linea 538**:
```text
// Antes:
{(provider === "icloud" || provider === "imap" || provider === "outlook") && (

// Despues:
{(provider === "icloud" || provider === "imap" || provider === "outlook" || provider === "gmail") && (
```

**`EmailAccountsSettingsCard.tsx` - linea 226-235** en `handleAdd`:
Anadir bloque para Gmail:
```text
} else if (provider === "gmail" && appPassword) {
  insertData.imap_host = "imap.gmail.com";
  insertData.imap_port = 993;
}
```

**`EmailAccountsSettingsCard.tsx` - texto ayuda Gmail**:
Anadir hint con enlace a https://myaccount.google.com/apppasswords para crear contrasena de app de Google.

**`EmailAccountsSettingsCard.tsx` - linea 605-609**:
Cambiar mensaje para mostrar que la contrasena es opcional (si ya tiene OAuth no la necesita).

### 4. Resultado final

En la pantalla de Ajustes > Cuentas de correo:
- **Gmail**: Se puede conectar via OAuth (automatico) O via contrasena de aplicacion (IMAP)
- **Outlook**: Solo contrasena de aplicacion (IMAP) - sin Azure necesario
- **iCloud**: Contrasena de aplicacion (IMAP) o reutilizar credenciales de Calendar
- **IMAP generico**: Servidor + contrasena - cualquier proveedor de correo

