## Diagnóstico (confirmado en BD)

Consulté `project_wizard_steps` para el proyecto AFFLUX (`6ef807d1-…`) y esto es lo que hay realmente:

| step | versión | estado | model | qué es |
|------|---------|--------|-------|--------|
| 3 v1 | review | gemini-3.1-pro-preview | **PRD legacy LOW-LEVEL**, empieza con `"Claro, aquí tienes las secciones 1 a 4..."` |
| 5 v1 | review | gemini-3.1-pro-preview | Documento legacy |
| 10, 11, 12 | review/generating | — | **Restos del chained legacy** (Lovable Build Blueprint, etc.) |
| 25 v1 | review | gemini-2.5-flash | Registry v2 ✅ |
| 26 v1 | review | gemini-2.5-flash | Gap audit v2 ✅ |
| **27, 28, 29** | — | — | **NO EXISTEN** |

Es decir: el botón "Descargar PDF" del Step 3 baja el `output_data.document` del Step 3 v1, que es el legacy `"Claro, aquí tienes…"`. Y el `generate-document` lo titula "Borrador de Alcance" porque su `STEP_TITLES[3] = "Borrador de Alcance"`. El `runPipelineV2PRD` arrancó hoy pero se cortó tras el Step 26 (Step 27/28/29 nunca llegaron a crearse), así que el espejo Step 29→Step 3 no se ejecutó y quedó el v1 legacy intacto.

Por eso el PDF que estás abriendo:
- Se titula "Borrador de Alcance".
- Cita "Cliente: Alejandro Gordo" y mete fallecimientos como Fase 2.
- Mete "Lovable Build Blueprint", scoring 120 variables, etc.
- Tiene residuo `"Claro, aquí tienes…"` en la página 3.

No es un problema de prompt: es que estás bajando un Step 3 que nunca se regeneró desde Step 28 v2.

---

## Plan de corrección

### 1. Botón "Descargar PDF" del Step 3 ya no debe servir contenido legacy
En `src/components/projects/wizard/ProjectWizardGenericStep.tsx` (Step 3) y/o en `src/pages/ProjectWizard.tsx`:
- Si `step3Data.outputData.source !== "pipeline_v2"` ⇒ ocultar/disable el botón de descarga y mostrar un aviso: *"Este PRD viene del pipeline legacy. Pulsa **Generar PRD Técnico (v2)** antes de descargarlo."*
- Solo permitir descargar cuando `source === "pipeline_v2"` y exista `step_29_ref`.

### 2. Retitular el PDF de Step 3 cuando es v2
En `supabase/functions/generate-document/index.ts`:
- Detectar en el body un flag `isPipelineV2` (o leer en BD el `output_data.source` cuando `stepNumber === 3`).
- Si v2 ⇒ título = **"PRD Técnico para Construcción — {projectName}"** (no "Borrador de Alcance").
- Cabecera del PDF con: cliente = `companyName` (AFLU/AFFLUX), decisor = `client_decision_maker` del Step 28, ref a Step 28/29.
- Si NO v2 (legacy) ⇒ devolver `409 LEGACY_PRD_BLOCKED` con mensaje claro, salvo header `x-allow-legacy: true`.

### 3. Saneamiento de datos legacy en este proyecto
Una vez generado el PRD v2 correcto, marcar como obsoletos los pasos legacy en `project_wizard_steps`:
- `step_number IN (10, 11, 12)` para este proyecto ⇒ `status = 'archived_legacy'`.
- `step_number = 3 v1` ⇒ se sobrescribe por el espejo Step 29→Step 3 (newV3 = 2).
- Eliminar la versión v1 legacy del Step 3 si interfiere con la UI (o filtrar por `version` máxima — ya se hace).

