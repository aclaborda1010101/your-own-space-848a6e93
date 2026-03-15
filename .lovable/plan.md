

# Fix: Verificar webhook sigue fallando

## Problema raiz

El botón "Verificar webhook" hace un `fetch()` sin headers al endpoint de Supabase. La gateway de Supabase requiere al menos el header `apikey` para permitir la petición. Sin ese header, la gateway rechaza la request antes de que llegue a tu función, y el navegador recibe un error de red/CORS.

Los logs de "Webhook verified" que ves son de **Meta verificando** el webhook, no del botón de tu app.

## Solucion

Cambiar `checkWebhook` en `DataImport.tsx` para incluir el `apikey` header en la request:

```typescript
const checkWebhook = useCallback(async () => {
  setWaWebhookStatus('checking');
  try {
    const url = `https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=jarvis-verify-token&hub.challenge=test123`;
    const res = await fetch(url, {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmamx3eHNzeGZ2aGJpeXRjb2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDI4MDUsImV4cCI6MjA4NTIxODgwNX0.EgH-i0SBnlWH3lF4ZgZ3b8SRdBZc5fZruWmyaIu9GIQ',
      },
    });
    const text = await res.text();
    setWaWebhookStatus(text.trim() === 'test123' ? 'ok' : 'error');
  } catch {
    setWaWebhookStatus('error');
  }
}, []);
```

Mejor aun: usar la constante del cliente Supabase existente para no hardcodear la key.

## Archivo tocado

| Archivo | Cambio |
|---------|--------|
| `src/pages/DataImport.tsx` | Añadir `apikey` header a la llamada fetch de `checkWebhook` (linea 428-429) |

No requiere redespliegue de edge functions. Solo cambio frontend.

