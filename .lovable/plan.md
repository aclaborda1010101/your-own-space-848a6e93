

## Plan: Añadir botón de eliminar en el historial de actividad del proyecto

El componente `ProjectActivityTimeline.tsx` no tiene ninguna funcionalidad de borrado. Hay que añadirla.

### Cambios en `src/components/projects/wizard/ProjectActivityTimeline.tsx`

1. **Importar** `Trash2` de lucide-react y `AlertDialog` components.

2. **Añadir estado** `deleteTarget` para rastrear qué entrada se quiere borrar.

3. **Añadir función `handleDelete`** que:
   - Borra los attachments asociados de `business_project_timeline_attachments`
   - Borra la entrada de `business_project_timeline`
   - Actualiza el estado local filtrando la entrada eliminada
   - Muestra toast de confirmación

4. **Añadir botón `Trash2`** en cada fila del timeline (junto al div principal del entry), visible on hover con `opacity-0 group-hover:opacity-100`.

5. **Añadir `AlertDialog`** de confirmación antes de borrar, con texto "¿Eliminar esta entrada del historial?" y botones Cancelar/Eliminar.

