

# Agregar cuenta Outlook a email_accounts

## Problema
No hay ninguna fila con `provider: 'outlook'` en la tabla `email_accounts`. El edge function necesita una fila para saber que cuenta sincronizar.

## Solucion (2 cambios)

### 1. Insertar la cuenta Outlook en `email_accounts`
Insertar una nueva fila con los datos de Outlook. Como no podemos leer el valor real del secret `OUTLOOK_APP_PASSWORD`, guardaremos un marcador y haremos que el edge function lo resuelva desde el env.

```sql
INSERT INTO email_accounts (user_id, provider, email_address, display_name, 
  imap_host, imap_port, credentials_encrypted, is_active)
VALUES (
  'f103da90-81d4-43a2-ad34-b33db8b9c369',
  'outlook',
  'aclaborda@outlook.com',
  'Outlook Agustin',
  'outlook.office365.com', 993,
  '{"password": "ENV:OUTLOOK_APP_PASSWORD"}',
  true
);
```

### 2. Modificar edge function para resolver password desde env
En `supabase/functions/email-sync/index.ts`, en la funcion `syncIMAP`, agregar logica para que si el password empieza con `ENV:`, lo lea del env de Deno:

```typescript
// En syncIMAP, despues de leer creds.password:
let password = creds.password;
if (password?.startsWith("ENV:")) {
  const envKey = password.substring(4);
  password = Deno.env.get(envKey) || "";
  if (!password) throw new Error(`Secret ${envKey} not configured`);
}
```

Esto permite que el password se resuelva automaticamente desde el secret `OUTLOOK_APP_PASSWORD` ya configurado en Supabase.

## Archivos a modificar
- `supabase/functions/email-sync/index.ts` -- resolver passwords desde env
- Base de datos -- insertar fila de Outlook

## Resultado esperado
Despues de estos cambios, la pagina `/data-import` mostrara 3 cuentas: Gmail, IMAP (IONOS) y Outlook. El boton "Sincronizar Emails" sincronizara las 3.
