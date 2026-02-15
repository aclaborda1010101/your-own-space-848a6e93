

# Unificar Calendario: Google + iCloud (Apple)

## Problema

El hook `useCalendar` (usado por la pagina `/calendar`) solo delega a Google Calendar. La integracion con iCloud Calendar existe y funciona (edge function, hook, tarjeta de settings), pero sus eventos no se muestran en la pagina del calendario. Solo el `AgendaCard` del dashboard usa iCloud.

## Solucion

Modificar `useCalendar.tsx` para que combine los eventos de ambos proveedores (Google Calendar e iCloud Calendar) en una sola lista unificada.

### Archivo: `src/hooks/useCalendar.tsx`

**Cambios:**

1. Importar `useICloudCalendar` ademas de `useGoogleCalendar`
2. Combinar los eventos de ambos proveedores en un solo array, transformando los eventos de iCloud al formato `CalendarEvent` que espera la pagina
3. Exponer el estado `connected` como `true` si cualquiera de los dos esta conectado
4. Combinar los estados de `loading` y `syncing`
5. Al llamar `fetchEvents`, ejecutar ambos en paralelo

### Detalles tecnicos

Los eventos de iCloud (`ICloudEvent`) tienen un formato ligeramente diferente a `CalendarEvent`:
- `ICloudEvent`: `{ id, title, time, duration, type, location, allDay }`  
- `CalendarEvent`: `{ id, googleId, title, date, time, duration, type, description, location, htmlLink }`

Se necesita una funcion de transformacion que convierta `ICloudEvent` a `CalendarEvent`, anadiendo el campo `date` que falta en iCloud (se usara la fecha actual o la fecha del fetch).

El hook de iCloud usa `fetchEvents(startDate, endDate)` con objetos `Date`, mientras que Google usa strings ISO. Se adaptaran las llamadas para que ambos reciban los parametros correctos.

### Resultado

La pagina `/calendar` mostrara eventos de Google Calendar y de iCloud Calendar combinados. Si solo uno esta conectado, mostrara los eventos de ese proveedor. El usuario puede configurar iCloud desde Ajustes como antes.

