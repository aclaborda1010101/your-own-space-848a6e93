He comprobado la preview en `/calendar`: ya está cargando el bundle nuevo (`[jarvis] active shell v11-lime`), así que no es el snapshot viejo. Lo azul que sigues viendo viene de dos cosas reales del código actual:

1. El fallback inicial en `index.html` sigue con fondo `#141b2d`, que es azul oscuro, y se queda visible durante la carga/redirección.
2. La página de login aún muestra el texto antiguo `v2.0 — SISTEMA OPERATIVO PERSONAL`; ese texto activa el sentry de “shell vieja”, provocando recargas y dejando la sensación de que “sigue igual”.
3. En `/calendar` hay clases Tailwind explícitas `bg-blue-*`, `text-blue-*`, `border-blue-*` para eventos de trabajo, por eso el calendario se ve azul aunque el tema base sea lima.

Plan para arreglarlo de verdad:

1. Corregir el fallback de arranque
   - Cambiar el fondo inline de `#__boot_fallback` de `#141b2d` a negro/lima (`#07090E` con detalles lima).
   - Cambiar `theme-color` de `#0f172a` a `#07090E` para evitar barras/fondos azulados.
   - Hacer que el loader inicial use lima visible y no un bloque azul.

2. Eliminar el falso marcador viejo del login
   - En `src/pages/Login.tsx`, reemplazar `v2.0 — SISTEMA OPERATIVO PERSONAL` por una versión actual tipo `v11 — LIFE OPERATING SYSTEM`.
   - Mantener todos los acentos del login en `primary` para que sean lima.
   - Esto evita que el runtime sentry detecte el propio login como “shell vieja” y empiece a recargar.

3. Cambiar los azules visibles del calendario
   - En `src/pages/Calendar.tsx`, `src/components/calendar/CalendarLegend.tsx`, `MonthView.tsx`, `WeekView.tsx`, `DayView.tsx` y `CalendarTypeFilter.tsx`, reemplazar el color `work` de azul a lima/primary.
   - Mantener otros colores semánticos si no son problema: vida verde, finanzas ámbar, salud rosa, familia violeta.
   - El resultado será que “Trabajo” ya no se pinte azul.

4. Cambiar los azules del briefing que aparecen en dashboard/start-day
   - En `MorningBriefingCard.tsx` y `TomorrowBriefCard.tsx`, cambiar `text-blue-*` por `text-primary`/`text-primary/80`.

5. Ajustar el sentry para que no recargue por textos públicos legítimos
   - Quitar `v2.0 — SISTEMA` como detector genérico o limitarlo a sidebar antigua, no al login.
   - Mantener detección de `JARVIS v2.0` y `Comunicaciones` si aparecen en navegación real.

6. Forzar refresh de Lovable
   - Actualizar el `cache-bust` en `src/main.tsx` para que la preview recomponga.
   - Mantener `jarvis_shell=v11-lime`.

7. Verificación
   - Abrir `/calendar` en la preview.
   - Confirmar que ya no se ve el fallback azul.
   - Confirmar que login no muestra `v2.0`.
   - Confirmar que los elementos de calendario tipo “Trabajo” ya no son azules sino lima/primary.
   - Confirmar en consola que aparece `active shell v11-lime` sin bucles de recarga.