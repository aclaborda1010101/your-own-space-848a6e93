## Plan: Compilador de Arquitectura Empresarial 5 Capas (A-E) — ✅ IMPLEMENTADO

### Resumen
Jarvis transformado de generador narrativo de PRDs a compilador de arquitectura empresarial con 5 capas (A-E). Produce PRD narrativo (BLOQUE 1/2/3) + Architecture Manifest JSON (source of truth ejecutable).

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/project-wizard-step/manifest-schema.ts` | **NUEVO** — Interfaces, validador determinista, critic 3 severities, compilation prompt |
| `src/config/projectPipelinePrompts.ts` | PRD_SYSTEM_PROMPT reescrito con 5 capas A-E, BLOQUE markers, Parts 1-6 actualizados |
| `supabase/functions/project-wizard-step/index.ts` | Call 6 manifest compilation post early-save + repair + persistencia |
| `supabase/functions/project-wizard-step/contracts.ts` | Step 5 requiredSections con 5 capas |
| `supabase/functions/project-wizard-step/validators.ts` | Nuevo tipo manifest_integrity |
| `supabase/functions/publish-to-forge/index.ts` | Interpretation rules v2 con materialization_target |

### Arquitectura 5 Capas
- **A** Knowledge: RAGs, fuentes, embeddings
- **B** Action: Agentes, workflows, orquestadores
- **C** Pattern Intelligence: Scoring, deterministic engines, forecasting
- **D** Executive Cognition: Soul formal (scope + authority_level separados, governance_rules)
- **E** Improvement: Telemetría, feedback_signals, outcomes_tracked

### Architecture Manifest
- JSON source of truth con compilation_metadata (compiler_version, repair_applied, etc.)
- 7 module_type, sensitivity_zone, materialization_target, execution_mode por módulo
- Interconnections con interaction_type (sin human_gate) + approval_required/review_required
- Validador determinista: errors/warnings/advice
- Obligatoriedad contextual para feedback_signals/outcomes_tracked
