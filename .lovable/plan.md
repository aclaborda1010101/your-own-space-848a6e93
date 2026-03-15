
Objetivo: corregir el error en producción (“Cannot read properties of undefined (reading 'AppLayout')”) y el comportamiento de carga/reintentos al abrir `https://pure-logic-flow.lovable.app`.

1) Diagnóstico confirmado en código
- `src/App.tsx` usa un lazy import frágil para layout:
  - `import("./components/layout/AppLayout").then(m => ({ default: m.AppLayout }))`
- Ese patrón depende de named export en runtime y es sensible a bundles/caché/chunks en producción.
- Además, la detección de “preview” está demasiado amplia:
  - `index.html` y `src/lib/runtimeFreshness.ts` consideran `h.includes("lovable.app")` como preview.
  - Eso también afecta al dominio publicado (`pure-logic-flow.lovable.app`) y puede provocar limpiezas/reintentos no deseados.

2) Cambios a implementar
- Archivo: `src/App.tsx`
  - Eliminar el acceso a `m.AppLayout` en lazy.
  - Opción robusta (preferida): importar `AppLayout`, `WebSocketInitializer` y `UserSettingsProvider` de forma directa (no lazy), dejando lazy solo para páginas.
  - Alternativa: mantener lazy pero con default export real (sin depender de named export).
- Archivo: `src/components/WebSocketInitializer.tsx`
  - Añadir `export default` para estandarizar import si se mantiene lazy/default.
- Archivo: `src/hooks/useUserSettings.tsx`
  - Añadir `export default UserSettingsProvider` para estandarizar import si se mantiene lazy/default.
- Archivo: `src/lib/runtimeFreshness.ts`
  - Corregir `isPreview()` para NO tratar `*.lovable.app` publicado como preview (quitar `h.includes("lovable.app")`; dejar localhost/preview domains explícitos).
- Archivo: `index.html`
  - Igual ajuste en el script temprano anti-SW: quitar `h.includes("lovable.app")` de la condición preview y mantener solo hosts de preview reales.

3) Resultado esperado para ti
- Dejará de aparecer la pantalla de error de `AppLayout`.
- El acceso externo al dominio publicado ya no quedará en ciclo de “cargando/reintentando”.
- Dashboard y rutas protegidas cargarán normal tras login.

4) Validación (end-to-end)
- Publicar frontend con “Update”.
- Probar en ventana incógnito:
  - `/` (redirige/login correcto)
  - login → `/dashboard` (sin error AppLayout)
  - navegación a `/projects` y `/projects/wizard/:id`
- Verificar que no hay recargas automáticas repetidas ni pantalla de error global.

5) Nota técnica breve
- Esta corrección ataca dos causas probables del problema persistente:
  - Resolución frágil de módulos lazy por named export en runtime.
  - Clasificación errónea de entorno publicado como “preview”.
