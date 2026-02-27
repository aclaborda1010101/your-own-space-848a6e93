

## Plan: Desbloquear Fases 4-9 del Wizard

El paso 4 está bloqueado por tres razones:
1. **`ProjectWizardStepper.tsx`**: `MAX_SPRINT1_STEP = 3` bloquea visualmente los pasos >3
2. **`ProjectWizard.tsx`**: `currentStep > 3` renderiza "Paso bloqueado" en lugar de contenido
3. **Edge function**: No tiene acciones para fases 4-9
4. **No existen componentes UI** para pasos 4-9

### Cambios necesarios

#### 1. Eliminar límite de sprint en `ProjectWizardStepper.tsx`
- Eliminar `MAX_SPRINT1_STEP = 3` y la condición `step.stepNumber > MAX_SPRINT1_STEP` del cálculo de `isLocked`

#### 2. Crear componentes UI genéricos para pasos 4-9 en `ProjectWizard.tsx`
- **Paso 4 (Auditoría)**: Botón "Generar Auditoría", muestra JSON de hallazgos con severidades, botón aprobar
- **Paso 5 (Doc Final)**: Botón "Generar Documento Final", muestra Markdown, botón aprobar
- **Pasos 6-9**: Mismo patrón (botón generar + visualizar output + aprobar)
- Crear un componente reutilizable `ProjectWizardGenericStep` que sirva para todos

#### 3. Añadir acciones en edge function `project-wizard-step/index.ts`
- **`run_audit`** (paso 4): Recibe originalInput + briefingJson + scopeDocument → llama a `callGeminiFlash` con `AUDIT_SYSTEM_PROMPT` → guarda JSON de hallazgos
- **`generate_final_doc`** (paso 5): Recibe scopeDocument + auditJson + briefingJson → llama a `callClaudeSonnet` (con fallback Gemini) → guarda documento final
- **`run_ai_leverage`** (paso 6): Gemini Flash con prompt AI Leverage
- **`generate_prd`** (paso 7): Claude Sonnet con prompt PRD
- **`generate_rags`** (paso 8): Claude Sonnet con prompt RAGs
- **`detect_patterns`** (paso 9): Claude Sonnet con prompt Patrones
- Cada acción usa los prompts ya definidos en `projectPipelinePrompts.ts`, registra costes, y guarda en `project_wizard_steps`
- Todas las acciones Claude tienen fallback a Gemini Pro

#### 4. Añadir funciones al hook `useProjectWizard.ts`
- `runGenericStep(stepNumber, action, stepData)` — función genérica que invoca la edge function con la acción correspondiente

### Archivos
- `src/components/projects/wizard/ProjectWizardStepper.tsx` — eliminar límite
- `src/components/projects/wizard/ProjectWizardGenericStep.tsx` — **nuevo**, componente reutilizable
- `src/pages/ProjectWizard.tsx` — renderizar pasos 4-9 con el componente genérico
- `src/hooks/useProjectWizard.ts` — añadir `runGenericStep`
- `supabase/functions/project-wizard-step/index.ts` — añadir 6 acciones nuevas
- Redesplegar edge function

