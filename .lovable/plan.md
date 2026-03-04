## Plan: Paralelizar Parts 1-3 del PRD con Contexto Compartido ✅ DONE

### Changes applied
1. **`supabase/functions/project-wizard-step/index.ts`** — Bloque `generate_prd`:
   - Construye `sharedContext` con empresa, módulos y roles extraídos del briefing/alcance
   - Parts 1, 2 y 3 ejecutan en `Promise.all()` (~73s vs ~190s secuencial)
   - Parts 2-3 ya NO reciben `result1.text`/`result2.text`, usan `sharedContext`
   - Part 4, validation y linter siguen secuenciales

### What did NOT change
- Prompts de Part 4 y Validation (Call 5): sin cambios
- `callPrdModel`, `callGeminiPro`, `callClaudeSonnet`: sin cambios
- Linter determinista: sin cambios (opera sobre output, no prompts)
- UI: sin cambios

---

## Plan: Migrate PRD generation to Lovable-Ready (V11) ✅ DONE

### Changes applied
1. **`src/config/projectPipelinePrompts.ts`** — Replaced with V11 (1081 lines). Step 7 model changed to `gemini-pro`. 5 new prompt builders for PRD generation.
2. **`supabase/functions/project-wizard-step/index.ts`** — `generate_prd` block replaced: 4 Gemini Pro calls + 1 Claude validation. Blueprint extracted as separate field. Specs D1/D2 included.

### What did NOT change
- Phases 2-6, 8-9: same prompts, same models
- Helper functions: `callGeminiFlash`, `callGeminiPro`, `callClaudeSonnet`, `recordCost` — reused as-is
- UI components — PRD renders as Markdown, no changes needed

---

## Plan: Gemini 3.1 Pro + Linter determinista + Normalización nombres ✅ DONE

### Changes applied

1. **Modelo Gemini 3.1 Pro** (`gemini-3.1-pro`)
   - `ai-client.ts`: aliases `gemini-pro` y `gemini-pro-3` → `gemini-3.1-pro`
   - `project-wizard-step/index.ts`: URL en `callGeminiPro` → `gemini-3.1-pro`, `mainModelUsed` → `"gemini-3.1-pro"`
   - `projectPipelinePrompts.ts`: comentarios actualizados

2. **Linter determinista post-merge** (~100 líneas)
   - Verifica 15 secciones (`# 1.` a `# 15.`), `# LOVABLE BUILD BLUEPRINT`, blueprint >100 chars, `## D1` y `## D2`
   - Reintento selectivo: Part 4 si falta Blueprint/D1/D2, Part 3 si faltan secciones 11-15
   - Máximo 1 reintento; si falla, continúa con `linter_warnings` en metadata

3. **Normalización de nombres propios**
   - System prompt inyecta `companyName` canónico desde stepData/briefing
   - Obliga a usar grafía exacta, corrige variaciones silenciosamente

---

## Plan: Data Snapshot — Fase 1 (Ingesta de datos antes del PRD) ✅ DONE

### Changes applied

1. **SQL Migration** — Tabla `client_data_files` con RLS + bucket `project-data` privado con policies de storage
2. **`supabase/functions/analyze-client-data/index.ts`** — Nueva Edge Function: upload vía FormData, parseo (CSV/JSON/TXT), análisis con Gemini Flash, acciones `get_data_profile`, `delete_file`, `update_corrections`
3. **`src/components/projects/wizard/ProjectDataSnapshot.tsx`** — Componente UI: drag & drop upload, lista de archivos con calidad, pantalla de validación con entidades/variables/cobertura/calidad
4. **`src/pages/ProjectWizard.tsx`** — Step 7 muestra DataSnapshot condicionalmente si `services_decision.rag.necesario || pattern_detector.necesario`
5. **`src/hooks/useProjectWizard.ts`** — Estados `dataProfile` y `dataPhaseComplete`, inyección de `dataProfile` en `stepData` para Step 7
6. **`supabase/functions/project-wizard-step/index.ts`** — `sharedContext` del PRD inyecta bloque `DATOS REALES DEL CLIENTE` cuando `dataProfile.has_client_data === true`
7. **`src/config/projectPipelinePrompts.ts`** — `buildPrdPart1Prompt` acepta `dataProfile` param e inyecta bloque de datos reales
8. **`supabase/config.toml`** — Config para `analyze-client-data`

### What did NOT change
- Fases 2-6, 8-10: sin cambios en prompts ni flujo
- Modo 2 (URL crawl) y Modo 3 (conexión DB): Fase 2 del spec
- Bulk Import en apps generadas: Fase 2 del spec

---

## Plan: Evolución de Señales por Capa — Fase 1 ✅ DONE

### Changes applied

1. **SQL Migration** — Columnas `trial_status`, `replaces_signal`, `trial_start_date`, `trial_min_evaluations`, `formula`, `project_id` en `signal_registry`. Tablas nuevas: `signal_performance`, `learning_events`, `improvement_proposals`, `model_change_log` con RLS.
2. **`supabase/functions/learning-observer/index.ts`** — Nueva Edge Function con 3 acciones: `diagnose_failing_signal` (diagnóstico con Gemini Pro + propuesta), `evaluate_feedback` (actualiza accuracy), `check_failing_signals` (escaneo automático accuracy < 50%).
3. **`src/config/projectPipelinePrompts.ts`** — Bloque condicional en Part 2 (pattern_detector): scoring con señales trial a peso 0.5x, output con contribución individual por señal. Validación en Call 5: verifica diferenciación established vs trial.
4. **`supabase/config.toml`** — `learning-observer` con `verify_jwt = false`.

### What is NOT in this implementation (Fase 2+)
- Periodo de prueba automático con graduación/rechazo tras N evaluaciones ✅ DONE (Fase 2)
- Admin panel Tab 5: Evolución de Señales ✅ DONE (Fase 2 — spec en PRD prompts)
- Informe mensual de valor incremental por capa ✅ DONE (Fase 2 — calculate_layer_value)
- Migración de señales entre proyectos del mismo sector

---

## Plan: Evolución de Señales — Fase 2 (Trial Automático + Panel Admin) ✅ DONE

### Changes applied

1. **SQL Migration** — `improvement_proposals`: nuevos status (`trial_active`, `graduated`, `rolled_back`), columnas `metadata`, `applied_at`, `version_before`, `version_after`. `model_change_log`: columna `proposal_id`.
2. **`supabase/functions/learning-observer/index.ts`** — Reescritura completa con 9 acciones: `diagnose_failing_signal`, `evaluate_feedback` (V2 con batch signals), `check_failing_signals`, `approve_proposal`, `reject_proposal`, `start_signal_trial`, `evaluate_trial_signals`, `rollback_change`, `calculate_layer_value`. Helpers: `graduateSignal`, `rejectSignal`, `getNextVersion`.
3. **`src/config/projectPipelinePrompts.ts`** — Part 2: spec completa del panel `/admin/learning` con 5 tabs. Part 4: QA checklist con 5 verificaciones del panel. Validation: check de panel admin con 5 tabs cuando pattern_detector=true.

### What is NOT in this implementation (Fase 3+)
- Migración de señales entre proyectos del mismo sector
