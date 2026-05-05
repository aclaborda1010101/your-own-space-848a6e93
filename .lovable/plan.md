# Forzar refresco real del iframe de preview de Lovable

## Problema

La URL directa muestra la versión nueva, pero el iframe de preview de Lovable sigue mostrando la versión vieja. El guard `runtimeFreshness.ts` no es capaz de detectar el desfase porque le faltan las señales de build que espera leer del HTML.

## Causa raíz

1. `src/lib/runtimeFreshness.ts` busca `<meta name="x-build-ts">` o `window.__APP_BUILD_TS__` para detectar mismatch HTML↔bundle. Ninguno existe en `index.html`, así que la rama de auto-recarga del iframe nunca se dispara.
2. Hay que confirmar si `vite.config.ts` define `__APP_BUILD_ID__` con un timestamp único por build. Si está fijo, `handleBuildChange()` tampoco se entera.

## Cambios

### 1. `vite.config.ts`
- Asegurar que `define` inyecta `__APP_BUILD_ID__: JSON.stringify(Date.now().toString())` en cada build (verificar primero, añadir si falta).

### 2. `index.html`
- Añadir en `<head>`:
  ```html
  <meta name="x-build-ts" content="__BUILD_TS__" />
  <script>window.__APP_BUILD_TS__ = "__BUILD_TS__";</script>
  ```
- Añadir un plugin Vite simple (o usar `transformIndexHtml` inline en `vite.config.ts`) que reemplace `__BUILD_TS__` con `Date.now()` en cada build.

### 3. `src/lib/runtimeFreshness.ts`
- Bajar `PREVIEW_RESET_MAX_ATTEMPTS` mismatch a 1 (ya está en 2, suficiente, dejar igual).
- Asegurar que `htmlBuildMismatchesBundle()` también dispara `nukeSwAndCaches()` (ya lo hace).
- Sin más cambios.

### 4. `src/main.tsx`
- Actualizar el comentario `// cache-bust` con nuevo timestamp para forzar rebuild del bundle.

## Resultado esperado

Cada nuevo build de Lovable:
1. Sirve un `index.html` con un `x-build-ts` nuevo.
2. Si el iframe corre un bundle viejo, `__APP_BUILD_ID__ !== x-build-ts` → `runtimeFreshness` borra SW/caché y recarga el iframe automáticamente.
3. El usuario ve la versión nueva sin abrir pestaña aparte.

## Verificación

- Abrir el iframe de preview, comprobar en consola que `window.__APP_BUILD_TS__` y `__APP_BUILD_ID__` coinciden.
- Forzar un nuevo cambio trivial y confirmar que el iframe se auto-recarga sin intervención.
