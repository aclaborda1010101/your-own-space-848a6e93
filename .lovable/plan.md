## Objetivo

Permitir lanzar las auditorías F4a (Step 26) y F4b (Step 27) desde la UI del wizard, sin depender de la consola del navegador.

## Cambios

### 1. Refactor `src/components/projects/wizard/BuildRegistryPanel.tsx` → `PipelineQAPanel.tsx`

Renombrar el archivo y extender la lógica:

- Mantener toda la mecánica actual: fetch directo a `${SUPABASE_URL}/functions/v1/project-wizard-step` con `Authorization: Bearer <token>` y `apikey`, captura de `STATUS` HTTP, `RAW` text, `JSON` parseado, ticker de duración en segundos, botón "Copiar RAW", resumen rápido.
- Convertir `run()` en `run(action: WizardAction, timeoutHint: number)` parametrizando la acción.
- Estado adicional: `currentAction: WizardAction | null` para mostrar qué se está ejecutando.
- Renderizar **3 botones** en el header:
  1. `Build Registry (Step 25)` → `build_registry`, hint 150s, variant `outline`.
  2. `F4a · Gap Audit (Step 26)` → `audit_f4a_gaps`, hint 180s, variant `holo`.
  3. `F4b · Feasibility (Step 27)` → `audit_f4b_feasibility`, hint 240s, variant `holo`.
- Mientras `loading`, deshabilitar los 3 botones y mostrar en el badge `${currentAction} · ${elapsed}s / ${timeoutHint}s`.
- Resumen rápido adaptativo:
  - Si `parsed.opportunity_count` o `parsed.component_count` → mostrar resumen de Step 25 (como ahora).
  - Si `parsed.audit?.gaps` o `parsed.gaps_count` → mostrar `gaps_count`, `critical_count`, `coverage_summary` (Step 26).
  - Si `parsed.audit?.component_reviews` o `parsed.recommended_next_step` → mostrar `components_reviewed`, `risks_count`, `recommended_next_step` (Step 27).

### 2. Actualizar `src/pages/ProjectWizard.tsx`

- Cambiar import: `BuildRegistryPanel` → `PipelineQAPanel`.
- Sustituir el render del componente en su posición actual (después del paso 2). Sin cambios de envoltorio ni de orden.

### 3. Borrar `BuildRegistryPanel.tsx`

Eliminar el archivo viejo para evitar imports duplicados.

### 4. Cache-bust

Bumpear timestamp en `src/main.tsx` (`// cache-bust: 2026-04-25T11:35`) para que `runtimeFreshness` fuerce reload tras el deploy y se vea la versión nueva con los 3 botones.

## Lo que NO se toca

- Edge Function `project-wizard-step` (las acciones `audit_f4a_gaps` y `audit_f4b_feasibility` ya existen).
- Detectores deterministas F4a/F4b ni runners.
- `useProjectWizard.ts`, stepper, prompts, pipeline.
- Migraciones de base de datos.

## Verificación

1. Recargar `/projects/wizard/6ef807d1-9c3b-4a9d-b88a-71530c3d7aaf`.
2. Ver card **"QA · Pipeline v2"** con 3 botones.
3. Pulsar **F4a · Gap Audit** → esperar ~3 min → `STATUS 200` + RAW + resumen `gaps_count`.
4. Si F4a `ok: true`, pulsar **F4b · Feasibility** → esperar ~4 min → `STATUS 200` + RAW + `recommended_next_step`.
5. Pegar ambos RAW para informe final.
