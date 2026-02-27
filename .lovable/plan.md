

## Diagnóstico: Sección "Proyectos" y subcategorías desaparecen del sidebar

**Hallazgos del código:**
- Línea 115 de `SidebarNew.tsx`: `filteredProjectItems = projectItems` — NO se filtra nunca. El código es correcto.
- La DB del usuario NO contiene `/projects` ni `/projects/detector` en `hidden_menu_items`.
- Las secciones colapsables (Bosco, Formación, Datos) dependen de `localStorage` y pueden estar cerradas tras login/logout, dando la impresión de que "faltan".

**Causa probable:**
Tras login/logout, `localStorage` se limpia o las secciones colapsables arrancan cerradas. El usuario interpreta las secciones colapsadas como "desaparecidas". Además, si el sidebar tiene muchos ítems visibles, Proyectos puede quedar fuera del viewport visible (scroll).

### Plan de corrección definitiva

**Step 1: Forzar todas las secciones colapsables abiertas por defecto tras login**
Modificar los estados iniciales de `isAcademyOpen`, `isBoscoOpen` y `isDataOpen` para que arranquen en `true` por defecto (sin depender de `localStorage`), y solo se cierren si el usuario las cierra explícitamente en esa sesión.

**Step 2: Marcar Pipeline y Detector como `permanent` en MenuVisibilityCard**
Actualizar `MenuVisibilityCard.tsx` para que Pipeline y Detector tengan `permanent: true`, coherente con el sidebar que ya los muestra siempre.

**Step 3: Añadir auto-scroll al elemento activo del sidebar**
Usar un `ref` + `scrollIntoView` en el `NavLink` activo para garantizar que la sección visible siempre esté en pantalla al cargar.

### Detalle técnico

**SidebarNew.tsx — Step 1:**
```typescript
// Cambiar los defaults de las 3 secciones colapsables
const [isAcademyOpen, setIsAcademyOpen] = useState(() => {
  const saved = safeGet("sidebar-section-academy");
  return saved !== null ? saved === "true" : true; // default: true
});
// Igual para isBoscoOpen e isDataOpen
```

**SidebarNew.tsx — Step 3:**
```typescript
// Después del useEffect de sync, añadir auto-scroll
useEffect(() => {
  const activeEl = document.querySelector('[data-sidebar-active="true"]');
  activeEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}, [location.pathname]);
```

**MenuVisibilityCard.tsx — Step 2:**
```typescript
{ icon: Briefcase, label: "Pipeline", path: "/projects", permanent: true },
{ icon: Radar, label: "Detector Patrones", path: "/projects/detector", permanent: true },
```

