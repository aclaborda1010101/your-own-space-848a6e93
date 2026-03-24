

## Plan: Compilador de Arquitectura Empresarial 5 Capas (A-E) — Implementacion

### Resumen

Transformar Jarvis de generador narrativo de PRDs a compilador de arquitectura empresarial. Produce dos artefactos: PRD narrativo (BLOQUE 1/2/3) + Architecture Manifest (JSON, source of truth). Incluye validacion determinista, critic con severities, y reglas de materializacion hacia ExpertForge.

**Ajustes finales del usuario aplicados:**
1. Metadata de compilacion en el manifest (`compiler_version`, `compiled_at`, `repair_applied`, `repair_reason`, `source_prd_version`)
2. `feedback_signals` y `outcomes_tracked` con obligatoriedad contextual en el critic (warning si Capa E activa pero vacio, no error universal)

---

### Archivos afectados

| Archivo | Cambio | Est. lineas |
|---------|--------|-------------|
| `supabase/functions/project-wizard-step/manifest-schema.ts` | **NUEVO** | ~350 |
| `src/config/projectPipelinePrompts.ts` | Reescritura PRD_SYSTEM_PROMPT (L335-496) + Parts 1-6 + normalizacion | ~500 |
| `supabase/functions/project-wizard-step/index.ts` | Call 6 manifest compilation post L1777 + critic | ~250 |
| `supabase/functions/project-wizard-step/validators.ts` | Nuevo tipo `manifest_integrity` | ~80 |
| `supabase/functions/project-wizard-step/contracts.ts` | Step 5 contract update | ~40 |
| `supabase/functions/publish-to-forge/index.ts` | Interpretation rules con materialization_target | ~50 |

---

### Cambio 1: `manifest-schema.ts` (NUEVO)

Interfaces TypeScript + validador determinista + critic.

**Schema principal:**

```text
ArchitectureManifest {
  schema_version: "1.0"
  compilation_metadata: {
    compiler_version: string       // ej: "jarvis-v14"
    compiled_at: string            // ISO timestamp
    repair_applied: boolean
    repair_reason: string | null
    source_prd_version: number
    compilation_model: string      // ej: "gemini-2.5-flash"
  }
  project_summary: { name, domain, problem, solution }
  layers: {
    A_knowledge:  { active, modules[] }
    B_action:     { active, modules[] }
    C_pattern_intelligence: { active, modules[] }
    D_executive_cognition: {
      active, enabled,
      subject_type: "ceo"|"founder"|"manager"|"worker"|"mixed",
      scope: "tone_only"|"advisory"|"strategic_assist"|"decision_style",
      authority_level: "low"|"medium"|"high",
      source_types[], influences_modules[], excluded_from_modules[],
      governance_rules: string
    }
    E_improvement: { active, modules[] }
  }
  modules: ArchitectureModule[]
  interconnections: Interconnection[]
  source_systems: { name, type, owner, access_method }[]
  decisions_supported: { decision, owner, automation_level, modules_involved[] }[]
  criticality_map: Record<module_id, severity>
  evaluation_plan: {
    metrics[], datasets[], review_cadence,
    feedback_signals[],
    outcomes_tracked[]
  }
  deployment_phases: { phase, modules[], criteria }[]
}
```

**ArchitectureModule:** `module_id`, `module_name`, `module_type` (7 tipos), `layer` (A-E), `purpose`, `business_problem_solved`, `inputs[]`, `outputs[]`, `source_systems[]`, `dependencies[]`, `risk_level`, `sensitivity_zone` (7 valores), `explainability_requirement`, `confidence_policy`, `evaluation_policy`, `requires_human_approval`, `automation_level` (advisory/semi_automatic/automatic), `materialization_target` (8 valores), `execution_mode` (deterministic/llm_augmented/hybrid), `optional`, `phase`.

**Interconnection:** `from`, `to`, `data_type`, `frequency`, `criticality`, `interaction_type` (7 valores sin human_gate), `approval_required`, `review_required`.

**validateManifest() — reglas deterministas, 3 severities:**

| Regla | Severity |
|-------|----------|
| module_type no en lista | error |
| layer incoherente con module_type | error |
| pattern_module sin source_systems | error |
| Soul enabled sin governance_rules | error |
| automatic + requires_human_approval | error |
| phase != MVP con materialization_target expertforge_* | warning |
| executive_cognition_module con optional=false | warning |
| automatic en sensitivity_zone financial/legal/compliance | warning |
| Soul influences >50% modulos | warning |
| **Capa E activa sin feedback_signals ni outcomes_tracked** | **warning** (contextual) |
| Capa E modulo sin evaluation_policy | warning (no error) |
| pattern_module con purpose conversacional | advice |
| action_module con purpose de scoring | advice |
| >70% modulos automatic | advice |

