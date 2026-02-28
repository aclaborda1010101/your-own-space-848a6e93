
Objetivo: hacer que el botón “Reintentar” realmente recupere el arranque en Preview aunque falle la carga de módulos o haya caché corrupta.

Implementación

1) `index.html` — reemplazar arranque pasivo por bootloader activo
- Quitar `<script type="module" src="/src/main.tsx"></script>`.
- Añadir `<script type="module">` con `bootApp()` que:
  - Intenta `import("/src/main.tsx?boot=" + Date.now())`.
  - En error, muestra mensaje en `#__boot_fallback` y deja visible `#__boot_retry`.
  - En “Reintentar”, primero limpia SW/caches (best-effort) y luego vuelve a ejecutar `bootApp()` (sin recarga ciega).

2) `index.html` — hacer el botón útil sin depender de recarga completa
- Cambiar `onclick="window.location.reload()"` por handler JS (`addEventListener`) que:
  - Deshabilita botón temporalmente.
  - Ejecuta limpieza de caché/SW.
  - Relanza `bootApp()` con cache-busting.
- Mantener texto de estado dentro del fallback (`Cargando...`, `Reintentando...`, `Error al iniciar`).

3) `src/main.tsx` — blindar bootstrap para reintentos múltiples
- Evitar doble `createRoot` usando flag global (`window.__jarvisRoot`).
- Al montar correctamente, retirar `#__boot_fallback`.
- Si falta `#root` o hay fallo temprano, propagar error para que lo capture `bootApp()` de `index.html`.

4) `src/lib/runtimeFreshness.ts` — no interferir con recuperación manual
- Mantener skip en iframe.
- Añadir guard para no ejecutar limpieza automática cuando existe bandera de boot manual (`__jarvis_booting`) para evitar choques entre estrategias.

5) Validación
- Preview `/login`: debe pasar de fallback a login.
- Clic en “Reintentar”: debe intentar boot sin quedarse en loop.
- Confirmar que en caso de fallo real aparezca mensaje visible (no pantalla congelada).
- Verificar que Published no cambia comportamiento de login.

Detalles técnicos
- Cambio clave: pasar de “cargar módulo una vez y recargar página” a “boot programático con `import()` + captura de error + limpieza + retry real”.
- Esto cubre fallos de red/caché del bundle inicial y evita que el usuario quede atrapado en “Cargando JARVIS...” sin diagnóstico.
- Archivos a tocar: `index.html`, `src/main.tsx`, `src/lib/runtimeFreshness.ts`.
