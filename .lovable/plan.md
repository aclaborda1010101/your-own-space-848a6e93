
Objetivo: endurecer la limpieza de caché del preview para que la app cargue siempre la versión más reciente sin depender de recargas manuales agresivas.

Qué he revisado:
- `src/main.tsx`: la app ya ejecuta `ensureRuntimeFreshness()` antes de montar React.
- `src/lib/runtimeFreshness.ts`: ya limpia Service Workers y `caches`, detecta preview/publicado y añade query params como `_cb` y `__jarvis_preview_bust`.
- `public/registerSW.js` y `public/sw.js`: ambos están configurados como “kill-switch” para desregistrar workers antiguos.
- `src/components/layout/ForceRefreshButton.tsx`: ya existe un botón para forzar limpieza.
- `src/components/layout/AppLayout.tsx`: el botón ya está montado globalmente.
- La ruta actual del preview ya lleva `_cb=...`, así que el cache-buster ya está entrando en juego.

Plan de implementación:
1. Reforzar el botón de “Forzar actualización”
- Mantener la limpieza de Service Workers y Cache Storage.
- Añadir limpieza de flags locales que pueden impedir una recarga fresca:
  - `__jarvis_build_id`
  - `__jarvis_reloaded`
  - `__jarvis_preview_sw_reset_attempts`
  - `__jarvis_auto_retry`
  - `__jarvis_chunk_reload`
- Recargar con un query param nuevo para evitar reutilizar una URL previa cacheada.

2. Endurecer la lógica automática de preview
- En `runtimeFreshness`, conservar la lógica actual pero hacerla más consistente en preview:
  - si detecta control de SW antiguo, limpiar y recargar una sola vez;
  - si vuelve de suspensión/largo tiempo en segundo plano, regenerar cache-buster;
  - evitar bucles manteniendo el límite de intentos.

3. Unificar el criterio de “URL fresca”
- Usar siempre el mismo patrón de query params de invalidación para preview/manual refresh.
- Evitar que unas rutas usen `_cb` y otras dependan solo de `__jarvis_preview_bust` sin necesidad.

4. Validar que no haya re-registro accidental del SW
- Revisar que no exista en otro archivo ninguna llamada que vuelva a registrar service workers.
- Mantener los archivos públicos actuales como mecanismo de desactivación, no como caché offline.

5. QA después del cambio
- Desktop:
  - abrir preview normal;
  - pulsar el botón de refresh;
  - comprobar que recarga una vez, no entra en loop y sigue navegando bien.
- Mobile:
  - repetir en viewport pequeño para asegurar que el botón sigue visible y usable.
- Confirmar que:
  - desaparecen versiones antiguas del frontend;
  - no hay errores por storage bloqueado;
  - el flujo de exportación sigue igual;
  - no aparece una pantalla en blanco tras la limpieza.

Archivos a tocar:
- `src/components/layout/ForceRefreshButton.tsx`
- `src/lib/runtimeFreshness.ts`
- Posible ajuste menor en `src/main.tsx` si hace falta coordinar mejor los flags
- Solo revisión, probablemente sin cambios, en:
  - `public/registerSW.js`
  - `public/sw.js`

Detalles técnicos:
- La base ya está bien planteada: no hay PWA activa en frontend y ya existe un “kill switch”.
- El problema más probable no es falta de lógica, sino que quedan marcadores/estados locales que permiten reusar una sesión de preview parcialmente obsoleta.
- La solución más simple y directa es hacer más agresiva la limpieza del botón manual y más consistente el cache-busting automático, sin tocar el resto del flujo de la app.