### 4. Hacer el `runPipelineV2PRD` resiliente y observable
En `src/hooks/useProjectWizard.ts → runPipelineV2PRD`:
- Tras cada `callAction`, **verificar en BD** que el step esperado (25/26/27/28/29) existe con `version` mayor o igual al esperado, antes de pasar al siguiente. Hoy se confía en el `data.error` y por eso se cortó silenciosamente entre Step 26 y 27.
- Si una llamada devuelve 4xx/5xx, parar y mostrar `toast.error` con el step exacto y el body de error (no genérico).
- Botón "Reintentar desde el último paso completado".

### 5. Garantizar que F5 (Step 28) NO degrade el scope
Memoria de proyecto y feedback del usuario marcan estas reglas duras que `f5-scope-architect.ts` ya debería cumplir, pero hay que verificarlas con un test sobre el scope generado para AFFLUX:
- `COMP-C01` fallecimientos/herencias ⇒ MVP + compliance blocker DPIA/HITL.
- `COMP-C03` matching activo-inversor ⇒ MVP + dataset readiness blocker.
- `COMP-D01` Soul Alejandro ⇒ data foundation.
- `COMP-C04` Benatar ⇒ fast-follow F2.
- Governance RGPD/DPIA en MVP.
- Sin scoring/fórmula predictiva sin dataset readiness.

Si `runDeterministicPreWarm` o el LLM enrichment muta esos buckets ⇒ rechazar y loguear `traceable_violations`.

### 6. Bloqueo total del legacy en producción
- En `supabase/functions/project-wizard-step/index.ts`: confirmar que `LEGACY_PRD_ALLOWED = false` por defecto, y que las acciones `generate_prd_chained`, `generate_scope`, `generate_audit`, `generate_final_doc` devuelven 410 sin `x-allow-legacy: true`. (Ya parece estar — verificar en runtime.)
- En `src/hooks/useProjectWizard.ts`: marcar `runChainedPRD` como deprecated y no exponerlo en UI (solo desde el panel debug interno).

### 7. Renombrado UX para que no haya confusión nunca más
- "Borrador de Alcance" ⇒ **"PRD Técnico para Construcción"** en el Step 3 y en el PDF.
- "Documento de Alcance" del Step 5 ⇒ **"Propuesta Cliente"** (separado, viene del Step 30).

---

## Acciones concretas (cuando apruebes el plan)

1. **Migración SQL**: marcar Steps 10/11/12 del proyecto AFFLUX como archivados y borrar Step 3 v1 legacy para que la UI muestre solo lo que venga del v2.
2. **Edit `useProjectWizard.ts`**: hacer `runPipelineV2PRD` con verificación en BD entre pasos + toasts específicos por step.
3. **Edit `generate-document/index.ts`**: leer `source` del Step 3 en BD y aplicar título "PRD Técnico para Construcción" + cabecera con cliente correcto. Bloquear con 409 si `source !== 'pipeline_v2'`.
4. **Edit `ProjectWizardGenericStep.tsx`** (Step 3 path): ocultar el botón Download cuando el contenido no es v2; mostrar banner de aviso.
5. **Re-ejecutar pipeline v2** sobre AFFLUX desde la UI tras el saneamiento, y validar Step 28 contra las reglas duras (COMP-C01, C03, D01, C04, governance).
6. **Test deno** que verifique sobre un fixture AFFLUX que `buildTechnicalPrd` mantiene la asignación correcta de buckets (regression test).

---

## Resultado esperado

- Pulsar **"Generar PRD Técnico (v2)"** ejecuta los 5 steps; si falla uno, el toast lo dice claramente.
- El Step 3 mostrado en UI siempre proviene de Step 29 (espejo).
- El PDF se titula **"PRD Técnico para Construcción — AFFLUX"**, cliente = AFLU/AFFLUX, decisor = Alejandro Gordo, fases = exactamente las del Step 28.
- Sin `"Claro, aquí tienes…"`, sin "Lovable Build Blueprint" antiguo, sin scoring 120 variables.
- Bajar el PDF de un proyecto que solo tenga Step 3 legacy queda **bloqueado** con un mensaje claro hasta regenerar.
