

# Agregar cuenta Gmail a email_accounts

## Situacion actual

La Edge Function `email-sync` ya es multi-cuenta: lee todas las cuentas activas de la tabla `email_accounts`. Actualmente hay 1 cuenta:

| Email | Proveedor | Host |
|-------|-----------|------|
| agustin@hustleovertalks.com | imap | imap.ionos.es |

No hay nada hardcodeado. Solo falta insertar la segunda cuenta.

## Cambio necesario

Ejecutar una migracion SQL que inserte la cuenta Gmail en `email_accounts`:

```text
INSERT INTO email_accounts (user_id, provider, email_address, display_name, credentials_encrypted, imap_host, imap_port, is_active)
VALUES (
  'f103da90-81d4-43a2-ad34-b33db8b9c369',
  'gmail',
  'agustin.cifuentes@agustitogrupo.com',
  'Gmail Agustin',
  '{"password": "wzjybhtsnqihwagc"}',
  'imap.gmail.com',
  993,
  true
);
```

Esto hara que al llamar "Sincronizar Emails" desde la pestana Email de `/data-import`, la Edge Function sincronice ambas cuentas automaticamente.

## Nota sobre el secret GMAIL_APP_PASSWORD

El secret en Supabase Vault NO es necesario para este flujo. La Edge Function lee la contrasena directamente de `credentials_encrypted` en la tabla `email_accounts`, no de variables de entorno. Por lo tanto, no hace falta configurar ningun secret adicional.

## Archivos a modificar

Ninguno. Solo se ejecuta una migracion SQL para insertar el registro.

