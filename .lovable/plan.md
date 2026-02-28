
Objetivo: eliminar el “Cargando JARVIS...” fijo en Preview haciendo que `/login` monte rápido y sin depender de importar todo el app antes del primer render.

Do I know what the issue is? Sí: el arranque está bloqueado por imports eager en `src/App.tsx` (muchas páginas + layout + hooks pesados). En Preview se descargan/evalúan ~150 módulos antes de montar React, por eso parece “colgado”.

Implementación (directa y mínima):

1) `src/App.tsx` — pasar rutas pesadas a lazy loading
- Reemplazar imports estáticos de páginas protegidas por `React.lazy(() => import(...))`.
- Mantener `Login`, `OAuthGoogle`, `OAuthGoogleCallback`, `NotFound` en eager (rápidos y críticos).
- Crear fallback único de carga (`<Loader2 ... />`) con `Suspense`.

2) `src/App.tsx` — lazy load del layout también
- Evitar import estático de `AppLayout`.
- Cargar `AppLayout` con `lazy` y envolver `ProtectedPage` en `Suspense`.
- Resultado: `/login` no espera módulos de dashboard/chat/analytics/etc.

3) `src/App.tsx` — reducir trabajo inicial del árbol auth-only
- Mover wrappers pesados a rutas protegidas:
  - `WebSocketInitializer` y `UserSettingsProvider` solo dentro de rutas autenticadas.
- En `/login`, renderizar solo lo necesario (AuthProvider + ruta pública).

4) `src/lib/runtimeFreshness.ts` — evitar interferencia en iframe Preview
- Añadir guard: si está embebido en iframe (`window.self !== window.top`), no ejecutar limpieza/reload de freshness.
- Mantener freshness activo para pestaña normal y publicado.

5) `index.html` — fallback de carga con timeout explícito
- Mantener “Cargando JARVIS...”.
- Si en X segundos React no montó, mostrar mensaje de recuperación + botón “Reintentar” (reload).
- Esto evita “silencio” cuando el arranque tarda más de lo normal.

Validación obligatoria:
- Preview `/login`: debe pintar login sin quedarse fijo en “Cargando…”.
- Medir arranque inicial: reducción clara de requests/script antes del primer render.
- Navegar a 3 rutas protegidas (`/dashboard`, `/chat`, `/settings`) y confirmar que cada lazy route carga correctamente.
- Probar Published con hard refresh y confirmar que no hay regresión.

Detalles técnicos (resumen):
- El problema no es un crash visible; es bloqueo de bootstrap por evaluación de módulos no necesarios para `/login`.
- El fix principal es code splitting por ruta + lazy layout + providers pesados solo en zona protegida.
- El guard de iframe en freshness evita recargas innecesarias en el entorno Preview.
