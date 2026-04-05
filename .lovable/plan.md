

## Plan: Forzar actualización de caché del preview

El preview necesita refrescarse para cargar los últimos cambios (migración `is_public`, cambios en hooks y UI de proyectos).

### Acción
Añadir un comentario trivial en `src/main.tsx` para forzar un rebuild del bundle y que el preview cargue la versión más reciente con todos los cambios aplicados.

### Archivo a modificar
- `src/main.tsx` — añadir timestamp en comentario para invalidar caché

