

## Plan: Fix Fase 4 truncamiento + JSON resilience

### Cambios

#### 1. Edge function `supabase/functions/project-wizard-step/index.ts`

**a) Cambiar Fase 4 de Gemini Flash a Claude Sonnet:**
- Línea 453: `model: "flash"` → `model: "claude"`
- Esto hace que use `callClaudeSonnet()` con fallback a Gemini Pro (ya implementado en líneas 502-511)

**b) Añadir reparación de JSON truncado + retry automático (líneas 515-524):**
- Cuando `JSON.parse` falla, intentar reparar el JSON cerrando strings, brackets y braces abiertos
- Si la reparación falla, hacer 1 retry con temperatura más baja (0.1)
- Solo guardar `parse_error: true` si ambos intentos fallan
- Aplicar a TODAS las fases JSON (4, 6, 8, 9)

#### 2. UI `ProjectWizardGenericStep.tsx`
- Cuando `outputData.parse_error === true`, mostrar alerta con botón "Reintentar" en vez del output normal

### Archivos
- `supabase/functions/project-wizard-step/index.ts` — modelo + JSON repair + retry
- `src/components/projects/wizard/ProjectWizardGenericStep.tsx` — UI parse_error
- Redesplegar edge function

