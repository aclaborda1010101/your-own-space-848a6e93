Entiendo el problema: la app debería verse con el shell lima de `JARVIS v11 · ONLINE`, pero la preview de Lovable sigue sirviendo una UI azul antigua (`JARVIS v2.0`, menú viejo con Comunicaciones, Dashboard azul). El código actual sí contiene el tema lima; por tanto el fallo real no es de diseño, es que la preview está cargando un bundle/HTML viejo o una versión guardada antigua.

Plan de corrección:

1. Endurecer el guard anti-caché antes de React
   - Cambiar el botón de recuperación del fallback de `index.html` para usar lima, no azul.
   - Añadir un `BUILD_ID` visible también en el DOM como marca de versión, no solo en consola, para poder distinguir inequívocamente si la preview está ejecutando el build correcto.
   - Hacer que el guard temprano limpie Service Workers y Cache Storage esperando a que terminen antes de recargar, en vez de lanzar promesas y recargar inmediatamente.

2. Eliminar referencias azules que todavía quedan en arranque/error
   - `index.html`: sustituir `#3b82f6` por lima `#BEFF00` en el botón de reintento.
   - `src/App.tsx`: sustituir el botón azul del error boundary por lima.
   - Esto no arregla por sí solo la preview vieja, pero evita que cualquier pantalla de recuperación parezca la UI azul.

3. Forzar que la preview invalide también módulos Vite en dev/preview
   - Actualizar `src/main.tsx` con un nuevo cache-bust.
   - Añadir una pequeña marca global de build en `main.tsx` (`window.__JARVIS_ACTIVE_SHELL = 'v11-lime'`) y log claro (`[jarvis] active shell v11-lime`).
   - Esto permitirá comprobar en consola si Lovable está ejecutando el código correcto o una versión vieja.

4. Hacer el botón flotante de refresh más agresivo y visible
   - Incluir también `__jarvis_html_build_ts` y `__jarvis_html_build_attempts` en las claves que borra.
   - Cambiar su estilo a lima para que sea coherente con el tema actual.
   - Mantener auth intacta; no borrar Supabase ni sesión.

5. Añadir una defensa CSS de tema en el HTML
   - Inyectar variables CSS mínimas de lima en `index.html` antes de cargar React para que, incluso durante fallback o recuperación, no aparezca azul.
   - No duplicar todo el sistema de diseño, solo los tokens críticos (`--primary`, `--ring`, `--sidebar-primary`).

6. Verificación posterior
   - Revisar que el código actual sigue mostrando `JARVIS v11 · ONLINE` en `SidebarNew.tsx` y tokens lima en `src/index.css`.
   - Comprobar consola/red en la preview para buscar `[jarvis] active shell v11-lime` y el build id.
   - Si Lovable sigue mostrando `Previewing last saved version` con la UI azul, entonces la causa no será el código sino que la preview está anclada a una versión guardada antigua. En ese caso indicaré exactamente qué hacer desde History/Preview para seleccionar la última versión, porque ningún cambio de código puede sobrescribir una preview que Lovable decide servir desde un snapshot antiguo.