

## Plan: Añadir borrado de entradas del historial de comidas

### Cambios

**1. `src/hooks/useMealHistory.tsx`**
- Añadir función `deleteMealFromHistory(mealId: string)` que hace `DELETE` en `meal_history` por `id` y actualiza el estado local.
- Exportarla en el return del hook.

**2. `src/components/nutrition/MealHistoryCard.tsx`**
- Añadir un botón `Trash2` (icono) en cada fila del historial.
- Al pulsar, mostrar un `AlertDialog` de confirmación ("¿Eliminar esta comida del historial?").
- Al confirmar, llamar a `deleteMealFromHistory(meal.id)`.

No se necesitan cambios de base de datos: la RLS existente ya permite al usuario borrar sus propias filas (policy `user_id = auth.uid()`).

