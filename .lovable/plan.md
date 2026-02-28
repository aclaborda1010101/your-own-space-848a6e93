
Objetivo: desbloquear Preview inmediatamente (dejar de ver “Cargando JARVIS…” fijo) atacando la causa real de carga del entry module.

Do I know what the issue is? Sí.
Problema exacto:
1) `vite.config.ts` restringe `server.allowedHosts` / `preview.allowedHosts` y no incluye dominios de Lovable (`*.lovableproject.com`, `*.lovable.app`), por eso falla la descarga de `/src/main.tsx`.
2) El bootloader en `index.html` usa `import("/src/main.tsx")` dentro de retry; cuando falla una vez, el módulo queda rechazado en caché ESM en esa página y “Reintentar” repite el fallo.

Plan de implementación (corto y directo):

1) `vite.config.ts` — desbloquear hosts de Preview
- En `server.allowedHosts` agregar:
  - `.lovableproject.com`
  - `.lovable.app`
- En `preview.allowedHosts` agregar los mismos.
- Alternativa más robusta: `allowedHosts: true` (si se prioriza compatibilidad total en entornos proxied).

2) `index.html` — volver al arranque estándar de Vite
- Quitar el `bootApp()` con `import("/src/main.tsx")`.
- Restaurar `<script type="module" src="/src/main.tsx"></script>` para que Vite gestione dev/prod correctamente.
- Mantener fallback visual (`#__boot_fallback`) y botón de retry.

3) `index.html` — retry real sin cache ESM
- En botón “Reintentar”:
  - limpiar SW/caches (best-effort),
  - hacer `window.location.replace(window.location.pathname + "?retry=" + Date.now())`.
- No reimportar `main.tsx` manualmente en la misma página.

4) `src/main.tsx` — conservar guardas útiles
- Mantener `__jarvisRoot` para evitar doble mount.
- Mantener eliminación de `#__boot_fallback` al montar React.
- Mantener `__jarvis_booting = false` tras mount.

5) `src/lib/runtimeFreshness.ts` — no interferir con Preview iframe
- Mantener skip en iframe (`window.self !== window.top`).
- Mantener guard de `__jarvis_booting` para no competir con bootstrap/retry.

Validación obligatoria:
1) Preview `/login`:
- request a `/src/main.tsx` debe responder 200,
- desaparece fallback,
- se renderiza login.
2) Reintentar:
- tras click debe recargar URL con `?retry=...`,
- app debe montar (sin “Error al iniciar JARVIS” persistente).
3) Published:
- confirmar que build sigue funcionando (sin dependencia de `/src/main.tsx` runtime).
4) Console:
- debe desaparecer `[JARVIS boot] Failed: Failed to fetch dynamically imported module...`.

Detalles técnicos (resumen):
- Fix principal: host allowlist de Vite + eliminar import dinámico manual del entry.
- Esto ataca la causa de red real en Preview y elimina el bucle de error por caché de módulos ESM en reintentos.
