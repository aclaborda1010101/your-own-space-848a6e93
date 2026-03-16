

## Plan: Eliminar cuenta Outlook y configurar sync automático cada 56 minutos

### Cambios

**1. Eliminar la cuenta de Outlook (`aclaborda@outlook.com`)**
- Ejecutar `DELETE FROM email_accounts WHERE id = '702e48a3-057a-4a15-b8a3-8d2d787fb249'` para eliminar la cuenta que falla con `A0002 NO AUTHENTICATE failed`.

**2. Cambiar el cron job de 10 min a 56 min**
- Actualizar el cron job `email-sync-auto` de `*/10 * * * *` a `*/56 * * * *` (cada 56 minutos).
- Como solo quedan 2 cuentas y el sistema procesa 1 por invocación, cada cuenta se sincronizará aproximadamente cada ~112 minutos (2 invocaciones para cubrir ambas). Si quieres que ambas se sincronicen dentro de la misma ventana de 56 min, ajustaré el cron a `*/28 * * * *` (cada 28 min, 2 invocaciones = ambas cuentas cada ~56 min).

**3. Alternativa recomendada: sincronización real cada 56 min para ambas cuentas**
- Cambiar el cron a `*/28 * * * *` para que en 2 ejecuciones consecutivas (28 + 28 = 56 min) se cubran las 2 cuentas.
- O modificar el body del cron para enviar `account_id` específico en llamadas separadas, pero esto requiere 2 cron jobs.

### Ejecución
- 1 query SQL para eliminar la cuenta Outlook.
- 1 query SQL para actualizar el schedule del cron job existente.
- No se necesitan cambios en código fuente ni redeploy de Edge Functions.

