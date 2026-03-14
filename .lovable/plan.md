
Objetivo: eliminar de forma efectiva la caché en PREVIEW (id-preview/preview) para que siempre cargue la versión fresca, sin romper published.

Plan de implementación (en orden):

1) Desbloquear compilación (imprescindible para poder desplegar el fix de caché)
- `src/hooks/usePotusMvpChat.ts`
  - Corregir la query que hoy apunta a `projects` con columnas inexistentes (`name/status/description`).
  - Cambiarla a una tabla compatible con esos campos (`business_projects`) o usar columnas reales de `projects` (`title`, etc.) para eliminar:
    - TS2589 (instanciación de tipos profunda por error de query tipada)
    - TS2339 en `p.name / p.status / p.description`.
- `src/pages/OpenClaw.tsx`
  - Corregir comparaciones de estado inválidas:
    - `blocked` -> `bloqueada`
    - quitar `cerrada` y usar `completed | lista`.
  - Añadir `paused?: boolean` (o `paused: false`) en el tipo/objeto unificado de tareas para eliminar TS2339 en `task.paused`.

2) Bloquear registro de Service Worker en preview antes de que ocurra
- `index.html`
  - Mover el guard anti-SW desde `<body>` a `<head>` (muy temprano), para que se ejecute antes del script autoinyectado de PWA.
  - Mantener detección estricta de preview: `preview--*`, `id-preview--*`, `localhost`, `*.lovableproject.com`.
  - En ese guard:
    - monkey-patch de `navigator.serviceWorker.register` a no-op en preview
    - `getRegistrations().unregister()` inmediato
    - `caches.keys().delete(...)` inmediato.
  - Quitar el bloque duplicado anti-SW del body (evitar lógica repetida/tardía).

3) Evitar autoinyección de `registerSW.js` y registrar PWA solo fuera de preview
- `vite.config.ts`
  - En `VitePWA(...)` añadir `injectRegister: false`.
- `src/main.tsx`
  - Registro manual de PWA con `virtual:pwa-register` únicamente en hosts NO preview.
  - Resultado:
    - preview: nunca registra SW
    - published: conserva PWA (si aplica).

4) Endurecer limpieza runtime para sesiones ya “contaminadas”
- `src/lib/runtimeFreshness.ts`
  - Mantener `backgroundClean()` en preview.
  - Añadir “one-shot cache-bust reload” (solo una vez por sesión) si detecta que la pestaña está bajo control de SW previo (`navigator.serviceWorker.controller`), con query `_cb=<ts>`.
  - Guardado con flag en `sessionStorage` para evitar loops.

5) Verificación funcional (E2E)
- Abrir preview con URL normal y con token.
- Validar en DevTools (Application):
  - 0 service workers activos en preview
  - caches vacías (o se vacían al iniciar)
  - no vuelve a aparecer `registerSW.js` como registro efectivo.
- Hacer dos recargas duras y confirmar que aparecen cambios recientes de UI/código sin “pantalla vieja”.

Detalles técnicos (resumen de cambios exactos):
- `index.html`: guard anti-SW temprano + limpieza de bloque tardío.
- `vite.config.ts`: `injectRegister: false` dentro de `VitePWA`.
- `src/main.tsx`: registro manual condicional de SW solo en no-preview.
- `src/lib/runtimeFreshness.ts`: limpieza preview + recarga única de desenganche SW.
- `src/hooks/usePotusMvpChat.ts` y `src/pages/OpenClaw.tsx`: fixes de TypeScript para permitir build/deploy del fix de caché.

Impacto esperado:
- Preview deja de servir assets viejos y deja de “pegársele” una versión cacheada.
- Published mantiene comportamiento estable y controlado.
- Se eliminan además los errores de build actuales que hoy impiden publicar cualquier corrección.
