

# Detector de Patrones v1 — Version Simplificada

## Resumen

Implementar la estructura completa del Detector de Patrones dentro del modulo de Proyectos, con UI de 5 tabs, 6 tablas nuevas en Supabase, 1 Edge Function de pipeline multi-fase, y integracion con Firecrawl para scraping de fuentes. El backtesting real con Python queda preparado (tablas + UI) pero la ejecucion numerica la hace la IA por ahora.

## Arquitectura general

El sistema reutiliza el patron del `idea-pipeline-step` existente: una Edge Function que orquesta fases secuenciales con diferentes modelos de IA, guarda resultados incrementales en una tabla de pipeline, y ejecuta pasos pesados en background con `EdgeRuntime.waitUntil()`.

```text
UI (Projects.tsx)
  -> Tab "Detector de Patrones" (nuevo)
     -> Sub-tabs: Fuentes | RAG | Analisis por Capas | Datasets | Backtesting
  -> Boton "Iniciar Analisis"
     -> Llama a Edge Function "pattern-detector-pipeline"
        -> Fase 1: Comprension del dominio (Gemini Flash)
        -> Fase 2: Descubrimiento de fuentes (Firecrawl + Gemini)
        -> Fase 3: Quality Gate del RAG (automatico)
        -> Fase 4: Gestion de datos (upload usuario o proxy)
        -> Fase 5: Deteccion de patrones por capas (Claude Sonnet)
        -> Fase 6: Backtesting (Claude — estimaciones IA, no Python)
        -> Fase 7: Hipotesis accionables (Claude)
     -> Guarda resultados incrementales en pattern_detector_runs
     -> UI muestra progreso en tiempo real via polling
```

## Tablas nuevas (6 tablas)

### 1. `pattern_detector_runs`
Tabla principal del pipeline, similar a `pipeline_runs`.

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid PK | |
| project_id | uuid FK -> business_projects | Proyecto asociado |
| user_id | uuid | |
| sector | text | Sector detectado |
| geography | text | |
| time_horizon | text | |
| business_objective | text | Objetivo del analisis |
| baseline_definition | text | Modelo baseline |
| status | text | pending, running_phase_N, completed, failed, blocked |
| current_phase | int | 1-7 |
| phase_results | jsonb | Resultados por fase |
| quality_gate | jsonb | Resultado del quality gate |
| quality_gate_passed | boolean | |
| dashboard_output | jsonb | JSON maestro para UI |
| model_verdict | text | VALID, NOT_RELIABLE_YET, BLOCKED |
| tokens_used | jsonb | |
| error_log | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 2. `data_sources_registry`
Registro de fuentes encontradas/registradas.

| Columna | Tipo |
|---------|------|
| id | uuid PK |
| run_id | uuid FK -> pattern_detector_runs |
| user_id | uuid |
| source_name | text |
| url | text |
| source_type | text (API, Paper, Report, Web, Gov, DB) |
| reliability_score | int (1-10) |
| data_type | text |
| update_frequency | text |
| coverage_period | text |
| status | text (active, degraded, deprecated) |
| scraped_content | text (contenido via Firecrawl) |
| last_accessed | timestamptz |
| created_at | timestamptz |

### 3. `signal_registry`
Patrones detectados con metadatos completos.

| Columna | Tipo |
|---------|------|
| id | uuid PK |
| run_id | uuid FK |
| user_id | uuid |
| layer_id | int (1-5) |
| layer_name | text |
| signal_name | text |
| description | text |
| confidence | numeric |
| p_value | numeric (estimado por IA) |
| impact | text (high, medium, low) |
| trend | text (up, down, stable) |
| uncertainty_type | text (epistemic, aleatoric) |
| devil_advocate_result | text |
| contradicting_evidence | text |
| data_source | text |
| sector | text (para cross-learning) |
| created_at | timestamptz |

### 4. `project_datasets`
Datasets subidos o generados.

| Columna | Tipo |
|---------|------|
| id | uuid PK |
| run_id | uuid FK |
| user_id | uuid |
| name | text |
| source_type | text (user_upload, proxy, generated) |
| file_url | text |
| row_count | int |
| column_count | int |
| quality_report | jsonb |
| confidential | boolean default true |
| created_at | timestamptz |

### 5. `model_backtests`
Resultados de backtesting por modelo.

| Columna | Tipo |
|---------|------|
| id | uuid PK |
| run_id | uuid FK |
| user_id | uuid |
| baseline_rmse | numeric |
| naive_rmse | numeric |
| model_rmse | numeric |
| uplift_vs_naive_pct | numeric |
| uplift_vs_baseline_pct | numeric |
| complexity_justified | boolean |
| win_rate_pct | numeric |
| precision_pct | numeric |
| recall_pct | numeric |
| false_positives | int |
| false_negatives | int |
| avg_anticipation_days | numeric |
| cost_simulation | jsonb |
| retrospective_cases | jsonb |
| created_at | timestamptz |

### 6. `rag_quality_logs`
Historico de metricas del Quality Gate.

| Columna | Tipo |
|---------|------|
| id | uuid PK |
| run_id | uuid FK |
| coverage_pct | numeric |
| freshness_pct | numeric |
| source_diversity | int |
| avg_reliability_score | numeric |
| status | text (PASS, FAIL) |
| gap_analysis | jsonb |
| self_healing_iterations | int |
| created_at | timestamptz |

