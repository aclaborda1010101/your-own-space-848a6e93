

## Plan: Mostrar botón "Enviar WhatsApp" sin exigir phone_numbers

### Problema
En la screenshot se ve la tarjeta "Próxima Acción Recomendada" con canal "Whatsapp" pero sin el botón de enviar. La causa es la condición en línea 1451:

```
proximaAccion.canal === 'whatsapp' && (contact.phone_numbers?.length || 0) > 0
```

El contacto "Carls Primo" tiene `phone_numbers: []` (vacío), así que el botón nunca aparece. Sin embargo, la Edge Function `send-whatsapp` ya resuelve el teléfono internamente desde el `contact_id` (busca `wa_id` o `phone_numbers` en `people_contacts`).

### Cambio

**Archivo**: `src/pages/StrategicNetwork.tsx`, línea 1451

Eliminar la condición `(contact.phone_numbers?.length || 0) > 0`. Dejar solo:

```typescript
{proximaAccion.canal === 'whatsapp' && (
```

Esto permite que el botón aparezca siempre que el canal recomendado sea WhatsApp. Si el contacto no tiene teléfono registrado, la Edge Function devolverá un error controlado que se mostrará como toast.

### Cambio secundario: email-sync alternancia de cuentas

**Archivo**: `supabase/functions/email-sync/index.ts`

Cambiar la selección de cuenta de `accounts[0]` a la cuenta con `last_sync_at` más antiguo, para que `agustin@hustleovertalks.com` se sincronice en la siguiente invocación.

