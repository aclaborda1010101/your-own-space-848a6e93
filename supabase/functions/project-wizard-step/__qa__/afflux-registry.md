# QA Manual — F2 + F3 sobre fixture AFLU/AFFLUX

> Pipeline v2 · Step 25 (`Pipeline v2 — Registry Build`).
> Esta QA se hace después de haber corrido `extract` (Step 2) sobre el input AFLU/AFFLUX.

## 1. Cómo lanzar la QA

1. Ejecuta `extract` en el wizard sobre el proyecto AFLU/AFFLUX (input definido en
   `__qa__/aflu-input.md`). Esto genera `step_number=2` con:
   - `brief_version: "2.0.0"`
   - `business_extraction_v2`
   - `_f0_signals`
   - los 10 campos legacy.
2. Llama al edge function con:
   ```json
   {
     "action": "build_registry",
     "projectId": "<id-del-proyecto-AFFLUX>"
   }
   ```
3. Lee la fila más reciente de `project_wizard_steps` con `step_number = 25`.
   Su `output_data` contiene `ai_opportunity_design_v1` + `component_registry`
   + `build_meta`.

## 2. Checklist obligatorio sobre `output_data`

### `ai_opportunity_design_v1`
- [ ] `version === "1.0.0"`.
- [ ] `source_brief_version === "2.0.0"`.
- [ ] `opportunity_candidates.length >= 8` (debe haber al menos 8 oportunidades reales).
- [ ] **Todos** los `opportunity_id` matchean `^OPP-\d{3,}$`. **Ninguno** empieza por `COMP-`.
- [ ] No aparece ninguna clave `component_id` ni `ComponentRegistryItem` ni
  `component_registry` dentro del bloque F2.
- [ ] `coverage_analysis` está presente y no rellena con datos basura.

### `component_registry`
- [ ] `registry_version === "1.0.0"`.
- [ ] `client_company_name === "AFFLUX"` (o equivalente).
- [ ] `naming_collision.detected` reflejado correctamente (true si product==client).
- [ ] **Ningún componente** tiene `status === "approved_for_scope"`.
- [ ] Cada componente tiene `mutation_history[0].phase === "F3_registry_builder"` y
  `action === "created"`.
- [ ] Componentes esperados (al menos uno equivalente por cada bullet):
  - [ ] Data pipeline de transcripción de llamadas (`family: data_pipeline`,
    layer `F_integration` o `A_knowledge`, delivery `data_foundation`/`MVP`,
    referencia a las **3.000 llamadas grabadas**).
  - [ ] RAG de llamadas y conversaciones (`family: rag`, `layer: A_knowledge`).
  - [ ] Catalogador de roles de propietario (`family: agent`, `layer: B_action`,
    priority `P0_critical` o `P1_high`, evidencia de los **7 roles**).
  - [ ] Analizador de notas comerciales (`family: agent`, `layer: B_action`).
  - [ ] Asistente pre/post llamada (`family: agent` o `workflow`, `layer: B_action`).
  - [ ] Detector de eventos vitales / fallecimientos (`family: pattern_module` o
    `deterministic_engine`, `layer: C_intelligence`,
    `compliance_flags` ⊇ `personal_data_processing`,
    `external_data_enrichment`, `legal_basis_required`,
    `human_in_the_loop_required`).
  - [ ] Matching activo-inversor (`family: matching_engine`,
    `layer: C_intelligence`, `dataset_readiness_required: true`,
    **status `requires_human_review`**, dataset_requirements con `abstention_policy`,
    sin fórmula).
  - [ ] Detector de compradores institucionales tipo **Benatar**
    (`family: pattern_module` o `data_pipeline`, `layer: C_intelligence` o `F_integration`,
    `external_sources` con BORME, licencias, ayuntamiento, CNAE).
  - [ ] Generador de **revista emocional** por rol (`family: agent`,
    `layer: B_action`, `soul_dependency: consults_soul`).
  - [ ] **Soul de Alejandro** (`family: soul_module`, `layer: D_soul`,
    `human_review` ∈ {`recommended`, `mandatory`, `mandatory_with_veto`},
    `status: candidate_validated` o `requires_human_review` según evidencia).
  - [ ] **Governance / DPIA** (`family: compliance_module`, `layer: G_governance`,
    `dpia_required: true`).
- [ ] `registry.dpia.required === true` (alguno de los componentes anteriores
  dispara DPIA, p.ej. detector de fallecimientos).
- [ ] `registry.dpia.status === "not_started"` y `registry.dpia.trigger_flags` no vacío.

### `build_meta`
- [ ] `generated_at` presente.
- [ ] `f2_ms` y `f3_ms` numéricos.
- [ ] `warnings` puede tener entradas (p.ej. `F3_OPPORTUNITIES_MERGED`,
  `F3_DATASET_READINESS_FORCED_REVIEW`) — **no** debe haber `F3_FORBIDDEN_APPROVAL_DOWNGRADED`
  (eso indicaría que F2 emitió scope approval, lo cual está prohibido).

## 3. Reglas críticas que deben fallar la QA si se incumplen

1. Cualquier componente con `status === "approved_for_scope"`.
2. Cualquier `opportunity_id` con prefijo `COMP-` o sin formato `OPP-NNN`.
3. `matching_engine` o `prediction_engine` sin `dataset_requirements` y sin
   `requires_human_review`.
4. Detector de fallecimientos / Soul / scoring de inversores sin
   `dpia_required: true` cuando hay flags personales.
5. Step 2 (`step_number=2`) modificado tras el build (la UI legacy debe seguir
   intacta — F2/F3 sólo escriben `step_number=25`).
6. Cualquier mención de RAGs internos del proyecto Lovable en el registry — el
   registry sólo contiene RAGs funcionales del producto del cliente.

## 4. Resultado esperado

Si el checklist pasa, el Pipeline v2 está listo para que F4a/F4b/F5/F6/F7 lean
`step_number=25` como input canónico del Component Registry, sin tocar todavía
la UI ni los steps existentes del wizard.