Todas con RLS habilitado (user_id = auth.uid()).

## Edge Function: `pattern-detector-pipeline`

Una sola Edge Function con acciones: `create`, `execute_phase`, `status`, `add_source`, `upload_dataset`.

### Accion `create`
- Recibe: project_id, sector, geography, time_horizon, business_objective
- Crea un `pattern_detector_runs` con status "pending"
- Retorna run_id

### Accion `execute_phase`
- Recibe: run_id, phase (1-7)
- Fases 1, 3, 7: inline (rapidas)
- Fases 2, 4, 5, 6: background via `EdgeRuntime.waitUntil()`
- Cada fase guarda su resultado en `phase_results` JSONB
- Usa Gemini Flash para fases ligeras, Claude Sonnet para analisis profundo

### Fase 2 — Integracion Firecrawl
- La IA genera 5 queries de busqueda + 3 queries proxy
- Para cada query, llama a `firecrawl-search` internamente
- Filtra resultados por relevancia
- Opcionalmente scrapes las URLs mas prometedoras con `firecrawl-scrape`
- Guarda fuentes en `data_sources_registry`

### Fase 3 — Quality Gate automatico
- Cuenta fuentes por tipo, calcula cobertura, frescura
- Si no pasa: intenta 2 iteraciones de auto-correccion (busca mas fuentes)
- Si sigue fallando: status = "blocked", model_verdict = "BLOCKED"

### Fase 5 — Analisis por capas
- La IA recibe todas las fuentes + datos del usuario
- Genera senales por capa (1-5) con confianza, impacto, tendencia
- Ejecuta "abogado del diablo" como parte del prompt
- Guarda en `signal_registry`

### Fase 6 — Backtesting (IA, no Python)
- La IA estima metricas basandose en los datos disponibles
- Marca explicitamente que son estimaciones, no calculos reales
- Compara contra baseline y naive
- Guarda en `model_backtests`

## Cambios en el Frontend

### `src/pages/Projects.tsx`
- Anadir tab "Detector" en `ProjectDetail` (junto a Necesidad, Contactos, Timeline, Tareas)
- El tab muestra un componente `PatternDetector`

### Nuevo: `src/components/projects/PatternDetector.tsx`
Componente principal con sub-tabs:

**Tab Fuentes**: Lista de `data_sources_registry` con scoring, estado, URL. Boton "Buscar fuentes" que lanza Fase 2.

**Tab RAG / Quality Gate**: Metricas del quality gate (cobertura, frescura, diversidad, fiabilidad). Barra de progreso. Estado PASS/FAIL con colores.

**Tab Analisis por Capas**: 5 capas colapsables. Cada senal con badge de confianza, impacto, tendencia, resultado del abogado del diablo. Codigo de color por capa.

**Tab Datasets**: Lista de datasets subidos/generados. Boton de upload CSV/Excel/JSON. Reporte de calidad. Flag de confidencialidad.

**Tab Backtesting**: Metricas principales (RMSE, win rate, uplift). Tabla de casos retrospectivos. Simulacion de costes. Veredicto del modelo con semaforo (verde/amarillo/rojo).

### Nuevo: `src/components/projects/PatternDetectorSetup.tsx`
Dialog/formulario inicial donde el usuario define: sector, geografia, horizonte temporal, objetivo de negocio. Boton "Iniciar Analisis".

### Nuevo: `src/hooks/usePatternDetector.tsx`
Hook que gestiona: crear run, ejecutar fases, polling de estado, cargar fuentes/senales/backtests.

## Archivos a crear/modificar

| Archivo | Accion |
|---------|--------|
| Migracion SQL | 6 tablas + RLS + triggers updated_at |
| `supabase/functions/pattern-detector-pipeline/index.ts` | Edge Function nueva (pipeline de 7 fases) |
| `supabase/config.toml` | Anadir verify_jwt = false para la nueva funcion |
| `src/components/projects/PatternDetector.tsx` | Componente principal con 5 sub-tabs |
| `src/components/projects/PatternDetectorSetup.tsx` | Formulario de configuracion inicial |
| `src/hooks/usePatternDetector.tsx` | Hook de gestion |
| `src/pages/Projects.tsx` | Anadir tab "Detector" en ProjectDetail |

## Limitaciones documentadas (v1)

1. **Sin Python**: Las metricas de backtesting (RMSE, p-value, correlaciones) son estimaciones de la IA, no calculos reales. La UI lo indica claramente con un badge "Estimado por IA".
2. **Sin entrenamiento de modelos**: No hay sklearn/tensorflow. El "modelo" es un conjunto de reglas y senales detectadas por la IA.
3. **Sin workers periodicos**: Los workers (source-health-checker, auto-retraining, drift-detector) no se implementan en v1. Se dejan las tablas preparadas.
4. **Cross-learning**: Se guarda el sector en `signal_registry` para futuro cross-learning, pero no se implementa la logica de sugerencias entre proyectos en v1.
5. **Cap de confianza proxy**: Implementado — si no hay datos del usuario, max confianza = 70%.

## Orden de implementacion

1. Migracion SQL (6 tablas + RLS)
2. Edge Function `pattern-detector-pipeline` (fases 1-7)
3. Hook `usePatternDetector`
4. Componentes UI (PatternDetector + PatternDetectorSetup)
5. Integracion en Projects.tsx
6. Deploy + test

