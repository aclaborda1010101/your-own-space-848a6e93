He verificado que en el Preview ya está cargando la versión nueva: aparece `v11 — LIFE OPERATING SYSTEM` y el HTML incluye el fallback lime. El problema que sigues viendo está en la URL publicada `pure-logic-flow.lovable.app`: todavía sirve un deployment anterior con `theme-color #0f172a`, fallback azul `#141b2d`, assets `index-DN2_FrHW.js / index-C1pb-MP7.css` y texto visible `v2.0 — SISTEMA OPERATIVO PERSONAL`.

Plan para dejarlo resuelto:

1. Corregir el último resto azul en runtime
   - Actualizar `src/App.tsx` para que el `AppErrorBoundary` use fondo `#07090E`, texto lime y estilos coherentes con v11, no `#141b2d/#fff`.

2. Endurecer limpieza de Service Worker
   - Ajustar `public/sw.js` al patrón kill-switch recomendado: reclamar clientes, borrar cachés, navegar clientes con parámetro de limpieza y luego desregistrarse.
   - Mantener `public/registerSW.js` como kill-switch para páginas antiguas que todavía intenten cargar `/registerSW.js`.

3. Eliminar PWA residual del bundle futuro
   - Quitar `vite-plugin-pwa` de dependencias si ya no se usa.
   - Limpiar referencias TypeScript innecesarias en `src/vite-env.d.ts`.
   - No reintroducir manifest/SW en `index.html`, para evitar que Lovable Preview o la publicación vuelvan a quedarse con shell viejo.

4. Actualizar marcadores de build/cache
   - Cambiar `// cache-bust` en `src/main.tsx` a un valor nuevo para forzar rebuild.
   - Mantener los logs `active shell v11-lime` y el guard anti-shell viejo.

5. Verificación en Preview
   - Confirmar en `/` y `/login` que aparece `v11 — LIFE OPERATING SYSTEM`.
   - Confirmar que el HTML ya no contiene fallback azul y que no hay `theme-color #0f172a`.
   - Confirmar que no hay bucles de reload y que el shell activo es `v11-lime`.

6. Paso manual necesario para producción
   - Después de aplicar los cambios, deberás pulsar `Publish` / `Update` en Lovable para que `https://pure-logic-flow.lovable.app` deje de servir el deployment viejo. Los cambios frontend no se publican automáticamente; ahora mismo la URL publicada está en un deployment anterior aunque el Preview ya esté actualizado.