
# Corregir pipeline Plaud y activar sincronizacion automatica

## Problemas detectados

### Bug 1: Emails de Plaud clasificados como "newsletter"
En `email-sync`, linea 443, si un email tiene la cabecera `List-Unsubscribe` se clasifica como `newsletter` **antes** de pasar por `preClassifyEmail()`. Los emails de `no-reply@plaud.ai` incluyen esa cabecera, asi que nunca llegan a clasificarse como `plaud_transcription` y `plaud-intelligence` nunca se ejecuta.

### Bug 2: Fechas IMAP invalidas para PostgreSQL
El campo `received_at` recibe valores como `"Thu, 19 Feb 2026 02:26:01 +0000 (UTC)"`. El sufijo `(UTC)` no es valido en PostgreSQL, provocando error `22007` y que algunos emails no se inserten.

### Bug 3: Sin sincronizacion automatica
No existe cron. El buzón solo se revisa cuando se lanza manualmente.

## Solucion

### Paso 1: Corregir clasificacion Plaud (email-sync)

Mover la deteccion de Plaud **antes** del check de `List-Unsubscribe`:

```text
// Linea 442-447 actual:
if (hasListUnsub) {
  email.email_type = "newsletter";
} else {
  email.email_type = preClassifyEmail(email);
}

// Correccion:
const preType = preClassifyEmail(email);
if (preType === "plaud_transcription") {
  email.email_type = "plaud_transcription";
} else if (hasListUnsub) {
  email.email_type = "newsletter";
} else {
  email.email_type = preType;
}
```

### Paso 2: Sanitizar fechas IMAP

Agregar una funcion `sanitizeDate()` que elimine el sufijo `(TIMEZONE)` y haga fallback a `new Date().toISOString()` si la fecha es invalida:

```text
function sanitizeDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
```

Aplicar en linea 429 y 424 donde se asigna `received_at` y `date`.

### Paso 3: Reprocesar emails Plaud del 19 Feb

Actualizar los 4 emails de Plaud del 19 Feb que quedaron con `email_type = null` a `plaud_transcription`, y lanzar `plaud-intelligence` para cada uno manualmente.

### Paso 4: Crear cron de sincronizacion cada 10 minutos

Usar `pg_cron` + `pg_net` para que `email-sync` se ejecute automaticamente cada 10 minutos:

```text
SELECT cron.schedule(
  'email-sync-auto',
  '*/10 * * * *',
  $$ SELECT net.http_post(
    url:='https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/email-sync',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer ANON_KEY"}'::jsonb,
    body:='{"action":"sync"}'::jsonb
  ) $$
);
```

## Archivos a modificar

- `supabase/functions/email-sync/index.ts` (bugs de clasificacion y fechas)

## Impacto esperado

- Los emails de Plaud se clasificaran correctamente como `plaud_transcription`
- `plaud-intelligence` se disparara automaticamente generando sugerencias en el dashboard
- Las fechas IMAP ya no causaran errores de insercion
- El buzon se revisara cada 10 minutos sin intervencion manual
