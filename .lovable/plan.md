## Plan: Integrar Detector de Patrones como Step 11.5 del Pipeline JARVIS ✅ DONE

### Cambios implementados

1. **`pattern-detector-pipeline/index.ts`** — Nueva acción `pipeline_run`:
   - Acepta briefing, scope y audit como input directo
   - Ejecuta Phases 1 (Domain), 2 (Sources), 3 (QG), 5 (Signals) inline sin persistir en DB
   - Enriquece Phase 1 con briefing completo, Phase 2 con Solution Candidates, Phase 5 con componentes existentes
   - Quality Gate degradación graceful: FAIL → solo capa 1 (cap 0.3), PASS_CONDITIONAL → capas 4-5 experimentales (cap 0.6)
   - Retorna `PatternDetectorOutput` estructurado con signals_by_layer, external_sources, rags_externos_needed, quality_gate, prd_injection

2. **`project-wizard-step/index.ts`** — Phase 2.5 insertada en `generate_prd_chained`:
   - Entre audit (step 11) y PRD (step 5), llama `pipeline_run` y guarda en step 12
   - Step 12 siempre status "review", nunca "error" por QG
   - `detectorOutput` se pasa a `prdStepData` para inyección en PRD
   - **Part 2**: Señales del detector inyectadas en sección 7 (Patrones de Alto Valor) con instrucción de no inventar patrones adicionales
   - **Part 4**: RAGs externos en sección 15.1 + fuentes externas en sección 19

3. **Frontend** — Fase "patrones" añadida:
   - `ChainedPhase` type: `"idle" | "alcance" | "auditoria" | "patrones" | "prd" | "done" | "error"`
   - `ChainedPRDProgress`: 4 fases visuales (antes 3)
   - `useProjectWizard`: polling incluye step 12, detecta fase "patrones" cuando step 12 está generando

### Flujo final

```
Briefing (step 2) → Scope (step 10) → Audit (step 11) → Pattern Detector (step 12) → PRD (step 5/3)
                                                              │
                                                              ├─ signals → PRD Part 2 (sección 7)
                                                              ├─ rags_externos → PRD Part 4 (sección 15.1)
                                                              └─ external_sources → PRD Part 4 (sección 19)
```
