
# Conectar sugerencias aceptadas con la tabla de tareas

## Problema detectado

Cuando aceptas una sugerencia de tipo "task" (desde Inbox o desde un Brain Dashboard), el codigo solo actualiza el campo `status` de la sugerencia a "accepted" en la tabla `suggestions`. Pero **nunca inserta una fila nueva en la tabla `tasks`**. Por eso la pagina de Tareas muestra 0.

## Solucion

Modificar la logica de `updateSuggestion` en los dos sitios donde se usa (Inbox y BrainDashboard) para que, cuando se acepte una sugerencia de tipo `task`, se cree automaticamente una tarea en la tabla `tasks`.

### Logica al aceptar una sugerencia tipo "task"

1. Actualizar `suggestions.status` a "accepted" (como ya se hace)
2. Leer el campo `content` (JSONB) de la sugerencia para extraer titulo, descripcion y contexto
3. Insertar una nueva fila en `tasks` con:
   - `title`: del content de la sugerencia
   - `type`: "work" por defecto (o inferirlo del brain si viene de BrainDashboard)
   - `priority`: calculado con `autoPriority` segun due_date si existe
   - `duration`: 30 min por defecto
   - `source`: "plaud" o "suggestion"
   - `description`: contexto de la transcripcion
   - `completed`: false

### Tambien aplicar logica similar para otros tipos

- `follow_up` aceptado: insertar en tabla `follow_ups` si no se esta haciendo ya
- `event` aceptado: podria crear evento en calendario (futuro)
- `idea` aceptada: podria ir a proyectos (futuro)

Por ahora nos centramos en `task` que es lo que has pedido.

## Detalles tecnicos

### Archivos a modificar

1. **`src/pages/Inbox.tsx`** - Ampliar `updateSuggestion.mutationFn` para que al aceptar una sugerencia tipo task, haga INSERT en `tasks`
2. **`src/pages/BrainDashboard.tsx`** - Misma logica en su `updateSuggestion`

### Cambio en la mutacion (ambos archivos)

```text
mutationFn: async ({ id, status, suggestion_type, content }) => {
  // 1. Actualizar estado de la sugerencia
  await supabase.from("suggestions").update({ status }).eq("id", id);

  // 2. Si es task aceptada, crear tarea real
  if (status === "accepted" && suggestion_type === "task") {
    const title = content?.label || content?.title || "Tarea desde transcripcion";
    const description = content?.data?.context || content?.description || null;
    await supabase.from("tasks").insert({
      user_id: user.id,
      title,
      type: "work",
      priority: "P1",
      duration: 30,
      completed: false,
      source: "plaud",
      description,
    });
  }
}
```

### Sin cambios de esquema

La tabla `tasks` ya tiene las columnas `source` y `description`. No se necesitan migraciones.
