

## Plan: Arquitectura "Patrones Primero" — Pipeline Reordenado

Reordena las Fases 8-9 del wizard en 3 fases (8-10) cuando el proyecto necesita patrones: Blueprint → RAG Dirigido → Pattern Execution.

---

### 1. DB Migration

```sql
ALTER TABLE rag_projects ADD COLUMN IF NOT EXISTS pattern_blueprint JSONB DEFAULT NULL;
```

Update `STEP_NAMES` from 9 steps to 10.

---

### 2. Frontend: Step names & configs

**`src/config/projectPipelinePrompts.ts`** — Update `STEP_NAMES` and `STEP_MODELS`:
```
Steps 1-7: unchanged
Step 8: "Blueprint de Patrones" (claude-sonnet)
Step 9: "RAG Dirigido" (claude-sonnet)  
Step 10: "Ejecución de Patrones" (claude-sonnet)
```

**`src/hooks/useProjectWizard.ts`** — Update `STEP_NAMES` array to 10 entries.

**`src/pages/ProjectWizard.tsx`** — Update `stepLabels` and `STEP_CONFIGS`:
- Step 8: `action: "generate_pattern_blueprint"`, label "Generar Blueprint", description about pattern variables/sources
- Step 9: `action: "generate_rags"` (reuse existing action but now aware of blueprint)
- Step 10: `action: "execute_patterns"`, label "Ejecutar Patrones"

Add conditional logic: if `services_decision.pattern_detector = false`, step 8 falls back to `generate_rags` (old behavior) and steps 9-10 are skipped.

---

### 3. Edge Function: `project-wizard-step/index.ts`

**New action `generate_pattern_blueprint`** (Step 8):
- Read `services_decision` from step 6 output
- If `pattern_detector.necesario = false`: fall back to existing `generate_rags` action (old step 8)
- If `true`: call `pattern-detector-pipeline` with `action: "create"`, then `execute_phase` for phases 1 and 2
- Poll status until phases complete (with timeout)
- Read `phase_results.phase_1` and `phase_2`, fetch `data_sources_registry` for discovered sources
- Build `pattern_blueprint` object (key_variables, initial_signal_map, data_requirements, sources, search_queries, proxy_queries)
- Save as step 8 output

**Modify existing `generate_rags` action** (now Step 9):
- Check if step 8 has a `pattern_blueprint` in its output
- If yes: pass `patternBlueprint` to rag-architect `handleCreate` along with existing params
- If no: behave as before (generic RAG)

**New action `execute_patterns`** (Step 10):
- Read `pattern_run_id` from step 8 output
- Call `pattern-detector-pipeline` with new `action: "execute_remaining"` (phases 3-7)
- Create `pattern_api_keys` entry
- Save results as step 10 output

**Update `STEP_ACTION_MAP`**:
```typescript
"generate_pattern_blueprint": { stepNumber: 8, stepName: "Blueprint de Patrones", useJson: true, model: "claude" },
"generate_rags":              { stepNumber: 9, stepName: "RAG Dirigido",          useJson: true, model: "claude" },
"execute_patterns":           { stepNumber: 10, stepName: "Ejecución de Patrones", useJson: true, model: "claude" },
```

Note: `generate_pattern_blueprint` and `execute_patterns` don't use the generic prompt→LLM→parse flow. They call the detector pipeline directly, so they need custom handling BEFORE the generic step handler block, similar to how `generate_prd` works.

---

### 4. Edge Function: `pattern-detector-pipeline/index.ts`

**New action `execute_remaining`**:
- Takes `run_id`, reads run data
- Executes phases 3→4→5→credibility→6→economic_backtesting→7 in background via `EdgeRuntime.waitUntil`
- Returns `{ status: "processing", run_id }` immediately

---

### 5. Edge Function: `rag-architect/index.ts`

**`handleCreate`**: Accept optional `patternBlueprint` param, enrich `domainDescription` with blueprint variables/signals/data_requirements, save blueprint in `rag_projects.pattern_blueprint`.

**`analyzeDomain`**: If `pattern_blueprint` exists on the RAG project, inject subdomain hints directing subdomains toward detector variables instead of generic topics.

**`handleConfirm`**: After `injectProjectDocuments`, if blueprint exists, inject blueprint source URLs as `rag_sources` + scrape + chunk them directly.

**`handleBuildBatch`**: If blueprint exists, use `search_queries` and `proxy_queries` from the blueprint instead of generating with LLM. Fall back to LLM-generated queries if no blueprint queries match the current subdomain.

---

### 6. Conditional flow logic

In `ProjectWizard.tsx`, determine step behavior based on `services_decision` from step 6:

| services_decision | Step 8 | Step 9 | Step 10 |
|---|---|---|---|
| patterns=false, rag=true | RAG genérico (old behavior) | Skip | Skip |
| patterns=true, rag=false | Blueprint | RAG dirigido (tier basic, internal) | Pattern Execution |
| patterns=true, rag=true | Blueprint | RAG dirigido (user tier) | Pattern Execution |
| both=false | Skip | Skip | Skip |

The `maxUnlocked` logic needs updating to handle conditional step skipping.

---

### Files modified

| File | Changes |
|---|---|
| SQL migration | `pattern_blueprint` column on `rag_projects` |
| `src/config/projectPipelinePrompts.ts` | STEP_NAMES[10], STEP_MODELS[10] |
| `src/hooks/useProjectWizard.ts` | STEP_NAMES array → 10 entries |
| `src/pages/ProjectWizard.tsx` | stepLabels, STEP_CONFIGS for 8-10, conditional flow |
| `supabase/functions/project-wizard-step/index.ts` | `generate_pattern_blueprint`, `execute_patterns` actions; modify `generate_rags` to pass blueprint |
| `supabase/functions/pattern-detector-pipeline/index.ts` | `execute_remaining` action |
| `supabase/functions/rag-architect/index.ts` | `handleCreate` blueprint param, `analyzeDomain` directed mode, `handleConfirm` blueprint source injection, `handleBuildBatch` blueprint queries |

### Implementation order
1. DB migration + STEP_NAMES/MODELS constants
2. `pattern-detector-pipeline` — add `execute_remaining`
3. `rag-architect` — blueprint support in create/analyze/confirm/buildBatch
4. `project-wizard-step` — new actions + modified generate_rags
5. Frontend — step configs, conditional flow, labels

