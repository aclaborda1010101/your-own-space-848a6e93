

## Plan: Crear página independiente "Auditoría IA" en el sidebar

El módulo de Business Leverage (Auditoría IA) ya tiene todos los componentes construidos (`BusinessLeverageTabs`, `QuestionnaireTab`, `DiagnosticTab`, `RecommendationsTab`, `RoadmapTab`) y el hook (`useBusinessLeverage`), pero solo se usa dentro del Project Wizard (paso 6). Vamos a exponerlo como página independiente.

### Cambios

1. **Nueva página `src/pages/AuditoriaIA.tsx`**
   - Selector de proyecto activo (como en `PatternDetectorPage`)
   - Renderiza `BusinessLeverageTabs` con el proyecto seleccionado
   - Header con breadcrumbs y `ShareDialog`

2. **Sidebar (`src/components/layout/SidebarNew.tsx`)**
   - Añadir entrada `{ icon: ShieldCheck, label: "Auditoría IA", path: "/auditoria-ia" }` en `projectItems`, debajo de "Detector Patrones"

3. **Router (`src/App.tsx`)**
   - Añadir ruta lazy `/auditoria-ia` → `AuditoriaIA`

### Nota sobre el build error
El error de build es un fallo de upload a R2 (infraestructura), no un error de compilación. No requiere cambios de código.

