

## Plan: Integrar Detector de Patrones como Step 11.5 del Pipeline JARVIS

### Resumen

Insertar la ejecución del detector de patrones entre la Auditoría IA (Step 11) y el PRD (Step 5) dentro del flujo `generate_prd_chained`. El detector se alimenta del briefing + alcance + auditoría, y su output se inyecta en las Parts 2 y 4 del PRD.

### Arquitectura actual (confirmada por lectura del código)

```text
generate_prd_chained (action en project-wizard-step/index.ts):
  Phase 1: Scope → save step 10
  Phase 2: AI Audit → save step 11
  Phase 3: generate_prd (recursive call) → save step 5 + step 3
    PRD Parts 1-3 (parallel) → Part 4 (sequential) → Part 5 (sequential)
```

El detector de patrones vive en `pattern-detector-pipeline/index.ts` como función separada con acciones `create` + `run_all` que ejecutan 7 fases (Domain → Sources → QG → Confidence → Signals → Credibility → Backtesting → Dashboard).

### Cambios

#### 1. `pattern-detector-pipeline/index.ts` — Nueva acción `pipeline_run`

Acción ligera que acepta briefing, scope y audit como input directo (en vez de solo sector/geography). Ejecuta las 7 fases enriquecidas con contexto del proyecto y devuelve un output estructurado (`PatternDetectorOutput`) con:

- `signals_by_layer` (5 capas)
- `external_sources` (required/recommended/experimental)
- `rags_externos_needed` (para inyectar en sección 15.1)
- `quality_gate` (PASS/PASS_CONDITIONAL/FAIL)
- `prd_injection` (textos pre-renderizados para secciones 7, 15.1, 19)

Modificaciones a las fases existentes cuando `mode === "pipeline"`:
- **Phase 1**: Inyectar briefing completo como contexto adicional
- **Phase 2**: Usar Solution Candidates del briefing como semillas para buscar fuentes más relevantes
- **Phase 5**: Vincular señales a componentes existentes de la auditoría
- **Phase 7**: Generar `prd_injection` con textos listos para inyectar

Quality Gate en modo pipeline: **NUNCA bloquea**. Si FAIL, degrada a solo capa 1 con confidence_cap 0.3.

#### 2. `project-wizard-step/index.ts` — Insertar detector en `generate_prd_chained`

Entre Phase 2 (Audit) y Phase 3 (PRD), añadir:

```text
Phase 2: AI Audit → save step 11
Phase 2.5: Pattern Detection → save step 12 (nuevo)
  - Extraer sector/geography/objective del briefing
  - Llamar pattern-detector-pipeline con action "pipeline_run"
  - Pasar briefing + scope + audit como contexto
  - Guardar resultado en step 12 (status siempre "review", nunca "error" por QG)
Phase 3: generate_prd → ahora recibe detectorOutput adicional
```

Usar `step_number: 12` en la DB (el PRD ya usa step 5 internamente). El step 12 es interno (`_internal: true`), como los steps 10 y 11.

#### 3. `project-wizard-step/index.ts` — Inyectar output del detector en PRD

**Part 2 (userPrompt2 — Secciones 5-9)**: Inyectar señales del detector en la sección 7 (Patrones de Alto Valor):
```
SEÑALES DEL DETECTOR DE PATRONES (${count} señales en 5 capas):
[JSON de señales]
INSTRUCCIÓN: Usa estas señales como base para la sección 7.
NO inventes patrones adicionales.
```

**Part 4 (userPrompt4 — Secciones 15-20)**:
- Inyectar RAGs externos en sección 15.1 (`detectorOutput.rags_externos_needed`)
- Inyectar fuentes externas en sección 19 (`detectorOutput.external_sources`)

#### 4. Frontend — Mostrar step 12 en el wizard

En `ProjectWizard.tsx`, durante el flujo `generate_prd_chained`:
- El `chainedPhase` ya muestra progreso ("alcance" → "auditoria" → "prd")
- Añadir fase intermedia "patrones" que muestra: "Detectando patrones..."
- En `useProjectWizard.ts`, el `prdSubProgress` tracking ya existe; extender para incluir la fase de patrones

Post-generación, si el step 12 tiene datos, mostrar un resumen colapsable:
- Barras de señales por capa (5 barras)
- Quality Gate badge (PASS/CONDITIONAL/FAIL)
- Contador de fuentes externas y RAGs externos identificados

### Flujo de datos

```text
Briefing (step 2)
    ↓
Scope (step 10) ──────────────────────────┐
    ↓                                      │
Audit (step 11) ──────────────────────────┤
    ↓                                      │
Pattern Detector (step 12) ←──────────────┘
    │  sector, geography extracted from briefing
    │  existing_components from audit
    │  existing_rags from audit
    ↓
    signals_by_layer ──→ PRD Part 2 (sección 7)
    rags_externos    ──→ PRD Part 4 (sección 15.1)
    external_sources ──→ PRD Part 4 (sección 19)
```

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/pattern-detector-pipeline/index.ts` | Nueva acción `pipeline_run` + enriquecer fases 1/2/5/7 con modo pipeline + QG graceful degradation |
| `supabase/functions/project-wizard-step/index.ts` | Insertar Phase 2.5 en `generate_prd_chained` + inyectar detector output en Parts 2 y 4 del PRD |
| `src/pages/ProjectWizard.tsx` | Mostrar fase "patrones" en progreso + resumen colapsable del step 12 |
| `src/hooks/useProjectWizard.ts` | Añadir fase "patrones" al `ChainedPhase` type |

### Consideraciones de timeout

La ejecución del detector puede tardar 30-60s. El `generate_prd_chained` ya corre en `waitUntil` (background), así que no hay riesgo de timeout del HTTP request. Sin embargo, el timeout total del chained pipeline (actualmente 10min) debería ser suficiente para incluir esta fase adicional.

### No se necesitan migraciones de DB

El step 12 se guarda en `project_wizard_steps` que ya soporta cualquier `step_number`. El detector sigue escribiendo en sus tablas existentes (`pattern_detector_runs`, `signal_registry`, etc.) cuando se ejecuta en modo pipeline.

