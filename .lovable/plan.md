

## Diagnóstico: por qué desaparecen los submenús

La causa raíz es que **`SidebarNew` se desmonta y vuelve a montar en cada navegación**. En `App.tsx`, cada ruta crea una instancia nueva de `ProtectedPage` → `AppLayout` → `SidebarNew`:

```text
<Route path="/dashboard" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
<Route path="/projects" element={<ProtectedPage><Projects /></ProtectedPage>} />
```

Cada `ProtectedPage` es un componente nuevo, así que React destruye el anterior y monta uno nuevo. Los `useState` de las secciones colapsables (`isProjectsOpen`, `isBoscoOpen`, etc.) **se reinician desde cero** usando el path actual:

```ts
const [isProjectsOpen, setIsProjectsOpen] = useState(() => {
  return projectItems.some(item => location.pathname === item.path || ...);
});
```

Si estás en `/projects` con el submenú abierto y navegas a `/dashboard`:
1. `SidebarNew` se desmonta (estado perdido).
2. Se monta uno nuevo. El inicializador ve `pathname = /dashboard` → `isProjectsOpen = false`.
3. El submenú de Proyectos desaparece.

Vuelves a `/projects` → se repite: monta nuevo, inicializador ve `/projects` → se abre. Pero si cierras manualmente y navegas fuera y vuelves, se vuelve a abrir porque el inicializador dice `true` para `/projects`.

## Plan de corrección

### Archivo: `src/components/layout/SidebarNew.tsx`

Persistir el estado abierto/cerrado de cada sección colapsable en `localStorage`, igual que ya se hace con `isCollapsed` en `useSidebarState`.

**Cambios concretos:**

1. Crear helper `safeGet`/`safeSet` (o reutilizar los de `useSidebarState`).

2. Reemplazar los 4 `useState` de secciones colapsables para que:
   - **Lean de localStorage** al montar (clave: `sidebar-section-projects`, `sidebar-section-bosco`, etc.).
   - **Escriban en localStorage** cada vez que se cambia el estado.
   - Si no hay valor guardado, usen el path actual como fallback (primera vez).

3. Los `onOpenChange` de cada `<Collapsible>` ya llaman al setter correspondiente. Solo hay que interceptar para persistir.

Ejemplo de la transformación para Proyectos:

```ts
// ANTES (se pierde en cada navegación):
const [isProjectsOpen, setIsProjectsOpen] = useState(() => {
  return projectItems.some(item => location.pathname === item.path || ...);
});

// DESPUÉS (persiste en localStorage):
const [isProjectsOpen, setIsProjectsOpen] = useState(() => {
  const saved = safeGet("sidebar-section-projects");
  if (saved !== null) return saved === "true";
  return projectItems.some(item => location.pathname === item.path || ...);
});

// Y en onOpenChange:
const handleProjectsToggle = (open: boolean) => {
  setIsProjectsOpen(open);
  safeSet("sidebar-section-projects", String(open));
};
```

Lo mismo para `isAcademyOpen`, `isBoscoOpen`, `isDataOpen`.

### Detalle técnico

- 4 claves localStorage: `sidebar-section-projects`, `sidebar-section-bosco`, `sidebar-section-academy`, `sidebar-section-data`.
- Se usa `safeGet`/`safeSet` para compatibilidad con modo privado (igual que `useSidebarState`).
- Primera visita: sin valor guardado, se usa heurística de path actual (comportamiento existente).
- Visitas posteriores: se respeta la última decisión manual del usuario.

