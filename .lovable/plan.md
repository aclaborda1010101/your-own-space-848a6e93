

## Qué pasa

El brief de "mañana" del dashboard te dice "no hay eventos programados" cuando tienes 4 reuniones reales en iCloud. **Es un bug puro**:

- Tu calendario real vive en **iCloud** (CalDAV) y se consulta vía la edge function `icloud-calendar` (acción `fetch`).
- Pero la edge function `daily-context-brief` (la que genera el "Brief de mañana") consulta una **tabla `calendar_events` de Supabase que NO EXISTE** en tu base de datos. Lo confirmé con SQL: `relation "calendar_events" does not exist`.
- Resultado: siempre devuelve `cal_count: 0`, el LLM lee "Sin eventos en el calendario para mañana" y escribe lo que escribe ("día tranquilo, sin eventos…").
- Lo mismo le pasa a `suggest-actions` (sugerencias del menú activo).

El brief cacheado de hoy en tu BD lo confirma: `context_snapshot.cal_count: 0`. Por eso el mensaje de "tranquilo, ponte al día".

## Plan

### 1) Arreglar `supabase/functions/daily-context-brief/index.ts`
Sustituir la consulta a la tabla fantasma `calendar_events` por una llamada interna a la edge function `icloud-calendar` con `action: "fetch"` y rango `[mañana 00:00, mañana 23:59]`:

- Reusa el mismo Bearer token del usuario (ya lo tenemos en `authHeader`).
- Mapeo: la respuesta de iCloud devuelve `{ id, title, date, time, duration, location, allDay }`. Genero el `calendarBlock` actual a partir de eso (`time`, `title`, `location`).
- Manejo robusto: si `connected: false` o falla, devuelvo "Sin datos de calendario disponibles" en vez de "Sin eventos" (no es lo mismo; así el LLM no inventa que estás libre).
- Filtrar `allDay` aparte para no contarlos como reuniones.

### 2) Invalidar el brief erróneo cacheado
El brief cacheado de hoy ya tiene `cal_count: 0`. Hay que **forzar regeneración** una vez:
- Opción rápida (sin migración): el frontend llama `daily-context-brief?force=true` la próxima vez que abra el dashboard si el `context_snapshot.cal_count === 0` y hay eventos reales.
- O simple: borrar la fila cacheada de hoy con `scope='tomorrow'` para tu user_id (lo hago vía migración SQL one-shot al desplegar).

Voy con la opción simple: la migración limpia `daily_briefs` donde `scope='tomorrow' AND brief_date >= CURRENT_DATE`. La próxima carga regenera con el fix.

### 3) Arreglar `supabase/functions/suggest-actions/index.ts`
Mismo bug, mismo arreglo: cambiar el `from('calendar_events')` por una llamada interna a `icloud-calendar fetch` para las próximas 24h. Mantengo el resto de la lógica (tareas, hábitos, knowledge base).

### 4) Mejora del prompt de `tomorrow` (pequeño endurecimiento)
En el prompt, añadir esta línea al system: *"Si el bloque de calendario está vacío o dice 'Sin datos disponibles', NO afirmes que el día está libre — di literalmente 'No he podido confirmar tu agenda con iCloud' y pide al usuario revisar la conexión."* Así si el iCloud falla en el futuro, no vuelve a inventar "día tranquilo".

## Ficheros que tocaré

- `supabase/functions/daily-context-brief/index.ts` — sustituir consulta + endurecer prompt.
- `supabase/functions/suggest-actions/index.ts` — sustituir consulta.
- Migración SQL — borrar el brief cacheado de hoy/mañana para forzar regeneración con datos reales.

## Lo que NO toco

- `jarvis-core` y `jarvis-gateway` — estos ya reciben los eventos correctos desde el frontend (vía `useCalendar` → iCloud). Funcionan bien.
- `daily-briefing` (Morning Briefing) — no toca calendario directamente, recibe contexto montado por separado.
- La edge function `icloud-calendar` — funciona, no se cambia.

## Resultado esperado

Refrescas el dashboard → el "Brief de mañana" dirá algo tipo *"Mañana arrancas a las 09:00 con 4 reuniones encadenadas hasta mediodía. Foco: preparar lo de Hiba antes de la primera. Tarde libre para deep work."* en vez de "día tranquilo".

