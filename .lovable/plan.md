

# Plan: Añadir Estimación de Presupuesto y Modelos de Monetización (interno)

## Qué se construye

Un panel interno (solo visible para ti, no para el cliente) que aparece automáticamente cuando el PRD (Paso 5) está completado. Genera una estimación de presupuesto realista y 2-3 modelos de monetización adaptados al proyecto concreto.

## Dónde se muestra

Después del pipeline, como un **CollapsibleCard** adicional en `ProjectWizard.tsx` con etiqueta `[USO INTERNO]`. Solo se renderiza si el Step 5 tiene `status === "approved"`.

## Cambios

### 1. Nuevo componente: `src/components/projects/wizard/ProjectBudgetPanel.tsx`
- Card colapsable con icono de `Calculator` y badge `INTERNO`
- Botón "Generar Estimación" que llama al edge function con acción `generate_budget_estimate`
- Muestra 3 secciones:
  - **Costes de desarrollo**: horas estimadas, coste por hora, total
  - **Costes recurrentes**: hosting, APIs IA, mantenimiento
  - **Modelos de monetización**: 2-3 opciones (ej: proyecto cerrado, SaaS/licencias, implementación + mantenimiento mensual) con precios sugeridos y pros/contras
- Estado: `generating | ready | null`
- Datos guardados en `project_wizard_steps` como step_number 6 (interno)

### 2. Prompt: añadir en `src/config/projectPipelinePrompts.ts`
- Nuevo `BUDGET_ESTIMATION_SYSTEM_PROMPT` que instruye a la IA a:
  - Estimar horas reales de desarrollo con IA (no infladas)
  - Desglosar costes de APIs/hosting/infra recurrentes
  - Proponer 2-3 modelos de monetización con precios reales de mercado
  - Usar escenario conservador (alineado con reglas de cuantificación existentes)
- Nuevo `buildBudgetEstimationPrompt(scopeDocument, aiLeverage, prdDocument)` que combina toda la info del proyecto

### 3. Edge Function: `supabase/functions/project-wizard-step/index.ts`
- Nueva acción `generate_budget_estimate` que:
  - Lee el scope (step 3), AI audit (step 4), y PRD (step 5)
  - Llama a Claude Sonnet con el prompt de estimación
  - Guarda resultado como step 6 con `step_name: "Estimación Presupuesto (interno)"`
  - Registra coste

### 4. UI: `src/pages/ProjectWizard.tsx`
- Importar y renderizar `ProjectBudgetPanel` debajo del pipeline card
- Solo visible si step 5 está aprobado
- NO aparece en el stepper ni en la barra de progreso (es un bonus post-pipeline)

### 5. Hook: `src/hooks/useProjectWizard.ts`
- No cambia `TOTAL_STEPS` (sigue siendo 5)
- Añadir función `generateBudgetEstimate()` que invoca la acción
- El step 6 se carga como dato auxiliar, no como paso del pipeline

## Estructura del output JSON

```json
{
  "development": {
    "phases": [
      { "name": "Fase 0 - Setup", "hours": 20, "cost_eur": 1600 },
      { "name": "Fase 1 - MVP", "hours": 80, "cost_eur": 6400 }
    ],
    "total_hours": 100,
    "hourly_rate_eur": 80,
    "total_development_eur": 8000
  },
  "recurring_monthly": {
    "hosting": 25,
    "ai_apis": 45,
    "maintenance": 200,
    "total_monthly_eur": 270
  },
  "monetization_models": [
    {
      "name": "Proyecto cerrado + mantenimiento",
      "description": "...",
      "price_range": "€8.000-12.000 + €270-400/mes",
      "pros": ["..."],
      "cons": ["..."]
    },
    {
      "name": "SaaS por licencia/usuario",
      "description": "...",
      "price_range": "€2.000 setup + €X/usuario/mes",
      "pros": ["..."],
      "cons": ["..."]
    }
  ],
  "notes": "..."
}
```

## No cambia
- El pipeline de 5 pasos ni el stepper
- La exportación de documentos al cliente
- La lógica de costes de generación IA (ProjectCostBadge)

