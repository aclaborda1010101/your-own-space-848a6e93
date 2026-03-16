
Problema detectado: sí hay mecanismos anti-caché, pero todavía quedan dos huecos que explican por qué “sigue cacheada”.

1. Qué está pasando realmente
- `index.html` ya detecta errores de chunks/import dinámico, pero en esos casos hace `location.reload()`.
- `src/lib/runtimeFreshness.ts` en `lovable.app` solo limpia SW/caches y devuelve `false`; no fuerza recarga con cache-buster cuando cambia el build.
- Si el navegador conserva un `index.html` viejo, esa recarga simple puede volver a pedir la misma URL y quedarse apuntando a chunks antiguos.
- Además, el log `server connection lost` sugiere que hubo cambio de build/hot restart mientras estabas en la ruta del wizard, justo el caso típico de HTML viejo + chunks nuevos.

2. Evidencia en el código
- `index.html`:
  - `vite:preloadError` usa `location.reload()`
  - `unhandledrejection` para “failed to fetch dynamically imported module” también usa `location.reload()`
- `runtimeFreshness.ts`:
  - en preview sí usa `__jarvis_preview_bust`
  - en published `lovable.app` no usa ningún query bust; solo limpia caches
- `App.tsx`:
  - `ProjectWizard` está cargado con `React.lazy(...)`, así que es especialmente sensible a `index.html` obsoleto.

3. Plan de fix
- Unificar la estrategia de recuperación para preview y published:
  - crear un helper común de “hard reload con cache-buster” (`?_cb=timestamp` o similar)
  - usar ese helper en vez de `location.reload()` para:
    - `vite:preloadError`
    - `failed to fetch dynamically imported module`
    - recarga por cambio de build en `runtimeFreshness.ts`
- Mejorar `runtimeFreshness.ts` para published:
  - no solo limpiar SW/caches
  - también comparar `__APP_BUILD_ID__` y, si cambió, hacer una única recarga con query param anti-caché
  - mantener protección anti-loop con `sessionStorage`
- Endurecer la recuperación del bootstrap:
  - cuando falle una carga de chunk, limpiar `__jarvis_boot_auto_retry` / `__jarvis_chunk_reload` de forma coherente solo después de montar bien
  - asegurar que el botón “Reintentar” también usa la misma URL cache-busted
- Revisar el warning del diálogo:
  - `PublishToForgeDialog` está provocando `Function components cannot be given refs`
  - no es la causa de la caché, pero conviene corregirlo porque contamina consola y complica el diagnóstico

4. Archivos a tocar
- `index.html`
  - reemplazar todos los `location.reload()` de recuperación por navegación a URL con cache-buster
- `src/lib/runtimeFreshness.ts`
  - aplicar detección de build también en `lovable.app`
  - hacer bypass reload de una sola vez
- opcionalmente `src/main.tsx`
  - revisar cuándo se limpian flags de recovery para no resetearlas demasiado pronto
- `src/components/projects/wizard/PublishToForgeDialog.tsx`
  - corregir el componente que recibe ref indirectamente en `DialogHeader`/estructura del modal

5. Resultado esperado
- Si hay `index.html` viejo, la app hará una navegación forzada a una URL nueva y dejará de reutilizar la referencia obsoleta.
- Al cambiar de build o de ventana, el wizard debería recuperarse solo en vez de quedar “cacheado”.
- Se reducirá el riesgo de que `/projects/wizard/:id` siga intentando cargar módulos con timestamps antiguos.

6. Orden de implementación
- Primero: unificar hard reload con cache-buster en `index.html`
- Segundo: corregir `runtimeFreshness.ts` para published builds
- Tercero: revisar flags de recovery en `main.tsx`
- Cuarto: limpiar el warning de `PublishToForgeDialog`
- Quinto: publicar manualmente desde Lovable para que el fix llegue al entorno live/preview

7. Nota importante
- Aunque implemente el fix, en este proyecto el frontend no queda visible hasta que pulses `Publish` / `Update` manualmente en Lovable. Si no se publica, seguirás viendo la versión cacheada anterior.
