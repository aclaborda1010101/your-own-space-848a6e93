

# Plan: Optimize Pattern Detector Pipeline for Centros Comerciales

## Summary
Add new data sources, signals, a benchmark phase (4b), learning-observer integration, and benchmark context in Phase 7 -- all specific to the `centros_comerciales` sector.

## Changes

### 1. New Sources in SECTOR_UNCONVENTIONAL_SOURCES (lines 184-206)
Add 7 new entries to the `centros_comerciales` array:
- **Tier A (4)**: Idealista API, Google Places API, DGT Tráfico, Catastro Valoraciones
- **Tier B (3)**: BBVA/CaixaBank Commerce, Telefónica/Orange Movilidad, Censos/Padrones Municipales

Insert after the existing Tier A sources (line 194) and Tier B sources (line 200) respectively.

### 2. New Hardcoded Unconventional Signals
Add new signals in **both** the `executePhase5` hardcoded block (lines 824-911) and the `pipeline_run` hardcoded block (lines 2401-2530):

- **Capa 3 (2 new)**: "Índice Rotación Locales Comerciales" (Idealista+Catastro), "Proxy Satisfacción Zona Google" (Google Places API)
- **Capa 4 (2 new)**: "Ratio Gasto Tarjeta vs Renta Disponible" (BBVA+INE), "Flujo Movilidad Pico Sábado" (Telefónica Movilidad)
- **Capa 5 (2 new)**: "Benchmark Success Score (Métrica Compuesta)" (AECC+CBRE/JLL), "Resilience Index (Anti-fragilidad)" (datos propios+AECC)

Each signal will include full enriched fields (`concrete_data_source`, `variable_extracted`, `cross_with_internal`, `business_decision_enabled`, `rag_requirement`) in the `pipeline_run` block; simpler versions in the `executePhase5` block.

### 3. New Phase 4b: Reference Center Benchmarking
A new function `executePhase4b` placed between Phase 4 and Phase 5:
- Only executes when `sectorKey === "centros_comerciales"`
- Contains a hardcoded array of 10 reference centers (Xanadú, Parquesur, La Vaguada, Diagonal Mar, Marineda City, Puerto Venecia, Nueva Condomina, Bonaire, La Maquinista, Plenilunio) with their known characteristics (m2 SBA, operators, anchors, estimated occupancy, estimated sales/m2)
- Calls the LLM to analyze common success patterns: sector composition, anchor/specialty ratio, key category presence, operator density, destination vs convenience strategy
- Saves result as `phase_results.phase_4b` (`success_blueprint`)
- Called in `run_all` (line 1937), `execute_remaining` (line 1986), and `pipeline_run` (line ~2178) -- only for centros_comerciales

### 4. Connect learning-observer (fire-and-forget)
In `pipeline_run`, after Phase 7 completes and before building the final output (~line 2838):
- Fire-and-forget `fetch` to `learning-observer` Edge Function with `{ action: "evaluate_feedback", projectId, runId, signals, verdict }`
- Wrapped in try/catch so failures don't affect the pipeline
- Same pattern used in `run_all` after `executePhase7`

### 5. Enhance Phase 7 with Benchmark Context
In both `executePhase7` (standalone, line 1412) and the Phase 7 block in `pipeline_run` (line 2782):
- Check if `phase_results.phase_4b` (success_blueprint) exists
- If so, inject it into the Phase 7 prompt so hypotheses are contrasted against real successful center patterns
- Add a line like: `Benchmark de centros exitosos: ${JSON.stringify(phase4b.success_blueprint)}`

### 6. Update Prompt Blocks
The compositeMetricsBlock and unconventionalSystemRule strings (lines 648-730, 2186-2220) will be updated to reference the new signal names so the LLM is aware of them even if the hardcoded injection is the primary source.

## Files Modified
1. `supabase/functions/pattern-detector-pipeline/index.ts` -- all changes in this single file

## What is NOT touched
- Phases 1-3 logic (unchanged)
- Public Query Handler and API Key Management
- Quality Gate self-healing logic
- Serve handler structure (sequential phases)
- No DB migrations needed

