# Plan QA Paso 2 — F0 + F1

## Decisiones aprobadas
- Mantener `outputSchemaVersion: "v3.2"` (solo metadata interna).
- Mantener `_truncation_repaired` (ya generado por sanitizer/repair).
- F0: Opción A — refactor mínimo para exportar helper puro testable.

## Cambios

### 1. Refactor mínimo en `supabase/functions/project-wizard-step/f0-signal-preservation.ts`
- Renombrar `function applyLimits(raw)` → `export function clampF0Result(raw)`.
- Actualizar la única llamada interna en `runF0SignalPreservation` (`applyLimits(parsed)` → `clampF0Result(parsed)`).
- Sin cambios de comportamiento runtime.

### 2. Crear `supabase/functions/project-wizard-step/f1-legacy-shape_test.ts`
Tests sin LLM:
- **ensureLegacyBriefShape**: input solo con `business_extraction_v2` → assert que existen los 10 campos legacy como arrays/objetos y que `solution_candidates.length > 0` (derivado de `client_requested_items + ai_native_opportunity_signals`).
- **stripRegistryLeaks**: input con `component_registry`, `components`, `business_extraction_v2.ComponentRegistryItem`, item con `id: "COMP-001"` → assert keys eliminadas, `leakDetected === true`, `leakDetails.length > 0`.
- **appendExtractionWarning**: crea array si no existe; añade warning.

### 3. Crear `supabase/functions/project-wizard-step/f0-signal-preservation_test.ts`
Tests sin LLM, sobre `clampF0Result`:
- Input con 40 quotes, 30 discarded, 60 entities, 40 quants, strings >500 chars.
- Asserts: golden_quotes ≤ 25, discarded ≤ 20, named_entities ≤ 50, quants ≤ 30, textos truncados a ≤500, `version === "1.0.0"`, `_meta.truncated_fields` contiene los campos saturados.

### 4. Crear `supabase/functions/project-wizard-step/__qa__/aflu-input.md`
Documento QA manual con:
- Input sintético AFLU/AFFLUX (10 frases canónicas: 3.000 llamadas, 71 visitas, muertes, 7 roles, Benatar, revista emocional, Soul de Alejandro, DNI hash, etc.).
- Checklist esperado: campos legacy presentes, `business_extraction_v2.business_catalysts` con fallecimientos, `underutilized_data_assets` con 3.000 llamadas, `quantified_economic_pains` con 71 visitas, `initial_compliance_flags` con `personal_data_processing` y `gdpr_article_22_risk`, `_f0_signals.golden_quotes` con frases relevantes, `brief_version: "2.0.0"`, NO ComponentRegistryItems.

### 5. Validación
- `deno check` sobre `index.ts`, `f0-signal-preservation.ts`, `f1-legacy-shape.ts`, y los dos `_test.ts` nuevos.
- `supabase--test_edge_functions` con `functions: ["project-wizard-step"]`.

## Restricciones
- NO tocar F2/F3/F4/F6/F7, UI, migraciones, tablas, prompts, ni `_shared/component-registry-contract.ts`.
- Sin cambio de comportamiento runtime salvo el rename del helper.

## Entregables tras ejecución
1. Archivos creados (3) y modificados (1).
2. Resultado `deno check` y `deno test`.
3. Confirmación: legacy fields presentes, `business_extraction_v2` presente, F1 no crea ComponentRegistryItems.
4. Cualquier desviación detectada.
