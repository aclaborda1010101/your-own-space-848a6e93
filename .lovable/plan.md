

## Por qué ocurre

El problema es un **bug de ciclo de vida de React**:

1. `useState(() => { ... })` solo ejecuta su inicializador **una vez**, cuando el componente se monta por primera vez.
2. El `SidebarNew` vive dentro de `AppLayout`, que **no se desmonta** al navegar entre rutas. Por tanto, el inicializador de `isProjectsOpen` solo corre una vez en toda la sesión.
3. Si `localStorage` tiene `sidebar-section-projects = "false"` (porque el usuario cerró la sección alguna vez), la sección queda cerrada **para siempre** hasta que la abra manualmente.
4. La lógica de "forzar apertura si la ruta activa es de proyectos" (línea 136) solo funciona en el momento del mount inicial, no cuando el usuario navega después.

**Solución**: Añadir un `useEffect` que sincronice el estado de apertura con la ruta activa. Cuando `location.pathname` cambie a una ruta de proyectos, forzar `isProjectsOpen = true`. Aplicar lo mismo a todas las secciones colapsables para consistencia.

## Cambios

### `src/components/layout/SidebarNew.tsx`

Añadir después de los `useState` (tras línea 158) un `useEffect` que observe `location.pathname`:

```typescript
// Sync: auto-abrir sección si la ruta activa pertenece a ella
useEffect(() => {
  const path = location.pathname;
  if (path === "/rag-architect" || path.startsWith("/projects")) {
    setIsProjectsOpen(true);
  }
  if (boscoItems.some(i => path === i.path)) {
    setIsBoscoOpen(true);
  }
  if (academyItems.some(i => path === i.path)) {
    setIsAcademyOpen(true);
  }
  if (dataItems.some(i => path === i.path)) {
    setIsDataOpen(true);
  }
}, [location.pathname]);
```

Esto requiere importar `useEffect` de React (línea 1).

Un solo archivo, un solo cambio. La causa raíz es que `useState` no reacciona a cambios de ruta posteriores al mount.

