
1) Endurecer bootstrap de `index.html` (sin bloqueos):
- Reemplazar el arranque actual por un bootloader `type="module"` que haga `import("/src/main.tsx?...")` con cache-busting del entry.
- Eliminar el auto-reload a los 8s (dejar solo mostrar botón “Reintentar”).
- En “Reintentar”, intentar primero reimport del entry; solo si falla, ejecutar limpieza SW/cache + hard reload.
- Mantener preservación completa de `pathname + search + hash`.

2) Corregir `runtimeFreshness` para evitar loops y pantallas congeladas:
- En `src/lib/runtimeFreshness.ts`, agregar timeout a limpieza (`SW + caches`) para que nunca deje el mount bloqueado.
- Cambiar flag anti-loop a clave por transición de build (`prev->next`) + ventana temporal (ej. 30s).
- En host de Preview (`*.lovableproject.com`, `id-preview--*.lovable.app`), limpiar SW/cache en background siempre y no bloquear arranque.
- En Published, mantener reload controlado 1 vez por cambio real de build.

3) Estabilizar identificador de build en `vite.config.ts`:
- Quitar `Date.now()` como build id.
- Usar ID estable por deploy (env de commit/deploy) con fallback fijo.
- Mantener `skipWaiting`, `clientsClaim`, `cleanupOutdatedCaches`.

4) Hacer mount resistente en `src/main.tsx`:
- Ejecutar `ensureRuntimeFreshness()` pero con ruta de salida garantizada (sin quedar en estado boot infinito).
- Envolver mount en `try/catch/finally` para resetear flags de boot siempre.
- Quitar fallback visual solo después de confirmar que React tomó control (post-render frame).

5) Blindaje final de navegación crítica:
- En `src/hooks/useUserSettings.tsx`, unificar normalización de paths (`trim`, trailing slash) en fetch/update.
- Aplicar misma normalización en el filtrado del sidebar (`src/components/layout/SidebarNew.tsx`) para impedir ocultación por variantes de ruta.
- Mantener `/projects`, `/rag-architect`, `/projects/detector` forzadas visibles y persistidas.

6) Validación obligatoria (post-fix):
- Preview: login Google 3 veces seguidas, sin “Cargando JARVIS...” permanente.
- Published: login Google 3 veces seguidas, sin fallback colgado ni módulos obsoletos.
- Confirmar siempre visibles: Proyectos, RAG Architect, Detector Patrones.
- Navegar E2E: `/projects` → `/projects/wizard/:id` → `/rag-architect` → `/projects/detector`.
- Verificar consola sin `Failed to fetch dynamically imported module` ni recargas en bucle.
