

# Plan: Simplificar Pipeline del Wizard a 5 Pasos Prácticos

## Problema

El pipeline actual tiene 10 pasos (Entrada → Briefing → Borrador → Auditoría → Doc Final → AI Audit → PRD → Blueprint → RAG → Patrones). El usuario necesita un flujo directo: meter un documento/grabación y sacar un PRD low-level tan completo que se pueda pegar en Lovable y generar la app. Los pasos 8-10 (Blueprint, RAG, Patrones) no aportan valor porque ejecutan servicios dentro del wizard cuando deberían estar DESCRITOS en el PRD como especificaciones de build.

## Nuevo Pipeline: 5 Pasos

| Paso | Nombre | Qué hace |
|------|--------|----------|
| 1 | Entrada | Input: docs, audio, transcripciones (sin cambios) |
| 2 | Briefing | Extracción inteligente (sin cambios) |
| 3 | Documento de Alcance | Fusión de los antiguos pasos 3+4+5: genera borrador, auto-audita internamente, y produce el doc final en una sola operación |
| 4 | Auditoría IA | Análisis de oportunidades IA (sin cambios, antiguo paso 6) |
| 5 | PRD Técnico | Low-level design definitivo. Incluye TODO: ontología, variables, patrones, SQL, Edge Functions, specs RAG si aplica, blueprint Lovable. Es el output final. |

## Cambios por archivo

### 1. `src/config/projectPipelinePrompts.ts`
- Actualizar `STEP_NAMES` a 5 pasos
- Actualizar `STEP_MODELS` a 5 pasos
- Fusionar el prompt de Scope (paso 3) para que incluya auto-auditoría y corrección integrada en una sola generación
- Ampliar el PRD (paso 5) para que incluya explícitamente specs de RAG, integración de servicios externos, y todo lo necesario para build directo

### 2. `supabase/functions/project-wizard-step/index.ts`
- **Paso 3 nuevo (Documento de Alcance)**: Pipeline interno de 3 sub-calls: (a) generar borrador, (b) auto-auditar contra input original, (c) generar versión final corregida. Todo en una sola acción `generate_scope_final`
- **Eliminar acciones**: `run_audit` (antiguo paso 4), `generate_final_doc` (antiguo paso 5), `generate_pattern_blueprint` (paso 8), `generate_rags` (paso 9), `execute_patterns` (paso 10)
- **Paso 4** (`run_ai_leverage`): Renumerar de step 6 → step 4, misma lógica
- **Paso 5** (`generate_prd`): Renumerar de step 7 → step 5, ampliar para incluir specs RAG/Patrones como secciones del PRD (no como ejecución externa)

### 3. `src/hooks/useProjectWizard.ts`
- Actualizar `STEP_NAMES` a 5 pasos
- Actualizar `loadProject` para mapear pasos existentes (retrocompatibilidad con proyectos de 10 pasos)
- Simplificar `runGenericStep` — menos acciones
- Eliminar lógica de `dataPhaseComplete`, `dataProfile` (la ingesta de datos ya no es sub-fase)
- Actualizar `approveStep` para no hacer skip de pasos 8-10

### 4. `src/pages/ProjectWizard.tsx`
- Actualizar `stepLabels` a 5 pasos
- Actualizar `STEP_CONFIGS` a 5 pasos
- Eliminar toda la lógica de `dataPhaseComplete`, `ProjectDataSnapshot`, `dataSubStep`
- Simplificar el renderizado: paso 1 (entrada), paso 2 (briefing), paso 3 (alcance con auto-audit), paso 4 (AI audit), paso 5 (PRD)
- Eliminar lógica de skip de RAG/Patrones

### 5. `src/components/projects/wizard/ProjectWizardStepper.tsx`
- Eliminar prop `dataSubStep` y su renderizado
- Simplificar a 5 pasos fijos

### 6. `src/components/projects/wizard/ProjectWizardStep3.tsx`
- Adaptar para el nuevo paso 3 fusionado: genera, audita y corrige en un solo click
- Eliminar UI de contradicciones (se resuelven internamente)

## Detalle técnico clave: Paso 3 fusionado

El nuevo paso 3 ejecuta internamente (en background, async):
1. **Sub-call A**: Genera borrador de alcance (Claude Sonnet, actual paso 3)
2. **Sub-call B**: Auto-audita el borrador contra el input original (Claude Sonnet, actual paso 4)
3. **Sub-call C**: Aplica correcciones y genera versión final (Claude Sonnet, actual paso 5)

El usuario solo ve: "Generando documento de alcance..." → resultado final listo para revisar/aprobar.

## Detalle técnico clave: PRD como output final

El PRD (paso 5) se amplía para incluir:
- Todo lo del v12-lld actual
- Si el AI Audit (paso 4) detectó necesidad de RAG → sección dedicada con specs completas de cómo construirlo en Lovable
- Si detectó patrones → sección con specs de implementación
- Blueprint Lovable expandido con instrucciones copy-paste
- El PRD es el documento FINAL que se pega en Lovable/Emergent

## Impacto en datos existentes

Los proyectos existentes con 10 pasos seguirán funcionando — el hook mapeará `step_number` de la BD a la nueva numeración. Se mantiene retrocompatibilidad leyendo los pasos por su `step_number` original de Supabase.