---

### Cambio 2: `projectPipelinePrompts.ts` — PRD_SYSTEM_PROMPT (L335-496)

Reescritura completa:
- **Renombrar:** CAPA B/A/C → BLOQUE 1 (Contrato), BLOQUE 2 (PRD Maestro), BLOQUE 3 (Adapters)
- **Markers:** `═══BLOQUE_1═══`, `═══BLOQUE_2═══`, `═══BLOQUE_3═══`
- **Seccion 15** reorganizada en 5+2 subsecciones:
  - 15.1 Capa A — Knowledge Layer (RAGs, fuentes, retrieval policies, evals)
  - 15.2 Capa B — Action Layer (agentes, tools, workflows, orquestadores, HITL)
  - 15.3 Capa C — Pattern Intelligence (scoring, ranking, matching, forecasting, anomaly, segmentacion, causal, deterministic engines) — cada uno con `execution_mode`
  - 15.4 Capa D — Executive Cognition (Soul formal: enabled, subject_type, scope separado de authority_level, governance_rules, influences/excluded)
  - 15.5 Capa E — Improvement (telemetria, feedback_signals, outcomes_tracked — obligatoriedad contextual)
  - 15.6 Mapa Interconexiones (interaction_type sin human_gate, approval_required/review_required separados)
  - 15.7 Resumen Infraestructura por fase
- **8 preguntas obligatorias internas** como algoritmo de derivacion
- **Campos por modulo:** sensitivity_zone, materialization_target, execution_mode, requires_human_approval, automation_level
- **Criterios calidad:** no confundir RAG con pattern, Soul no por defecto, Improvement no como relleno

### Cambio 3: Parts 1-6

- **buildPrdPart1** (L498-521): Clasificacion con 7 module_type + capas A-E + BLOQUE_1
- **buildPrdPart3** (L545-597): Seccion 15 con 5 capas, Soul formal, Pattern separado de RAG, sensitivity_zone, execution_mode
- **buildPrdPart4** (L599-620): Observabilidad alineada con Capa E
- **buildPrdPart6** (L662-690): Expert Forge Adapter con reglas de materializacion por materialization_target
- **buildPrdNormalizationPrompt** (L929-956): Markers BLOQUE_1/2/3

---

### Cambio 4: Edge function — Call 6: Manifest Compilation (post L1777)

Despues del early save del PRD ensamblado, nueva llamada:

```text
Early save PRD (L1777)
→ Call 6: MANIFEST COMPILATION (gemini-flash, ~4K tokens)
  - Input: PRD completo + briefing original
  - System prompt: extrae Architecture Manifest JSON del PRD siguiendo schema v1.0
  - Output: ===ARCHITECTURE_MANIFEST=== {JSON} ===END_MANIFEST===
→ Parse (safeParseJson con repair)
→ Inyectar compilation_metadata (compiler_version, compiled_at, repair_applied, etc.)
→ validateManifest() determinista
→ Si errores criticos + no repair previo: 1 retry flash-lite
→ Guardar en output_data.architecture_manifest
→ Guardar en output_data._manifest_validation
→ Guardar en output_data._manifest_critic
→ Continuar con validation + linting existente
```

**Regla source of truth:** manifest manda sobre PRD narrativo. Documentado en system prompt.

### Cambio 5: Critic determinista

Post-validateManifest(), sin LLM. Aplica reglas de la tabla del Cambio 1. Resultado con arrays `errors[]`, `warnings[]`, `advice[]` guardado en `output_data._manifest_critic`.

---

### Cambio 6: `publish-to-forge/index.ts` (L1-62 interpretation rules)

- Si `output_data.architecture_manifest` existe, usar `materialization_target` directamente
- Fallback por tipo si no hay manifest
- No enviar modulos con phase != MVP a materializacion activa

### Cambio 7: `contracts.ts` + `validators.ts`

- contracts: Step 5 requiredSections incluye 5 capas y manifest marker
- validators: Nuevo tipo violation `"manifest_integrity"`, delega a validateManifest()

---

### Orden de implementacion

| Prio | Tarea |
|------|-------|
| P0 | Crear `manifest-schema.ts` (interfaces + validador + critic) |
| P0 | Reescribir `PRD_SYSTEM_PROMPT` + Parts 1-6 + normalizacion |
| P0 | Anadir Call 6 manifest compilation en edge function |
| P0 | Extraccion, validacion, critic y persistencia del manifest |
| P1 | Repair con flash-lite si manifest invalido |
| P1 | Actualizar publish-to-forge con materialization_target |
| P2 | Actualizar contracts.ts y validators.ts |

