
# Agregar "Detector de Patrones" como submenu de Proyectos en el Sidebar

## Problema

"Proyectos" es un enlace simple en el sidebar (`moduleItems`). El Detector de Patrones solo aparece como un tab dentro del detalle de un proyecto, pero no tiene visibilidad directa desde la navegacion lateral.

## Solucion

Convertir "Proyectos" de un enlace simple a un grupo colapsable (como ya se hace con "Bosco" y "Formacion"), con dos sub-items:

- **Pipeline** — enlace a `/projects` (vista actual del pipeline)
- **Detector de Patrones** — enlace a `/projects?tab=detector` (o nueva ruta dedicada)

## Cambios

### 1. `src/components/layout/SidebarNew.tsx`
- Quitar `Proyectos` de `moduleItems`
- Crear nuevo array `projectItems` con dos entradas:
  - `{ icon: Briefcase, label: "Pipeline", path: "/projects" }`
  - `{ icon: Radar, label: "Detector Patrones", path: "/projects/detector" }`
- Crear `renderProjectsSection()` siguiendo el mismo patron que `renderBoscoSection()` (Collapsible con ChevronDown)
- Renderizar el nuevo grupo en la posicion donde estaba "Proyectos" dentro de los modulos

### 2. `src/App.tsx`
- Agregar nueva ruta protegida: `/projects/detector` que renderiza una pagina dedicada al Detector de Patrones (con selector de proyecto)

### 3. Nuevo: `src/pages/PatternDetectorPage.tsx`
- Pagina ligera que permite seleccionar un proyecto existente y muestra el componente `PatternDetector` con el `projectId` seleccionado
- Incluye `Breadcrumbs` y un selector/dropdown de proyectos activos

### 4. `src/components/settings/MenuVisibilityCard.tsx`
- Agregar las nuevas rutas al grupo "Proyectos" para que el usuario pueda ocultarlas si quiere

## Detalles tecnicos

- Se importa el icono `Radar` de lucide-react para el Detector de Patrones
- El estado colapsable del grupo sigue el mismo patron que Bosco/Formacion (se abre automaticamente si la ruta actual coincide)
- Los items se filtran por `hiddenItems` como el resto de secciones
