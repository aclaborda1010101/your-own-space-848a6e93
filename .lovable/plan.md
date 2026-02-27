

## Plan: Aplicar documento de correcciones del pipeline (Fases 4-9)

Tras revisar el archivo subido contra el estado actual, hay 3 bloques de cambios pendientes:

### Bloque 1: Corregir STEP_MODELS y modelo Fase 6

**`src/config/projectPipelinePrompts.ts`**
- Línea 19: Cambiar `4: "gemini-flash"` → `4: "claude-sonnet"`
- Línea 21: Cambiar `6: "gemini-flash"` → `6: "claude-sonnet"`

**`supabase/functions/project-wizard-step/index.ts`**
- Línea 455: Cambiar `model: "flash"` → `model: "claude"` para `run_ai_leverage` (Fase 6)

### Bloque 2: Enriquecer prompts inline del Edge Function

Los prompts inline en el edge function (líneas 477-493) son versiones muy resumidas de los prompts completos de `projectPipelinePrompts.ts`. El archivo subido pide que se usen los prompts completos. Como el edge function (Deno) no puede importar de `src/`, hay que copiar los prompts completos directamente en el edge function para las 6 acciones:

- **`run_audit`** (línea 477-478): Reemplazar systemPrompt + userPrompt con los prompts completos de `AUDIT_SYSTEM_PROMPT` + `buildAuditPrompt` (incluyendo las 3 reglas nuevas ya añadidas)
- **`generate_final_doc`** (línea 479-481): Reemplazar con `FINAL_DOC_SYSTEM_PROMPT` + `buildFinalDocPrompt` completos (incluyendo reglas de presupuesto)
- **`run_ai_leverage`** (línea 482-484): Reemplazar con `AI_LEVERAGE_SYSTEM_PROMPT` + `buildAiLeveragePrompt` completos
- **`generate_prd`** (línea 485-487): Reemplazar con `PRD_SYSTEM_PROMPT` + `buildPrdPrompt` completos
- **`generate_rags`** (línea 488-490): Reemplazar con `RAG_GEN_SYSTEM_PROMPT` + `buildRagGenPrompt` completos
- **`detect_patterns`** (línea 491-493): Reemplazar con `PATTERNS_SYSTEM_PROMPT` + `buildPatternsPrompt` completos

Esto es crítico porque los prompts actuales pierden instrucciones detalladas (estructura JSON exacta, reglas de presupuesto, etc.).

### Bloque 3: Redesplegar Edge Function

- Redesplegar `project-wizard-step` después de los cambios.

### Notas

- **UI de fases 6-9**: El archivo pide componentes especializados (cards para oportunidades IA, browser de chunks, etc.), pero eso es una mejora visual grande que se puede hacer en un paso posterior. El `ProjectWizardGenericStep` actual ya funciona para todas las fases.
- **`getStepInputs`**: Ya implementado en `useProjectWizard.ts` líneas 274-287 (`runGenericStep` ya recolecta outputs de pasos anteriores).

### Archivos afectados
- `src/config/projectPipelinePrompts.ts` — 2 líneas (STEP_MODELS)
- `supabase/functions/project-wizard-step/index.ts` — prompts completos + modelo fase 6

