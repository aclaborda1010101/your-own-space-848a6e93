
# Plan: Tareas de Plaud con detalle expandible y fechas editables

## Resumen

Las tareas extraidas de Plaud (y otras fuentes no manuales) actualmente se muestran igual que las manuales: solo titulo, tipo, prioridad y duracion. Este plan anade:

1. **Detalle expandible (collapsible)** en cada tarea que muestra informacion de contexto: de donde vino (source), resumen de la transcripcion original, y compromisos relacionados.
2. **Fecha de entrega editable** directamente desde la tarea, permitiendo asignar o modificar el `due_date` desde la lista de tareas.

---

## Cambios necesarios

### 1. Nuevo campo `description` en la tabla `tasks`

Agregar una columna `description` (text, nullable) para almacenar contexto adicional cuando la tarea proviene de Plaud u otra fuente automatizada.

```text
ALTER TABLE tasks ADD COLUMN description text;
```

### 2. Modificar `process-transcription` para insertar tareas directamente

Actualmente las tareas extraidas de Plaud van solo a `suggestions`. Modificar la Edge Function para que TAMBIEN las inserte directamente en la tabla `tasks` con:
- `source = 'plaud'` (o el source correspondiente)
- `description` = contexto de la transcripcion (resumen + titulo)
- `due_date` = deadline si se detecto, o null
- `priority` = auto-calculada con `autoPriority`

Esto se hara al final del procesamiento, despues de guardar la transcripcion.

### 3. Actualizar `useTasks.tsx`

- Agregar `description` al interface `Task`
- Agregar funcion `updateTask` para modificar campos como `due_date` y `description`
- Mapear `description` desde la DB

### 4. Redisenar `SwipeableTask.tsx` con detalle expandible

- Agregar un `Collapsible` que se abre al hacer tap en la tarea
- Contenido expandible:
  - Origen (badge con el `source`: manual, plaud, email, whatsapp)
  - Descripcion/contexto si existe
  - Selector de fecha con DatePicker para asignar/modificar `due_date`
- Mantener el swipe para completar/eliminar

### 5. Actualizar `Tasks.tsx`

- Pasar la nueva funcion `updateTask` al `SwipeableTask`
- Mostrar indicador visual en tareas que tienen `source !== 'manual'` (icono de microfono para plaud, etc.)

---

## Detalles tecnicos

### Migracion SQL
```text
ALTER TABLE tasks ADD COLUMN description text;
```

### Cambios en `process-transcription/index.ts`
Despues de guardar sugerencias, agregar bloque que inserte tareas directamente:
```text
if (extracted.tasks?.length) {
  const taskRows = extracted.tasks.map(t => ({
    user_id: userId,
    title: t.title,
    type: t.brain === 'bosco' ? 'life' : t.brain === 'professional' ? 'work' : 'life',
    priority: t.priority === 'high' ? 'P1' : t.priority === 'medium' ? 'P2' : 'P3',
    duration: 30,
    completed: false,
    source: source,
    description: `Extraida de: ${extracted.title}. ${extracted.summary}`,
    due_date: null,
  }));
  await supabase.from('tasks').insert(taskRows);
}
```

### Cambios en `SwipeableTask.tsx`
- Importar `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`
- Importar `Popover`, `PopoverTrigger`, `PopoverContent`, `Calendar`
- Agregar estado `isOpen` para el collapsible
- Al expandir, mostrar:
  - Badge de origen (source) con icono contextual
  - Texto de descripcion si existe
  - DatePicker inline para modificar fecha
- El area del titulo actua como trigger del collapsible (sin interferir con swipe en mobile)

### Cambios en `useTasks.tsx`
Nueva funcion `updateTask`:
```text
const updateTask = async (id: string, updates: { due_date?: string | null; description?: string }) => {
  const { error } = await supabase.from('tasks').update(updates).eq('id', id);
  if (error) throw error;
  // Refetch o update local
};
```

---

## Secuencia de implementacion

1. Migracion DB: agregar columna `description`
2. Actualizar `useTasks.tsx` con `description` y `updateTask`
3. Redisenar `SwipeableTask.tsx` con collapsible y DatePicker
4. Actualizar `Tasks.tsx` para pasar `updateTask`
5. Modificar `process-transcription` para insertar tareas directamente
6. Deploy de la Edge Function
