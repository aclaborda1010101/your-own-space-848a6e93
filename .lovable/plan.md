

## Plan: Cambiar todas las referencias de $ a € en la UI

### Problema
Hay 3 archivos que muestran costes en dólares ($) cuando deberían usar euros (€):

### Cambios

**1. `src/pages/Projects.tsx`** (2 puntos)
- Línea 196: `$${totalCost.toFixed(2)}` → `€${totalCost.toFixed(2)}`
- Línea 282: `$${cost.toFixed(4)}` → `€${cost.toFixed(4)}`

**2. `src/components/settings/AICostTrackerCard.tsx`** (2 puntos)
- Línea 80: `$${totalCost.toFixed(4)}` → `€${totalCost.toFixed(4)}`
- Línea 148: `$${m.totalCost.toFixed(4)}` → `€${m.totalCost.toFixed(4)}`

**3. `src/components/projects/wizard/ProjectCostBadge.tsx`**
- Cambiar icono `DollarSign` por `Euro` de lucide-react

El resto de archivos (finanzas, gráficos, formatCost) ya usan € correctamente.

