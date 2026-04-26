# Diagnóstico

El preview de Lovable te muestra una versión obsoleta del Dashboard (de hace meses) hasta que escribes/interactúas. Esto es un fallo de cache de iframe + bundle del preview, no del código de negocio.

**Causas probables:**

1. **`runtimeFreshness.ts` solo invalida cuando detecta `__APP_BUILD_ID__` cambiado**, pero ese build ID no se actualiza en cada deploy del preview de Lovable, solo en builds de producción. Por eso el Dashboard renderizado queda "congelado" hasta que React monta y empieza a refetch al primer evento del usuario (focus/click/escribir).

2. **El comentario `// cache-bust:` en `src/main.tsx` está fechado el 2026-04-25T21:05** — no se ha actualizado desde la última sesión de trabajo intenso, por lo que el bundler de Lovable puede estar sirviendo el chunk anterior.

3. **No hay revalidación en mount** del Dashboard: los hooks (`useCheckIn`, `useTasks`, `useCalendar`) cargan datos en `useEffect` pero si el bundle viene de cache, los efectos pueden estar leyendo de una versión vieja del estado en memoria del iframe.

# Plan de arreglo (3 cambios mínimos, sin tocar lógica de negocio)

### 1. Forzar cache-bust del bundle
- Actualizar `src/main.tsx` línea 1 con timestamp actual (`// cache-bust: 2026-04-26T07:00`).
- Esto fuerza a Vite/Lovable a regenerar el chunk principal y al iframe a descargar bundle nuevo.

### 2. Endurecer `runtimeFreshness` para el preview
En `src/lib/runtimeFreshness.ts`:
- En la rama `isPreview()`, además del check actual de Service Worker controller, **comparar el timestamp del HTML servido vs el del bundle cargado**. Si el `index.html` indica un build distinto al que tiene el JS en memoria, forzar `navigateToFreshUrl()` una sola vez.
- Implementación concreta: leer `<meta name="x-build-ts">` del `document.head` (lo añade Lovable en cada deploy) y compararlo con `__APP_BUILD_ID__`. Si difieren, `nukeSwAndCaches()` + `navigateToFreshUrl()`.
- Mantener el límite de `PREVIEW_RESET_MAX_ATTEMPTS = 2` para no entrar en loop.

### 3. Revalidación al volver a la pestaña en el Dashboard
En `src/pages/Dashboard.tsx`:
- Añadir un `useEffect` que escuche `visibilitychange` y, cuando `document.visibilityState === "visible"`, dispare un re-fetch ligero de `useCheckIn`, `useTasks`, `useCalendar` (las funciones `refresh`/`refetch` que ya exponen).
- Esto garantiza que aunque el bundle quede en cache, los datos visibles se refresquen al primer foco — eliminando la sensación de "Dashboard de hace meses".

# Lo que NO voy a tocar

- Lógica de F7/Step 30/proposal builder (ya está estable).
- Pipeline v2 (Step 25–29).
- Auth, hooks de datos, layout, navegación.
- Service Worker (sigue desactivado, correcto).

# Criterios de aceptación

1. Al abrir el preview, el Dashboard muestra datos actuales **antes** de cualquier interacción del usuario.
2. Si Lovable redeploya el preview, una sola recarga deja el bundle al día (no hace falta hard-refresh manual).
3. Volver a la pestaña tras dejarla en background actualiza tareas/check-in/calendario sin recargar.
4. No hay loops de reload (máximo 2 intentos por sesión).

# Archivos a editar

- `src/main.tsx` (1 línea)
- `src/lib/runtimeFreshness.ts` (~15 líneas en la rama preview)
- `src/pages/Dashboard.tsx` (1 `useEffect` nuevo, ~10 líneas)

¿Apruebas?