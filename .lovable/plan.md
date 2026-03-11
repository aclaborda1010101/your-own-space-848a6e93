

# Documento Unificado: "Propuesta para el Cliente"

## Objetivo
Crear un nuevo documento consolidado que agrupe en un solo PDF profesional: alcance de la solución, resumen técnico simplificado, plazos de implementación con gráficos, y presupuesto con los modelos de monetización seleccionados. Este documento es lo que se envía al cliente final.

## Datos disponibles por paso
- **Paso 3** (Alcance): Markdown con la descripción de la solución, funcionalidades, exclusiones
- **Paso 4** (Auditoría IA): JSON con oportunidades de IA y ROI
- **Paso 5** (PRD): Markdown técnico detallado (se simplificará para el cliente)
- **Budget**: JSON con fases de desarrollo (horas, costes), recurrentes y modelos de monetización

## Plan de implementación

### 1. Nuevo componente `ProjectProposalExport.tsx`
Panel que aparece en `ProjectWizardEdit` cuando los pasos 3-5 están aprobados Y existe presupuesto generado. Incluye:
- Selector de modelos de monetización a incluir (checkboxes, como el del budget)
- Botón "Generar Propuesta para el Cliente"
- Al pulsar, recopila los datos de los 4 orígenes, los envía a `generate-document` con `stepNumber: 100` (propuesta unificada)

### 2. Edge Function — nuevo renderer (`stepNumber === 100`)
En `generate-document/index.ts`, añadir un renderer dedicado que reciba un objeto con 4 secciones y genere HTML unificado:

**Estructura del PDF:**
1. **Portada** — "Propuesta de Solución" + nombre proyecto + empresa + fecha
2. **Resumen Ejecutivo** — extraído del alcance (primeros párrafos)
3. **Alcance de la Solución** — contenido del paso 3 (Markdown renderizado), con las propuestas IA integradas de forma simplificada
4. **Arquitectura y Solución Técnica** — versión simplificada del PRD: solo las secciones de alto nivel (ontología, módulos principales, integraciones), sin SQL ni Edge Functions
5. **Plan de Implementación** — tabla de fases del budget con horas y plazos, más un diagrama Gantt simplificado en HTML (barras CSS horizontales por fase)
6. **Inversión** — costes de desarrollo, costes recurrentes, y cards de los modelos de monetización seleccionados (sin márgenes internos)
7. **Próximos Pasos** — CTA estándar

### 3. Ficheros a modificar/crear

**Crear `src/components/projects/wizard/ProjectProposalExport.tsx`**:
- Props: `projectId`, `projectName`, `company`, `steps` (array con outputData de pasos 3-5), `budgetData`
- Estado: `selectedModels: number[]`, `generating: boolean`
- Lógica: extrae scope (paso 3), simplifica PRD (paso 5 — solo headers H1/H2 y contenido no-SQL), construye payload, invoca Edge Function, descarga PDF
- UI: card con título "Propuesta para el Cliente", checkboxes de modelos, botón generar

**Editar `src/pages/ProjectWizard.tsx`**:
- Importar y renderizar `ProjectProposalExport` debajo del `ProjectBudgetPanel`, pasándole los datos necesarios

**Editar `supabase/functions/generate-document/index.ts`**:
- Añadir bloque `if (stepNumber === 100)` antes del renderer genérico
- El body espera: `{ scope: string, aiOpportunities: object[], techSummary: string, budget: BudgetData, selectedModels: number[] }`
- Renderizar cada sección con el estilo ManIAS existente (CSS ya definido)
- Para el timeline/Gantt: generar barras CSS proporcionales al número de horas por fase
- Título del documento: "Propuesta de Solución"
- Modo siempre `client` (sin datos internos)

### 4. Simplificación del PRD para el cliente
En el componente, antes de enviar el contenido del PRD:
- Eliminar secciones que contengan "SQL", "Edge Function", "migration", "Blueprint Lovable"
- Mantener: resumen de módulos, integraciones externas, arquitectura de alto nivel
- Esto se hace con regex sobre el Markdown antes de enviarlo

