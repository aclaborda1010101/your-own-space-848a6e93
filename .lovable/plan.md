

## Plan: Nueva página unificada de Gestión de Proyectos

### Problema actual
El sidebar tiene 3 entradas separadas (Pipeline, RAG Architect, Detector Patrones) que confunden. La página `/projects` usa un pipeline CRM viejo sin soporte para transcripciones/audio del wizard. El usuario quiere **una sola entrada** en el sidebar que lleve a una página unificada.

### Cambios propuestos

**1. Sidebar — Una sola entrada "Proyectos"**
En `SidebarNew.tsx`: reemplazar el array `projectItems` (3 ítems) por una sola entrada:
```
{ icon: Briefcase, label: "Proyectos", path: "/projects" }
```
Eliminar la sección colapsable de proyectos y poner este ítem como link directo en el grupo principal o como sección propia de una sola línea.

**2. Nueva página `/projects` — Layout unificado**
Reescribir `Projects.tsx` con 3 zonas:
- **Header**: título + botón "Nuevo Proyecto" (abre wizard `/projects/wizard/new`)
- **Lista de proyectos**: cards de `business_projects` mostrando nombre, empresa, paso actual del wizard (`current_step`), estado, coste. Click → abre wizard en el paso correspondiente (`/projects/wizard/:id`)
- **Sección inferior con tabs**: "Detector de Patrones" y "RAG Architect" embebidos como componentes (reutilizando `PatternDetector` y la vista de `RagArchitect`)

**3. Rutas**
- `/projects` → nueva página unificada
- `/projects/wizard/:id` → wizard (ya existe)
- Eliminar `/projects/detector` como ruta independiente (se embebe)
- Mantener `/rag-architect` como ruta por si se accede directamente, pero el sidebar ya no la muestra

**4. MenuVisibilityCard**
Simplificar grupo "Proyectos" a un solo ítem permanent: `{ icon: Briefcase, label: "Proyectos", path: "/projects", permanent: true }`. Eliminar las entradas de Pipeline, Detector y RAG Architect del card de visibilidad.

### Detalle técnico

**SidebarNew.tsx:**
- Eliminar `projectItems` array y `renderProjectsSection()`
- Añadir `{ icon: Briefcase, label: "Proyectos", path: "/projects" }` al array `navItems` (después de Deportes) o como sección estática propia

**Projects.tsx (reescritura):**
```
<main>
  <Breadcrumbs />
  <Header: "Proyectos" + Button "Nuevo Proyecto" → navigate("/projects/wizard/new") />
  
  <ProjectsList>
    // query business_projects, mostrar cards con:
    // - nombre, empresa, current_step/9, status badge, total_cost
    // - click → navigate("/projects/wizard/{id}")
    // - proyectos sin wizard (current_step=0) → vista legacy simplificada
  </ProjectsList>
  
  <Tabs defaultValue="detector">
    <Tab "Detector"> <PatternDetector /> con selector de proyecto </Tab>
    <Tab "RAG"> <RagArchitect embebido /> </Tab>
  </Tabs>
</main>
```

**App.tsx:**
- Eliminar ruta `/projects/detector` (ya no es página independiente)
- Mantener `/rag-architect` como redirect o ruta funcional

