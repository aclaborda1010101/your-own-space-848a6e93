
# Fix: Layout del detalle de contacto en movil

## Problema

En la vista de detalle del contacto (panel derecho de /strategic-network), la cabecera usa un layout horizontal (`flex items-start gap-4`) con tres columnas: avatar (64px), info (flex-1), y botones de accion (flex-shrink-0). En pantallas pequenas, los 3 botones (editar, eliminar, analizar IA) ocupan demasiado espacio horizontal, comprimiendo el nombre del contacto y causando que se muestre cortado ("C Primo" en vez del nombre completo).

## Solucion

Reorganizar la cabecera del `ContactDetail` para que en movil:

1. **Primera fila**: Avatar + nombre/rol/empresa (sin botones al lado)
2. **Segunda fila**: Botones de accion (editar, eliminar, analizar IA) en una fila debajo del nombre
3. **Tercera fila**: Category toggles (Profesional/Personal/Familiar)
4. **Cuarta fila**: Scope tabs (Ver profesional/Ver personal/Ver familiar)
5. **Quinta fila**: Badges (brain, relationship, WA count)

En desktop (lg+) se mantiene el layout actual con botones a la derecha.

## Detalle tecnico

### Archivo modificado: `src/pages/StrategicNetwork.tsx`

**Cambio en la cabecera del ContactDetail** (lineas 1114-1222):

Estructura actual:
```
flex items-start gap-4
  avatar (w-16)
  flex-1 (nombre + role + company + categories + scope tabs + badges)
  flex-shrink-0 (edit + delete + analyze buttons)
```

Nueva estructura:
```
space-y-3
  flex items-start gap-3
    avatar (w-12 en movil, w-16 en desktop)
    flex-1 (nombre + role + company)
    botones SOLO en lg+ (hidden lg:flex)
  botones en movil (flex lg:hidden) - fila completa debajo
  categories (grid grid-cols-3)
  scope tabs (grid grid-cols-3, solo si hay mas de 1 categoria)
  badges (flex-wrap)
```

Los cambios clave:
- Mover los botones de accion fuera del `flex` principal y duplicarlos con `hidden/lg:flex` para responsive
- Reducir el avatar a `w-12 h-12` en movil
- Usar `grid grid-cols-3` para los toggles de categoria y scope tabs (tamano uniforme, como ya se hizo con los filtros de la lista)
