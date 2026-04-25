# Plan: arreglar el botón PRD técnico para que use el pipeline v2 (Step 28 como fuente de verdad)

## Diagnóstico (confirmado leyendo el código)

Hoy en `ProjectWizard.tsx` el botón **"Generar PRD Técnico"** (Step 3 del wizard) llama a `runChainedPRD()` → `supabase.functions.invoke("project-wizard-step", { action: "generate_prd_chained" })`.

`generate_prd_chained` es el **pipeline LEGACY**:
- Llena `step_number = 10` (alcance legacy "Senior AI Solutions Architect", 14 secciones, 120 variables, 25 patrones).
- Llena `step_number = 11` (auditoría IA legacy con scoring de automatización).
- Llena `step_number = 12` (patrones).
- Llena `step_number = 3` con un PRD low-level que arranca con "PRD LOW-LEVEL: AFFLUX", contiene "Lovable Build Blueprint", "Checklist Maestro", SQL completo, RLS, Edge Functions, motor de scoring determinista, y residuos LLM tipo "Claro, aquí tienes…". Las fases vienen del LLM, no del scope aprobado, así que mete fallecimientos en F2, matching en F2 y Soul en F3+.

En paralelo existe el **pipeline v2 nuevo** (ya implementado y funcionando, pero solo accesible desde el panel "Avanzado / Interno → PipelineQAPanel"):
- `build_registry` → `step_number = 25` (ai_opportunity_design_v1 + component_registry, F2+F3 deterministas).
- `audit_f4a_gaps` → `step_number = 26` (registry_gap_audit_v1).
- `audit_f4b_feasibility` → `step_number = 27` (registry_feasibility_audit_v1).
- `architect_scope` → `step_number = 28` (`scope_architecture_v1` con buckets data_foundation / mvp / fast_follow_f2 / deferred, blockers DPIA y dataset_readiness, soul_capture_plan).
- `generate_technical_prd` → `step_number = 29` (PRD técnico determinista construido **únicamente** desde Step 28 vía `f6-prd-builder.ts`, sin LLM, sin SQL, sin scoring inventado).
- `generate_client_proposal` → `step_number = 30` (propuesta cliente sin jerga interna vía `f7-proposal-builder.ts`).
- `audit_final_deliverables` → cross-check final.

Resultado: el pipeline correcto ya existe y produce exactamente lo que pide el usuario (Step 28 como fuente única, sin fases inventadas, separación PRD técnico vs propuesta cliente, sin "Claro aquí tienes"), pero **el botón principal del wizard sigue apuntando a la ruta antigua**.

---

## Cambios

### A. Botón "Generar PRD Técnico" → pipeline v2

**`src/hooks/useProjectWizard.ts` — nueva función `runPipelineV2PRD(pricingMode)` que reemplaza a `runChainedPRD` para el botón del wizard:**

1. Verifica que Step 2 (briefing) esté `approved`. Si no, error claro.
2. Llama secuencialmente a `project-wizard-step` con:
   - `action: "build_registry"` (steps 25 + 26 + 27 internamente — el `build_registry` actual ya hace F2+F3; añadir `audit_f4a_gaps` y `audit_f4b_feasibility` justo después porque `architect_scope` los exige).
   - `action: "audit_f4a_gaps"`.
   - `action: "audit_f4b_feasibility"`.
   - `action: "architect_scope"` → genera Step 28 `scope_architecture_v1`.
   - `action: "generate_technical_prd"` → genera Step 29 con `prd_markdown` determinista.
3. Va actualizando `chainedPhase`: `"alcance"` (registry+gap+feas), `"patrones"` (architect_scope), `"prd"` (generate_technical_prd), `"done"`.
4. Al terminar, **escribe también `step_number = 3`** con el contenido de Step 29 (`prd_markdown` + manifest_summary) para que el resto del wizard (descarga PDF, budget panel, propuesta cliente, navegación) siga funcionando sin tocar el resto de la UI. Marcar status `review`.
5. `pricingMode` se almacena para que `generate_client_proposal` lo use después.

**`src/pages/ProjectWizard.tsx`:**
- Reemplazar `runChainedPRD(pricingMode)` por `runPipelineV2PRD(pricingMode)` en el `onGenerate` del Step 3.
- En `useProjectWizard.ts` línea 932, donde tras aprobar Step 2 se auto-lanza `runChainedPRD('none')`, cambiar también a `runPipelineV2PRD('none')`.
- Mantener `runChainedPRD` exportado pero **no enlazado al botón principal** — solo accesible vía herramienta de debug por si hace falta revisar el legacy.

### B. PRD técnico generado SIEMPRE desde Step 28 (sin LLM)

