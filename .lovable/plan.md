Confirmo el problema: el código actual ya no coincide con lo que ves. En el código actual el sidebar dice `v11 · ONLINE`, no existe `Comunicaciones` en el menú principal y `--primary` es lima. En la preview sigue apareciendo `JARVIS v2.0`/azul, así que el iframe está ejecutando un shell anterior o una copia cacheada que no queda invalidada por los guards actuales.

Plan para resolverlo de forma agresiva:

1. Convertir el guard de `index.html` en un reemplazo inmediato de shell antiguo
   - Antes de cargar React, detectar si el cliente conserva marcadores viejos (`JARVIS v2`, `v2.0`, ausencia de `v11-lime`, build anterior, SW activo o caches existentes).
   - Limpiar Service Workers y Cache Storage esperando a que termine la operación.
   - Limpiar sólo claves técnicas de cache/build de JARVIS, sin borrar sesión ni auth.
   - Recargar con una URL canónica `?jarvis_shell=v11-lime&jarvis_cb=<timestamp>` para romper cualquier snapshot/cache del iframe.

2. Añadir un “runtime sentry” post-montaje
   - En `src/main.tsx`, después del montaje, verificar el DOM real durante unos segundos.
   - Si encuentra textos imposibles en la versión actual (`JARVIS v2.0`, `Comunicaciones`) o si no encuentra el marcador `v11`, dispara la misma limpieza y recarga.
   - Esto cubre el caso donde el HTML sea nuevo pero un chunk antiguo se monte igualmente.

3. Hacer visible el diagnóstico dentro de la app
   - Añadir atributos/markers explícitos al root o body, por ejemplo `data-jarvis-shell="v11-lime"`.
   - Añadir logs claros: `[jarvis] active shell v11-lime` y `[jarvis] stale shell detected`.
   - Si vuelve a verse azul, podremos distinguir inmediatamente si está corriendo código nuevo o una snapshot antigua de Lovable.

4. Endurecer el botón flotante de refresh
   - Que borre todas las claves técnicas de guard/build/cache conocidas.
   - Que limpie SW/caches antes de recargar.
   - Que recargue con el mismo parámetro `jarvis_shell=v11-lime`.

5. Cambiar los restos visuales azules que sí pertenecen a `/start-day` y dashboard
   - Sustituir clases `text-blue-*`, `bg-blue-*`, `border-blue-*` usadas en tarjetas visibles de dashboard/start-day por tokens semánticos (`primary`, `accent`, `warning`) para que no quede azul en los CTAs principales.
   - Mantener colores azules sólo donde representen categorías específicas y no el tema global, si no afectan a esta pantalla.

6. Forzar rebuild de Lovable
   - Actualizar el `cache-bust` de `src/main.tsx` con un identificador nuevo.
   - Mantener la inyección global de build id de Vite.

7. Verificación
   - Revisar que el código actual contiene `v11 · ONLINE`, `data-jarvis-shell="v11-lime"`, parámetros `jarvis_shell`, y que no quedan tokens azules en el arranque.
   - Intentar abrir `/start-day` y revisar consola/red. Si aparece HTTP 412 en la herramienta de navegador, documentarlo: eso indica fallo de handshake/autenticación del proxy de preview, no del bundle React.

Si apruebas, aplico estos cambios directamente.