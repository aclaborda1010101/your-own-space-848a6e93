

# Plan: IMAP directo para Outlook + Cambio de modelo a Gemini 3 Pro

## Resumen

Dos cambios principales:
1. **Sincronizacion de correo via IMAP** - Sin necesidad de Azure/OAuth. Solo usuario y contrasena de aplicacion, como cualquier gestor de correo.
2. **Cambiar motor de IA a Gemini 3 Pro Preview** - Reducir costes eliminando Claude como modelo por defecto.

---

## Parte 1: Email via IMAP (sin OAuth)

### Problema actual
No puedes acceder a Azure para registrar una app OAuth. El flujo OAuth de Microsoft es inviable para cuentas personales sin acceso al portal.

### Solucion
Usar **IMAP directo** con la libreria `@workingdevshero/deno-imap` (disponible en JSR para Deno). Outlook personal soporta IMAP en `outlook.office365.com:993` con usuario/contrasena.

Para Outlook personal necesitaras una **contrasena de aplicacion**:
1. Ir a https://account.live.com/proofs/manage/additional
2. Activar verificacion en dos pasos si no esta activa
3. Crear una "contrasena de aplicacion" (app password)
4. Usarla como contrasena IMAP

### Cambios en `supabase/functions/email-sync/index.ts`

- Reemplazar `syncIMAP()` (actualmente vacio, linea 301-304) con una implementacion real usando `@workingdevshero/deno-imap`
- Conectar a `outlook.office365.com:993` con TLS
- Autenticar con usuario (email) y contrasena (app password)
- Seleccionar INBOX, buscar emails recientes (SINCE fecha)
- Fetch subject, from, date y snippet de los ultimos emails
- Devolver como `ParsedEmail[]`

- Modificar `syncOutlook()` (linea 164-219) para que si no hay `access_token` pero hay `password`, rediriga a la nueva `syncIMAP()` automaticamente

### Cambios en `src/components/settings/EmailAccountsSettingsCard.tsx`

- Cuando el provider es `outlook`, mostrar campos de **email** y **contrasena de aplicacion** en vez de solo el boton OAuth
- Eliminar la dependencia de OAuth para Outlook: el boton "Conectar" pasa a ser un formulario simple con email + password
- Al guardar, almacenar las credenciales en `credentials_encrypted` como `{ password: "...", imap_host: "outlook.office365.com", imap_port: 993 }`
- Actualizar `accountNeedsOAuth()` (linea 314-319) para excluir Outlook del flujo OAuth: solo Gmail necesita OAuth

### Resultado
En Ajustes, para Outlook: introduces tu email y contrasena de aplicacion, y listo. Sin Azure, sin OAuth, sin complicaciones.

---

## Parte 2: Cambiar modelo por defecto a Gemini 3 Pro Preview

### Cambios en `supabase/functions/_shared/ai-client.ts`

- Linea 37-39: Actualizar `GEMINI_MODEL_ALIASES` para incluir `"gemini-pro"` apuntando a `"gemini-3.0-pro-preview"` (antes `"gemini-1.5-pro"`)
- Linea 42: Cambiar `DEFAULT_GEMINI_MODEL` de `"gemini-2.0-flash"` a `"gemini-2.0-flash"` (mantener flash para tareas ligeras)
- Anadir alias `"gemini-pro-3"` que apunte a `"gemini-3.0-pro-preview"`
- Linea 43: Mantener `CLAUDE_MODEL` definido pero solo se usara si se pide explicitamente con `options.model = "claude"`
- Actualizar los logs para reflejar la version de Gemini en uso

### Logica de seleccion de modelos (sin cambios estructurales)
- Gemini Flash (2.0) para tareas rapidas/baratas (por defecto)
- Gemini 3 Pro Preview para tareas complejas (analisis, coaching, etc.)
- Claude solo bajo peticion explicita para casos muy especificos

---

## Seccion tecnica

### Dependencia IMAP

```text
import { ImapClient } from "jsr:@workingdevshero/deno-imap";
```

### Nueva funcion `syncIMAP` en email-sync/index.ts

```text
async function syncIMAP(account: EmailAccount): Promise<ParsedEmail[]> {
  const creds = account.credentials_encrypted;
  if (!creds?.password) throw new Error("No IMAP password configured");

  const host = account.imap_host || "outlook.office365.com";
  const port = account.imap_port || 993;

  const client = new ImapClient({
    host, port, tls: true,
    username: account.email_address,
    password: creds.password,
  });

  await client.connect();
  await client.authenticate();
  await client.select("INBOX");

  // Search for recent emails (last 7 days or since last sync)
  const since = account.last_sync_at
    ? new Date(account.last_sync_at)
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const searchResult = await client.search(`SINCE ${formatImapDate(since)}`);
  // Fetch last 20 messages
  // Parse envelope for from, subject, date
  // Return ParsedEmail[]

  await client.disconnect();
  return emails;
}
```

### Cambio en syncOutlook para fallback a IMAP

```text
async function syncOutlook(account: EmailAccount): Promise<ParsedEmail[]> {
  const creds = account.credentials_encrypted;

  // Si tiene password pero no access_token, usar IMAP directo
  if (creds?.password && !creds?.access_token) {
    account.imap_host = account.imap_host || "outlook.office365.com";
    account.imap_port = account.imap_port || 993;
    return syncIMAP(account);
  }

  // OAuth flow existente (si algun dia se configura)
  if (!creds?.access_token) throw new Error("No credentials");
  // ... resto del codigo actual
}
```

### Modelo aliases actualizados en ai-client.ts

```text
const GEMINI_MODEL_ALIASES: Record<string, string> = {
  "gemini-flash": "gemini-2.0-flash",
  "gemini-pro": "gemini-3.0-pro-preview",
  "gemini-pro-3": "gemini-3.0-pro-preview",
  "gemini-pro-legacy": "gemini-1.5-pro",
};
```

### UI: Formulario Outlook simplificado

En el dialogo de anadir cuenta, cuando se selecciona Outlook:
- Mostrar campo Email
- Mostrar campo "Contrasena de aplicacion"
- Enlace a https://account.live.com/proofs/manage/additional para crear la contrasena
- Sin boton OAuth

