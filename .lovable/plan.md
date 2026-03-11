

# Plan: Colapsar todos los paneles por defecto en el Project Wizard

Todos los paneles desplegables del wizard deben arrancar cerrados. Cambios necesarios:

| Fichero | Cambio |
|---|---|
| `src/components/projects/wizard/ProjectLiveSummaryPanel.tsx` | `useState(true)` → `useState(false)` (línea 27) |
| `src/components/projects/wizard/ProjectActivityTimeline.tsx` | `useState(true)` → `useState(false)` (línea 63) |
| `src/pages/ProjectWizard.tsx` | Añadir `defaultOpen={false}` al `CollapsibleCard` del Pipeline (línea 205) |
| `src/components/projects/wizard/ProjectBudgetPanel.tsx` | Añadir `defaultOpen={false}` al `CollapsibleCard` (línea 268) |
| `src/components/projects/wizard/ProjectProposalExport.tsx` | Añadir `defaultOpen={false}` al `CollapsibleCard` (línea 279) |
| `src/components/projects/wizard/ProjectDocumentsPanel.tsx` | Añadir `defaultOpen={false}` al `CollapsibleCard` (línea 127) |

**ProjectDiscoveryPanel** ya está colapsado por defecto (`useState(false)`), no requiere cambio.

