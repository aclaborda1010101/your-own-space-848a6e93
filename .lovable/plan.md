
Do I know what the issue is? Sí.

Diagnóstico confirmado:
- La regresión está en el bootstrap de `index.html` (se volvió frágil por mezclar recuperación auth + retry + limpieza de caché).
- `runtimeFreshness` hoy corre desde `main.tsx`; si falla carga del entry module, ese guard nunca ejecuta.
- RAG/Detector no faltan por rutas ni por settings actuales; desaparecen cuando entra una versión vieja/inconsistente del cliente.

Implementación definitiva:

1) `index.html` (simplificar y estabilizar arranque)
- Eliminar `recoverPreviewAuthIfNeeded()` completo.
- Mantener fallback visual + botón Reintentar.
- Rehacer retry para:
  - preservar query/hash,
  - limpiar SW/caches best-effort,
  - recargar con `retry=<timestamp>`,
  - anti-loop en `sessionStorage` (máximo 1 autoreintento automático).

2) `src/lib/runtimeFreshness.ts` (hacerlo efectivo en preview y published)
- Quitar skip por iframe.
- Añadir invalidación por build:
  - comparar `__APP_BUILD_ID__` actual vs guardado,
  - si cambia: limpiar SW/caches y recargar 1 vez (flag anti-loop),
  - si no cambia: no tocar navegación.
- Hacer que retorne `didTriggerReload` para coordinar bootstrap.

3) `src/main.tsx` (orden robusto)
- Ejecutar `ensureRuntimeFreshness()` antes del mount.
- Si dispara reload, abortar mount.
- Mantener `__jarvisRoot`, remover fallback al montar, y asegurar `__jarvis_booting=false` en finalización segura.

4) `vite.config.ts` (blindaje de versión)
- Agregar `define.__APP_BUILD_ID__` (build timestamp/hash).
- Mantener `workbox.skipWaiting`, `clientsClaim`, `cleanupOutdatedCaches`.
- Forzar `devOptions.enabled = false` en PWA para evitar comportamiento stale en preview.

5) `src/hooks/useUserSettings.tsx` (persistencia real de visibilidad crítica)
- En `fetchSettings`, si se detecta ocultación de rutas críticas, persistir corrección en DB (no solo estado local).
- Normalizar paths antes de comparar (`trim`, sin trailing slash) para evitar bypass por variantes.

6) `src/pages/Settings.tsx` (recuperación inmediata)
- Añadir botón “Restaurar navegación de proyectos”:
  - limpia ocultaciones no críticas,
  - fuerza visible `/projects`, `/rag-architect`, `/projects/detector`,
  - feedback con toast.

Validación obligatoria:
1) Login con Google en Preview (iframe), 3 veces seguidas:
- no queda en “Cargando JARVIS…”
- aparecen siempre Proyectos + RAG + Detector.
2) Login con Google en Published:
- sin errores de módulo/chunk.
3) Navegación E2E:
- `/projects` → `/projects/wizard/:id`
- `/rag-architect`
- `/projects/detector`
4) Confirmar en consola ausencia de `Failed to fetch dynamically imported module`.
5) Confirmar que “Reintentar” conserva parámetros de sesión y recupera correctamente.

Detalles técnicos:
- Implementar listener `vite:preloadError` para recarga controlada ante chunks obsoletos.
- Enfoque definitivo: bootstrap mínimo + invalidación por build id + anti-loop + persistencia de visibilidad crítica.
