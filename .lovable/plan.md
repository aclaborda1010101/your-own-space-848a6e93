
# Reemplazar botones de filtro por Select dropdowns en Red de Contactos

## Problema
Los dos grupos de filtros (categoria: Todos/Profesional/Personal/Familiar y vista: Activos/Top100/Favoritos/Todos) usan grids de 4 botones que se descuadran en pantallas pequenas o al cambiar resolucion.

## Solucion
Reemplazar ambos grids de botones por componentes `Select` (dropdown) del sistema de diseno existente (`@radix-ui/react-select`). Esto ocupa una sola linea por filtro y funciona bien en cualquier resolucion.

## Cambios en un solo archivo

**Archivo: `src/pages/StrategicNetwork.tsx`**

1. Importar `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` desde `@/components/ui/select`
2. Reemplazar el bloque de categoria (lineas 1664-1678) por un `Select` con las 4 opciones
3. Reemplazar el bloque de vista (lineas 1680-1717) por un `Select` con las 4 opciones
4. Envolver ambos selects en un `div` con `flex gap-2` para que queden lado a lado en una sola fila

### Layout resultante

```text
[Categoria: Todos  v]  [Vista: Todos  v]
```

Cada dropdown mostrara el icono + texto de la opcion seleccionada, y al abrir listara las opciones con sus iconos correspondientes.

### Detalle tecnico

- Filtro de categoria: `Select value={categoryFilter} onValueChange={setCategoryFilter}` con opciones "all", "profesional", "personal", "familiar"
- Filtro de vista: `Select value={viewFilter} onValueChange={setViewFilter}` con opciones "active", "top100", "favorites", "all"
- Se eliminan los 8 botones actuales (4+4)
- Los iconos existentes (Eye, Briefcase, Heart, Users, TrendingUp, Trophy, Star) se reutilizan dentro de cada `SelectItem`
