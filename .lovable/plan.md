

## Diagnóstico de la integración WHOOP

### Estado actual
- **WHOOP_CLIENT_SECRET**: Configurado correctamente en secrets.
- **Client ID**: Coincide (`80dc3ed7-c5bf-47eb-9c9d-5873cf281c7d`).
- **`check_connection`**: Devuelve `connected: false` (no hay tokens almacenados, nunca se completó el OAuth).
- **Redirect URLs registradas en WHOOP**: `https://jarvis2026-production.up.railway.app/health` y `https://pure-logic-flow.lovable.app/health`.

### Problema principal

El hook `useWhoop` construye la redirect URI con `window.location.origin`, que en el **preview de Lovable** genera una URL tipo `https://id-preview--9316b930-...lovable.app/health`. Esta URL **no está registrada** como redirect en el dashboard de WHOOP, por lo que el OAuth falla si se inicia desde el preview.

### Plan de corrección

**Archivo:** `src/hooks/useWhoop.tsx`

1. **Hardcodear la redirect URI** al dominio publicado (`https://pure-logic-flow.lovable.app/health`) en lugar de usar `window.location.origin`, para que funcione tanto desde el preview como desde la app publicada.

2. Alternativamente, añadir la URL del preview de Lovable como redirect URL en el dashboard de WHOOP (menos recomendable porque cambia con cada sesión).

### Cambio concreto

En `useWhoop.tsx`, líneas donde se construye `redirectUri`:
- `connect()` (línea 48): cambiar `${window.location.origin}/health` por `https://pure-logic-flow.lovable.app/health`
- `handleCallback()` (línea 68): mismo cambio

### Flujo para probar después

1. Ir a `https://pure-logic-flow.lovable.app/health` (URL publicada)
2. Click en "Conectar WHOOP"
3. Autorizar en WHOOP
4. Debería redirigir de vuelta y mostrar datos

