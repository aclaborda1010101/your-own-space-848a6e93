
## Objetivo
Corregir el scroll de la barra lateral en móvil para que los últimos elementos de navegación (Formación, Ajustes) no queden ocultos detrás del botón "Cerrar sesión".

## Problema identificado
En `SidebarNew.tsx`, el área de navegación (`<nav>`) tiene:
- `maxHeight: 'calc(100vh - 180px)'` - cálculo fijo que no considera el footer real
- `pb-20` (80px) de padding inferior
- El footer (`absolute bottom-0`) ocupa aproximadamente 140-160px (avatar + botón logout)
- En móviles iOS, hay que sumar el safe-area inferior

El resultado es que los últimos elementos quedan tapados.

## Cambios propuestos

### Modificar el cálculo de altura del área de navegación
En lugar de `maxHeight: 'calc(100vh - 180px)'`, usar un cálculo que:
1. Reste la altura del header (64px / h-16)
2. Reste la altura del footer (~150px para no colapsado, ~60px para colapsado)
3. Considere el safe-area de iOS

```typescript
// Línea 235-239 - cambiar el nav
<nav className={cn(
  "flex-1 overflow-y-auto",
  isCollapsed ? "p-2 pb-24" : "p-4 pb-40", // Padding inferior dinámico
  "scrollbar-thin scrollbar-thumb-sidebar-border scrollbar-track-transparent"
)} style={{ 
  maxHeight: isCollapsed 
    ? 'calc(100vh - 64px - 80px - env(safe-area-inset-bottom, 0px))' 
    : 'calc(100vh - 64px - 170px - env(safe-area-inset-bottom, 0px))' 
}}>
```

### Detalles técnicos
- **Header**: 64px (h-16)
- **Footer no colapsado**: ~160px (avatar 40px + padding + botón)
- **Footer colapsado**: ~60px (solo botón)
- **Safe-area iOS**: variable, usando `env(safe-area-inset-bottom)`
- **Padding inferior extra**: `pb-40` (160px) en modo expandido para garantizar espacio

## Archivo a modificar
- `src/components/layout/SidebarNew.tsx` - Ajustar el cálculo de `maxHeight` y `padding-bottom` del `<nav>`

## Resultado esperado
- Todos los elementos de navegación serán visibles y accesibles mediante scroll
- El botón "Cerrar sesión" no tapará ningún elemento
- Funcionará correctamente en iOS con notch y home bar
