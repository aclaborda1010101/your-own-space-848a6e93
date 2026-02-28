
Objetivo: eliminar la pantalla en blanco persistente y hacer el arranque tolerante a storage/caché bloqueados en preview y publicado.

1) `src/integrations/supabase/client.ts`
- Reemplazar `storage: localStorage` por un `safeAuthStorage` (adapter) con `getItem/setItem/removeItem` en `try/catch`.
- Usar fallback en memoria cuando `localStorage` falle (sin lanzar excepciones).
- Evitar cualquier acceso directo a `localStorage` en inicialización de módulo.

2) `src/lib/runtimeFreshness.ts`
- Encapsular acceso a `sessionStorage` en helpers seguros (`safeGetFlag`, `safeSetFlag`, `safeRemoveFlag`) con `try/catch`.
- Mantener limpieza SW/cache asíncrona, pero con guard anti-duplicado en memoria (ej. `window.__jarvisFreshnessRunning`) para evitar carreras/reloads dobles.
- Ampliar detección de entorno para cubrir preview y publicado en `*.lovable.app` + `*.lovableproject.com` + local.

3) `src/main.tsx`
- Mantener bootstrap estático.
- Renderizar app inmediatamente y ejecutar `ensureRuntimeFreshness()` en `queueMicrotask`/`setTimeout(0)` para que nunca bloquee montaje inicial.
- No hacer `throw` ni cortar ejecución de `createRoot`.

4) Validación funcional (obligatoria)
- Probar `/` en preview: debe mostrar Login o redirect, nunca pantalla en blanco.
- Probar URL publicada: carga correcta tras hard refresh.
- Confirmar que tras primera carga con caché vieja ocurre como máximo 1 reload controlado y luego arranca normal.

Detalles técnicos
- Causa más probable: crash silencioso por acceso a storage en fase de bootstrap estático (antes de tolerancia completa), combinado con guard de frescura no 100% defensivo.
- Este plan elimina puntos de fallo “fatal” en arranque sin perder la estrategia anti-stale.
