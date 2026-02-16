
# Fix: Error al crear tareas - constraint de prioridad

## Problema

La tabla `tasks` tiene un CHECK constraint que solo permite `P0`, `P1`, `P2` como valores de prioridad, pero el codigo del frontend (`useTasks.tsx`) genera tambien `P3` para tareas con fecha de vencimiento mayor a 7 dias.

Error exacto: `new row for relation "tasks" violates check constraint "tasks_priority_check"`

## Solucion

Un unico cambio en la base de datos: actualizar el CHECK constraint para incluir `P3`.

## Seccion tecnica

### Migracion SQL

```sql
ALTER TABLE public.tasks DROP CONSTRAINT tasks_priority_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_priority_check CHECK (priority = ANY (ARRAY['P0', 'P1', 'P2', 'P3']));
```

### Archivos a modificar

Ninguno. Solo la migracion de base de datos.
