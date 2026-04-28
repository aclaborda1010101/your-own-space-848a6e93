# Renombrar proyecto a "Central Culinaria"

## Objetivo
Cambiar el nombre del proyecto `Predicción Stock` (id `b35eca56-dcfa-480a-98c7-ae7f4250f161`) a `Central Culinaria` en la tabla `business_projects`.

## Acción
Crear una migración SQL con:

```sql
UPDATE public.business_projects
SET name = 'Central Culinaria',
    updated_at = now()
WHERE id = 'b35eca56-dcfa-480a-98c7-ae7f4250f161';
```

## Verificación
- Releer el registro para confirmar el nuevo nombre.
- Listado de proyectos en el wizard mostrará "Central Culinaria" tras refrescar.

## Notas
- No se toca el contenido del brief, transcripciones ni pasos del wizard.
- No se modifica ninguna otra tabla; el `id` permanece igual, así que todas las relaciones (briefing, prd, etc.) siguen intactas.