`generate_technical_prd` (ya implementado) usa `buildTechnicalPrd()` y `renderPrdMarkdown()` de `f6-prd-builder.ts`, que es 100% determinista a partir de `scope_architecture_v1`. Esto garantiza:

- ✅ Cliente = AFLU/AFFLUX, decisor = Alejandro Gordo (vienen del scope que ya respeta los overrides).
- ✅ Detector de fallecimientos en MVP con DPIA/HITL (porque Step 28 lo coloca ahí).
- ✅ Matching activo-inversor en MVP con dataset_readiness blocker.
- ✅ Soul de Alejandro en data_foundation.
- ✅ Benatar en fast_follow_f2.
- ✅ Sin "Claro, aquí tienes" (no hay LLM en F6).
- ✅ Sin SQL, sin RLS, sin scoring inventado, sin "120 variables / 25 patrones".
- ✅ Sin fases inventadas.

**Pequeño ajuste en `f6-prd-builder.ts`** (`renderPrdMarkdown`): añadir cabecera explícita al PDF:
```
# PRD Técnico de Construcción
**Proyecto:** {projectName}
**Cliente / empresa:** {clientName}
**Decisor:** {decision_maker_from_scope}
**Producto:** {projectName}
**Fuente de alcance:** scope_architecture_v1 (Step 28 v{version}, row {row_id})
```
para que quede crystal-clear que ya no es legacy.

### C. Propuesta cliente separada del PRD técnico

`ProjectProposalExport` ya existe y ya invoca `generate_client_proposal` (Step 30) que es el `f7-proposal-builder.ts` determinista (renombrado a "Propuesta Cliente", sin jerga interna, con Gantt/precios/condiciones, validado contra `detectInternalJargon`).

Ajustes en `src/pages/ProjectWizard.tsx`:
1. **Renombrar el botón de descarga del Step 3** de "Borrador de alcance" a **"PRD Técnico (Lovable)"** y forzar `exportMode="internal"` para ese documento.
2. **`ProjectProposalExport`** queda etiquetado como **"Propuesta Cliente"** y es el único entregable cliente.
3. La generación de `generate_client_proposal` debe leer el `pricingMode` que se eligió en Step 3 y pasar `commercial_terms_v1` al backend (ya está casi todo cableado en `useProjectWizard.ts:1206`; solo falta inyectar `pricing_model` derivado de `pricingMode`).

### D. Bloquear el path legacy para evitar regresiones

En `supabase/functions/project-wizard-step/index.ts`:
1. En `generate_prd_chained`: **dejar el código** (por compatibilidad con proyectos viejos), pero añadir en `index.ts` un flag `LEGACY_PRD_ALLOWED = false` que devuelva 410 Gone con mensaje "Pipeline legacy desactivado. Usar build_registry + architect_scope + generate_technical_prd." cuando alguien intente llamarlo desde producción. Mantener accesible solo vía un header `x-allow-legacy: true` para debug local.
2. En `generate_prd` (action standalone): mismo tratamiento.

### E. Limpieza de `step_number = 3` cuando viene del nuevo pipeline

Cuando `runPipelineV2PRD` escribe Step 3, su `outputData` debe ser:
```json
{
  "document": "<prd_markdown de Step 29>",
  "source": "pipeline_v2",
  "step_28_ref": { "version": N, "row_id": "..." },
  "step_29_ref": { "version": N, "row_id": "..." },
  "components_total": 13,
  "components_by_bucket": { "data_foundation": 1, "mvp": 9, "fast_follow_f2": 2, "deferred": 1 }
}
```

Así `ProjectDocumentDownload` (que lee `step3.outputData.document`) baja el PDF correcto, y el badge "Avanzado/Interno" puede mostrar el manifest sin reinventar nada.

---

## Criterio de aceptación

1. Pulsar "Generar PRD Técnico" en Step 3 NO genera más el documento "PRD LOW-LEVEL / Lovable Build Blueprint / Checklist Maestro / 120 variables / 25 patrones / motor de scoring".
2. El PDF descargado desde Step 3 arranca con `# PRD Técnico de Construcción · Fuente de alcance: scope_architecture_v1 (Step 28 v…)` y respeta exactamente los buckets de Step 28 (fallecimientos en MVP, matching en MVP, Soul en data_foundation, Benatar en F2).
3. El PDF NO contiene SQL, RLS, "Claro aquí tienes…", "Edge Functions", ni "Lovable Build Blueprint".
4. La propuesta cliente sigue siendo `ProjectProposalExport` (Step 30 / `generate_client_proposal`) y queda claramente separada del PRD técnico.
5. Llamar al endpoint legacy `generate_prd_chained` desde producción devuelve 410 con mensaje claro.
6. La aprobación del Step 2 sigue auto-encadenando, pero ahora dispara `runPipelineV2PRD` en vez de la cadena legacy.
