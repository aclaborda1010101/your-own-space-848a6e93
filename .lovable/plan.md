

# Desactivar cuenta Outlook (Azure bloqueado)

## Situacion
Azure tiene el tenant bloqueado, por lo que no es posible registrar una app para OAuth con Microsoft Graph. Sin OAuth, Microsoft no permite acceder al correo de cuentas `@outlook.com` (IMAP con password esta desactivado desde 2023).

## Solucion
Desactivar la cuenta Outlook en la base de datos para que no interfiera con la sincronizacion de las otras cuentas (Gmail + IONOS).

### Cambio en base de datos
```sql
UPDATE email_accounts 
SET is_active = false, 
    sync_error = 'Azure tenant bloqueado - OAuth no disponible'
WHERE email_address = 'aclaborda@outlook.com';
```

### Cambio opcional en UI
Mostrar un mensaje informativo en la seccion de email de `/data-import` cuando una cuenta tiene `is_active = false`, para que se vea claramente que Outlook esta desactivada y por que.

## Resultado
- Gmail y IONOS seguiran sincronizando normalmente
- Outlook no generara errores al pulsar "Sincronizar Emails"
- Cuando se desbloquee Azure, se puede reactivar la cuenta y configurar OAuth

## Archivos a modificar
- Base de datos: UPDATE para desactivar la cuenta
- `src/pages/DataImport.tsx`: mostrar estado inactivo de cuentas desactivadas (opcional)

