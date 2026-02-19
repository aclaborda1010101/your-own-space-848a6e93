
# Actualizar handleEmailSync para sincronizar ambas cuentas

## Cambio en `src/pages/DataImport.tsx`

### Reemplazar la funcion `handleEmailSync` (lineas 1028-1044)

La funcion actual hace una sola llamada generica a `email-sync`. Se reemplazara por dos llamadas paralelas especificas (Gmail y Outlook), con un toast que detalle cuantos emails se sincronizaron de cada cuenta.

```typescript
const handleEmailSync = async () => {
  if (!user) return;
  setEmailSyncing(true);
  try {
    const [gmailRes, outlookRes] = await Promise.all([
      supabase.functions.invoke('email-sync', { body: { account: 'gmail', limit: 50 } }),
      supabase.functions.invoke('email-sync', { body: { account: 'outlook', limit: 50 } }),
    ]);

    const gmailSynced = (gmailRes.data?.results || []).reduce((acc, r) => acc + (r.synced || 0), 0);
    const outlookSynced = (outlookRes.data?.results || []).reduce((acc, r) => acc + (r.synced || 0), 0);

    if (gmailRes.error && outlookRes.error) {
      throw new Error("Error en ambas cuentas");
    }

    const parts = [];
    if (gmailRes.error) parts.push("Gmail: error");
    else parts.push(`${gmailSynced} de Gmail`);
    if (outlookRes.error) parts.push("Outlook: error");
    else parts.push(`${outlookSynced} de Outlook`);

    toast.success(`Sincronizados: ${parts.join(', ')}`);
    await fetchEmailAccounts();
  } catch (err) {
    console.error(err);
    toast.error(err.message || "Error al sincronizar emails");
  } finally {
    setEmailSyncing(false);
  }
};
```

### Lo que se mantiene
- El boton con estado `emailSyncing` y spinner ya funciona correctamente
- El `fetchEmailAccounts()` al final refresca las fechas de ultima sincronizacion

## Archivo a modificar
Solo `src/pages/DataImport.tsx` (funcion handleEmailSync, lineas 1028-1044)
