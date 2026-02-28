
Do I know what the issue is? Sí.  
Problema real: el botón **Reintentar** reconstruye la URL con `window.location.pathname`, eliminando query params de Preview (incluyendo `__lovable_token`). Después de eso, `/src/main.tsx` deja de servirse como módulo y React nunca monta.

Implementación

1) `index.html` — conservar query params en retry
- Reemplazar `window.location.replace(window.location.pathname+'?retry='+Date.now())` por lógica con `new URL(window.location.href)`:
  - `url.searchParams.set('retry', Date.now().toString())`
  - `window.location.replace(url.toString())`
- Mantener limpieza de SW/caches previa.

2) `index.html` — autorecuperación si ya se perdió el token
- Añadir `recoverPreviewAuthIfNeeded()` antes del arranque:
  - si host termina en `.lovableproject.com`,
  - y falta `__lovable_token`,
  - extraer `project_id` del subdominio (UUID),
  - redirigir a `https://lovable.dev/auth-bridge?project_id=...&return_url=<url_actual>`.
- Evitar bucle con flag `__jarvis_auth_recover=1`.

3) `index.html` — diagnóstico inmediato de fallo de módulo
- Añadir listeners `error` y `unhandledrejection` para actualizar `#__boot_status` a “Error de carga del módulo”.
- Mostrar `#__boot_retry` inmediatamente al fallo (sin esperar timeout).

4) `src/main.tsx` — coordinación robusta del boot
- Marcar `window.__jarvis_booting = true` al inicio y `false` al terminar montaje (o en bloque seguro).
- Mantener `__jarvisRoot` y eliminación de `#__boot_fallback` tras mount correcto.

Validación

1) Abrir Preview en `/login` y comprobar que desaparece “Cargando JARVIS...”.  
2) Ver en Network que `/src/main.tsx` responde 200 como módulo JS.  
3) Pulsar “Reintentar” y confirmar que la URL **conserva** params existentes + `retry`.  
4) Probar URL sin token y confirmar redirección automática a `auth-bridge` y vuelta al app.  
5) Verificar `/dashboard`, `/chat`, `/settings` para confirmar que no hay regresiones.

Detalles técnicos
- Evidencia clave: sin token, `/src/main.tsx` devuelve HTML de login (no JS), lo que deja el fallback fijo.
- Corrección principal: no perder parámetros de sesión de Preview y añadir recuperación automática cuando ya se perdieron.
