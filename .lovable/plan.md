

# Dos modos de exportación del Presupuesto: Interno y Cliente

## Problema
El PDF del presupuesto actualmente exporta datos internos (márgenes, coste real, pros/contras orientados al vendedor). Se necesita un modo "cliente" que oculte información confidencial y adapte los pros/contras.

## Plan

### 1. UI — Selector de modo en `ProjectBudgetPanel.tsx`
En la sección "Exportar Presupuesto a PDF", añadir un selector (dos botones tipo toggle o radio) antes del botón de exportar:
- **Interno** — comportamiento actual, con márgenes, coste real y pros/contras internos
- **Cliente** — sin márgenes, sin coste real, pros orientados al beneficio del cliente

El estado `budgetExportMode: 'internal' | 'client'` se pasa al invocar `generate-document`.

### 2. Frontend — Filtrar datos sensibles antes de enviar
En `handleExportPdf`, cuando el modo es `client`:
- Eliminar `your_cost_eur` y `margin_pct` del objeto `development`
- Eliminar `your_margin_pct` de cada modelo de monetización
- Pasar `exportMode: "client"` al Edge Function

### 3. Edge Function — `generate-document/index.ts`
En el renderizador de presupuesto (líneas ~1530-1611):
- Leer el `exportMode` del body
- Si es `client`:
  - No renderizar la línea de "Coste real" ni "margen" (línea ~1550-1552)
  - No renderizar la métrica "Margen" en los modelos (línea ~1587)
  - Cambiar el título del documento a "Propuesta Económica" en lugar de "Estimación de Presupuesto"
  - Usar cabecera "CONFIDENCIAL" en lugar de "BORRADOR INTERNO"
- Si es `internal`: comportamiento actual sin cambios

### Ficheros modificados
- `src/components/projects/wizard/ProjectBudgetPanel.tsx` — nuevo estado + toggle UI + filtrado de datos
- `supabase/functions/generate-document/index.ts` — condicionales por exportMode en el renderizador de presupuesto

