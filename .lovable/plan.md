

## Qué quieres

En la lista de tareas pendientes, poder **eliminar una tarea** rápido (por si se ha colado una que no toca, o te has equivocado al crearla), sin tener que entrar a editarla.

## Estado actual

He revisado `src/components/tasks/SwipeableTask.tsx` y `src/pages/Tasks.tsx`:

- En **móvil** ya existe: deslizas la tarea a la izquierda y aparece el botón "Eliminar" (gestión por swipe).
- En **desktop** (que es donde estás ahora, viewport 1157px) **no hay botón visible de borrar**: solo se ve el checkbox a la izquierda y, al hacer hover, los botones de **editar** (lápiz) y **convertir a bloque** (calendario). El borrado por swipe en desktop no es descubrible y, con ratón, no es práctico.

Por eso percibes que "no se pueden borrar".

## Plan

### 1) Añadir botón de borrar visible en desktop
En `src/components/tasks/SwipeableTask.tsx`, dentro del bloque de acciones que ya aparece en hover (donde están "editar" y "convertir a bloque"):

- Añadir un tercer botón **Trash2** (rojo, `text-destructive`), al final del grupo.
- Click → abre un `AlertDialog` de confirmación ("¿Eliminar esta tarea? Esta acción no se puede deshacer.") con Cancelar / Eliminar.
- Al confirmar → llama al `onDelete(task.id)` que ya existe (mismo flujo que el swipe), con la misma animación de salida (`isExiting`) para que desaparezca suave.

Mantengo intacto el swipe en móvil (sigue funcionando igual).

### 2) Coherencia visual
- El botón usa el mismo tamaño (`h-7 w-7`) y estilo `ghost` que los otros dos iconos de acción.
- Solo visible en `sm:` hacia arriba (`hidden sm:flex` ya aplicado al contenedor de acciones), para no duplicar con el swipe en móvil.
- Tooltip/`title="Eliminar tarea"` para accesibilidad.

### 3) Confirmación obligatoria
Uso `AlertDialog` (ya disponible en `@/components/ui/alert-dialog`) en vez de borrado directo, porque borrar con un click suelto en desktop es peligroso (un mal click y adiós tarea). El swipe móvil ya tiene su propio gesto deliberado, así que ahí no hace falta.

## Ficheros que tocaré

- `src/components/tasks/SwipeableTask.tsx` — añadir botón Trash + AlertDialog de confirmación.

## Lo que NO toco

- `useTasks.deleteTask` ya existe y funciona — lo reutilizo.
- No toco la lógica de swipe móvil.
- No toco la bandeja de inteligencia (eso ya quedó arreglado en la iteración anterior).

## Resultado

En desktop, al pasar el ratón por encima de cualquier tarea pendiente, verás tres botones: editar (lápiz), convertir a bloque (calendario) y **eliminar (papelera roja)**. Click → confirmas → fuera.

