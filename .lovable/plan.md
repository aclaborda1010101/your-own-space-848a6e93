
# Fix: Corregir API de la libreria IMAP + verificar contrasenas

## Problemas detectados

Al probar la sincronizacion de las 3 cuentas, estos son los resultados:

| Cuenta | Error | Causa |
|--------|-------|-------|
| agustin@hustleovertalks.com (IONOS) | `client.select is not a function` | Bug en el codigo: la libreria usa `selectMailbox()`, no `select()` |
| aclaborda@outlook.com | `AUTHENTICATE failed` | Contrasena de aplicacion incorrecta o no valida |
| agustin.cifuentes@agustitogrupo.com (Gmail) | `Invalid credentials` | Contrasena de aplicacion incorrecta o no valida |

## Solucion

### Paso 1: Corregir el codigo de `syncIMAP()` en `email-sync/index.ts`

La libreria `@workingdevshero/deno-imap` tiene una API diferente a la que se implemento. Hay que usar la utilidad `fetchMessagesSince` que simplifica todo el proceso:

```text
// Antes (incorrecto):
await client.select("INBOX");
const searchResult = await client.search(`SINCE ${formatImapDate(since)}`);
const fetchResult = await client.fetch(sequence, { envelope: true });

// Despues (correcto):
import { ImapClient, fetchMessagesSince } from "jsr:@workingdevshero/deno-imap";

const messages = await fetchMessagesSince(client, "INBOX", since, {
  envelope: true,
  headers: ["Subject", "From", "Date"],
});
```

La funcion `fetchMessagesSince` hace internamente: `selectMailbox` + `search` + `fetch`, todo con la API correcta.

### Paso 2: Verificar contrasenas (accion tuya)

Las contrasenas de Outlook y Gmail estan dando error de autenticacion. Necesitas verificar:

- **Outlook** (`aclaborda@outlook.com`): Ve a https://account.live.com/proofs/manage/additional y genera una nueva contrasena de aplicacion
- **Gmail** (`agustin.cifuentes@agustitogrupo.com`): Ve a https://myaccount.google.com/apppasswords y genera una contrasena de aplicacion (requiere verificacion en dos pasos activa)

Una vez tengas las contrasenas correctas, actualizalas en Ajustes > Cuentas de correo.

## Seccion tecnica

### Cambios en `supabase/functions/email-sync/index.ts`

**Linea 3** - Importar utilidad:
```text
import { ImapClient, fetchMessagesSince } from "jsr:@workingdevshero/deno-imap";
```

**Lineas 54-109** - Reemplazar la logica interna de `syncIMAP()`:

Sustituir el bloque `try` completo con la llamada simplificada:
```text
try {
    await client.connect();
    await client.authenticate();

    const since = account.last_sync_at
      ? new Date(account.last_sync_at)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const fetchResult = await fetchMessagesSince(client, "INBOX", since, {
      envelope: true,
      headers: ["Subject", "From", "Date"],
    });

    const emails: ParsedEmail[] = [];

    if (fetchResult && Array.isArray(fetchResult)) {
      for (const msg of fetchResult.slice(-20)) {
        try {
          const envelope = msg.envelope;
          if (!envelope) continue;

          const fromAddr = envelope.from?.[0]
            ? `${envelope.from[0].name || ""} <${envelope.from[0].mailbox}@${envelope.from[0].host}>`
            : "unknown";

          emails.push({
            from_addr: fromAddr,
            subject: envelope.subject || "(sin asunto)",
            preview: "",
            date: envelope.date || new Date().toISOString(),
            message_id: envelope.messageId || String(msg.seq),
          });
        } catch (e) {
          console.error("[email-sync] IMAP parse error:", e);
        }
      }
    }

    await client.disconnect();
    console.log(`[email-sync] IMAP fetched ${emails.length} emails from ${host}`);
    return emails;
```

Esto corrige el error `client.select is not a function` para las 3 cuentas. Los errores de autenticacion de Outlook y Gmail se resolveran al introducir las contrasenas de aplicacion correctas.
