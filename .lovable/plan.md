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

---

## Plan: DOCX Premium — De "correcto" a "consultoría McKinsey" ✅ DONE

### Changes applied

1. **`supabase/functions/generate-document/index.ts`** — Reescritura completa:
   - **Tipografía**: Calibri 10.5pt body, Arial headings, Consolas código. Interlineado 1.15.
   - **Colores**: Paleta teal #0D9488 primary, #374151 text, alertas rojo/naranja/verde.
   - **Portada premium**: Franja teal con logo via Table, título 28pt, subtítulo 18pt, metadatos tabla invisible, badge CONFIDENCIAL rojo, franja inferior ManIAS Lab.
   - **TOC fix**: Detecta headings con número existente, evita duplicación "1. 1. TÍTULO".
   - **Tablas profesionales**: Solo bordes horizontales (#E5E7EB), header teal MAYÚSCULAS blanco bold, zebra striping, padding 6/8pt. Coloreado automático por severidad (CRÍTICO=rojo, IMPORTANTE=naranja, MENOR=verde).
   - **Tablas ASCII**: Parser de formato `+---+---+` además de `|`.
   - **Headings**: H1 teal 16pt con borde inferior, H2 gris oscuro 12pt, H3 gris medio 10pt. Sin fondo teal completo.
   - **Callout boxes**: Detecta `[PENDIENTE:`, `[ALERTA:`, `[CONFIRMADO:` → tabla 1 celda con borde izq grueso y fondo coloreado.
   - **Resumen ejecutivo visual**: Parsea `<!--EXEC_SUMMARY_JSON-->` con KPI boxes (4 columnas, número grande teal), barras de fases proporcionales, inversión total en recuadro.
   - **Página de firma**: Tabla 2 columnas (cliente vs ManIAS Lab) con campos firma/nombre/fecha, validez 15 días. Auto para steps 3, 5.
   - **Header**: Proyecto izquierda + CONFIDENCIAL rojo derecha, línea separadora gris.
   - **Footer**: ManIAS Lab izquierda + Página X de Y derecha, línea superior.

2. **`src/config/projectPipelinePrompts.ts`** — Instrucción al LLM para generar bloque `<!--EXEC_SUMMARY_JSON-->` con KPIs, inversión, ROI y fases antes del markdown.

### What did NOT change
- Lógica de upload a storage y signed URLs
- Tabla project_documents upsert
- Fases 2-10 del wizard pipeline (excepto prompt de Fase 3)

---

## Plan: Visual PDF Improvements — From "correct" to "WOW" ✅ DONE

### Changes applied

1. **`supabase/functions/generate-document/index.ts`** — Mejoras visuales completas:
   - **Google Fonts**: `@import` Raleway (headings/branding) + Inter (body text)
   - **Cover page**: Título 36pt (antes 28pt), `.cover-divider` teal 100px×4px reemplaza `<hr>`, subtítulo 16pt, `.brand-bar` padding 28px
   - **H1 bars**: `border-bottom: 3px solid #0D9488` acento teal, padding 12px
   - **Table headers**: `background: #0A3039; color: #FFFFFF` — azul oscuro ManIAS (NO gris)
   - **Callouts**: `border-radius: 4px`, iconos Unicode (⚠ PENDIENTE, 🔴 ALERTA, ✅ CONFIRMADO)
   - **KPI boxes**: `.kpi-value` 28pt (antes 24pt), barras de progreso `.kpi-bar`/`.kpi-fill` teal
   - **Score pattern detection**: Auto-detecta `**Name**: XX/100` → renderiza `.score-kpi-item` con barra de progreso
   - **Signature page**: `border-top: 2px solid #0A3039` en bloques, más spacing (padding 20px, margin 24px)

### What did NOT change
- Lógica de upload a storage y signed URLs
- Tabla project_documents upsert
- convertToPdf() y API html2pdf.app
- Fases 2-10 del wizard pipeline

---

## Plan: JARVIS Pipeline — Fixes F2→F6 ✅ DONE

### Changes applied

1. **`supabase/functions/generate-document/index.ts`** — Tag system:
   - `stripInternalOnly()`: removes `[[INTERNAL_ONLY]]` blocks in non-internal mode
   - `processPendingTags()`: replaces `[[PENDING:X]]` with `________________` in client mode
   - `processNeedsClarification()`: replaces `[[NEEDS_CLARIFICATION:X]]` with `[Por confirmar]` in client mode
   - Applied in rendering flow: stripChangelog → stripInternalOnly → processPendingTags → processNeedsClarification → translateForClient

2. **`supabase/functions/project-wizard-step/index.ts`** — 13 prompt fixes:
   - **F2 Extract**: B-01 (client name `[[PENDING:nombre_comercial]]` if unverified), B-02 (urgency-timeline alert gravedad ALTA)
   - **F3 Scope**: D-01 (MVP reconciliation with operational definition), D-02 (identity consistency), D-03 (AI metrics as objectives not fixed criteria), D-04 (changelog propagation), D-05 (`[[INTERNAL_ONLY]]` block list), D-06 (Phase 0 recurring costs note)
   - **F4 Audit**: A-01 (anti-false-positive protocol — 3 checks before OMISSION), A-02 (score as text field with bands), A-03 (urgency/timeline CRITICAL finding)
   - **F6 AI Leverage**: I-01 (textual dedup — max 2 sentences, zero repeated bigrams), I-02 (existing infrastructure → "disponible — requiere integración"), I-03 (ROI unlock condition format)

### What did NOT change
- DB schema, UI components, other edge functions
- F5 (Final Doc), F7 (PRD), F8-F10 prompts unchanged
