Voy a arreglarlo como problema de caché de preview, sin tocar la lógica funcional.

Plan:
1. Forzar un nuevo rebuild real de la preview
   - Actualizar el marcador `// cache-bust` en `src/main.tsx` con un timestamp nuevo.
   - Esto fuerza a Lovable/Vite a recompilar y servir un bundle nuevo.

2. Hacer más robusta la detección de versión antigua
   - Revisar/ajustar `src/lib/runtimeFreshness.ts` para que la preview detecte mejor cuando está corriendo un JS antiguo y recargue con `_cb=<timestamp>`.
   - Mantener la regla actual: no borrar tokens de auth ni recargar agresivamente flujos largos.

3. Reforzar el botón manual de refresco
   - Confirmar que `ForceRefreshButton` limpia Service Workers, Cache Storage y flags internos.
   - Si hace falta, añadir también limpieza de flags faltantes como `__jarvis_boot_auto_retry` / mismatch para que el botón sí desbloquee previews atascadas.

4. Validación
   - Buscar de nuevo `Proyecto Predicción Stock` / `Predicción Stock` en el código para confirmar que no queda hardcodeado.
   - Confirmar que la migración ya renombra el registro a `Central Culinaria`.
   - Avisarte de los pasos manuales mínimos: pulsar el botón flotante de refresco o abrir la preview con `?_cb=<timestamp>` si el navegador aún conserva una copia vieja.

Resultado esperado:
- La preview debería dejar de mostrar la versión cacheada.
- El nombre `Central Culinaria` debería verse cuando la app lea el proyecto desde Supabase ya actualizado.