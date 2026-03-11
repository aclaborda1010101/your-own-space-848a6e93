

# Exportar Presupuesto a PDF con selección de modelos

## Problema
No hay forma de exportar el presupuesto generado a PDF, ni de seleccionar qué modelos de monetización incluir en la exportación.

## Plan

### 1. Añadir selector de modelos para exportar
En `ProjectBudgetPanel.tsx`, cuando hay `budgetData` generado, añadir una sección "Exportar Presupuesto PDF" debajo del contenido con:
- Checkboxes para cada modelo de monetización generado (similar al selector de generación pero solo mostrando los ya generados)
- Estado local `selectedExportModels: number[]` (índices de los modelos a incluir)
- Botón "Exportar PDF" que solo se habilita si hay al menos 1 modelo seleccionado

### 2. Generar el PDF via Edge Function
Al pulsar "Exportar PDF":
- Construir un objeto `budgetData` filtrado que solo incluya los modelos seleccionados en `monetization_models`
- Invocar `supabase.functions.invoke("generate-document")` con:
  - `content`: el `budgetData` filtrado (desarrollo + recurrentes + modelos seleccionados + riesgos)
  - `contentType: "json"`
  - `stepNumber: 6` (presupuesto)
  - `projectName`, `company`
- Descargar el blob resultante como PDF

### 3. Cambios en ficheros

**`src/components/projects/wizard/ProjectBudgetPanel.tsx`**:
- Nuevo estado: `selectedExportModels`, `exportingPdf`
- Nueva sección UI después del contenido del presupuesto: checkboxes por modelo generado + botón exportar
- Función `handleExportPdf()` que filtra `budgetData`, llama a la Edge Function y descarga el PDF

**`supabase/functions/generate-document/index.ts`**:
- Añadir soporte para `stepNumber === 6`: renderizar el JSON de presupuesto en HTML con el mismo estilo ManIAS (tabla de fases, costes recurrentes, cards de modelos de monetización seleccionados, riesgos)

