

# Plan: Pipeline Proyecto → RAG → Patrones (Encadenamiento Automático)

## Resumen

Pipeline de 3 fases encadenadas: al crear un proyecto con RAG activado, se genera automáticamente un RAG especializado. Al completar el RAG (quality_gate), se lanza la detección de patrones predictivos alimentada por el conocimiento del RAG. Todo automático, sin intervención del usuario.

---

## 1. Migración SQL

### Nuevas columnas en `business_projects`
- `linked_rag_id UUID` (referencia a `rag_projects`)
- `auto_patterns BOOLEAN DEFAULT FALSE`

### Nueva tabla `pattern_detection_runs`
- `id`, `project_id`, `rag_id`, `status` (PENDING/ANALYZING_DOMAIN/DETECTING_SOURCES/GENERATING_PATTERNS/VALIDATING/COMPLETED/FAILED)
- `domain_context JSONB`, `detected_sources JSONB`, `patterns JSONB`, `validation_results JSONB`
- `error TEXT`, `started_at`, `completed_at`, `created_at`

### Nueva tabla `detected_patterns`
- `id`, `run_id`, `project_id`, `rag_id`
- Identificacion: `name`, `description`, `layer` (1-5), `layer_name`
- Metricas: `impact`, `confidence`, `p_value`, `anticipation_days`
- Evidencia: `evidence_chunk_ids UUID[]`, `evidence_summary`, `counter_evidence`
- `data_sources JSONB`, `validation_status`, `uncertainty_type`, `retrospective_cases JSONB`

### RLS para ambas tablas
- SELECT/INSERT/UPDATE/DELETE donde `user_id` del proyecto padre coincida con `auth.uid()`

### Indice en `rag_projects.project_id`
- Ya existe la columna, solo agregar indice si falta

---

## 2. Backend: Hook post quality_gate → auto-patterns

**Archivo:** `supabase/functions/rag-architect/index.ts`

En `handlePostBuild`, case `"quality_gate"` (linea ~1718), despues de marcar el RAG como `completed`:

1. Verificar si `rag.project_id` existe
2. Consultar `business_projects` para ver si `auto_patterns = true`
3. Si si: insertar `pattern_detection_runs` + encolar job `DETECT_PATTERNS` + fire-and-forget al job-runner

---

## 3. Backend: Action `execute-pattern-detection` (service-role)

**Archivo:** `supabase/functions/rag-architect/index.ts`

Nueva action service-role con 4 sub-fases:

**Sub-fase 1: Analizar dominio desde el RAG**
- 6 queries predefinidas al RAG usando el pipeline de query elite existente (`handleQuery` interno sin auth)
- Recopilar respuestas + chunk_ids como contexto de dominio

**Sub-fase 2: Detectar fuentes de datos**
- 4 queries adicionales al RAG sobre APIs, datasets, datos en tiempo real
- Consultar `rag_knowledge_graph_nodes` filtrando por tipos `institution`, `tool`, `dataset`

**Sub-fase 3: Generar patrones por capas**
- Prompt a Gemini Pro con contexto del dominio + fuentes + KG
- Genera 10-15 patrones en 5 capas (Obvia, Analitica Avanzada, Senales Debiles, Inteligencia Lateral, Edge Extremo)
- Cada patron incluye nombre, metricas, fuentes de datos, evidencia, contra-evidencia, casos retrospectivos

**Sub-fase 4: Validar patrones contra el RAG**
- Para cada patron: buscar chunks con `search_rag_hybrid`
- Si >= 2 chunks con rrf_score > 0.01 → `validated`
- Si 1 chunk → `degraded`
- Si 0 → `moved_to_hypothesis`
- Guardar `evidence_chunk_ids` reales

Persistencia: actualizar `pattern_detection_runs` + insertar en `detected_patterns`

---

## 4. Backend: Case DETECT_PATTERNS en job-runner

**Archivo:** `supabase/functions/rag-job-runner/index.ts`

Nuevo case en el switch (junto a DOMAIN_ANALYSIS y RESUME_BUILD):
- Delega a `rag-architect` con action `execute-pattern-detection` via service-role

---

## 5. Frontend: Wizard de creacion de proyecto

**Archivo:** `src/pages/Projects.tsx` (CreateProjectDialog)

Despues de los campos basicos (nombre, empresa, valor, necesidad), agregar:

- Checkbox "Generar base de conocimiento especializada (RAG)" (default: false)
- Si activado:
  - Textarea "Dominio de conocimiento" (pre-rellenado con `need` del proyecto)
  - Selector de modo: Estandar / Profundo / Total
  - Checkbox "Detectar patrones predictivos al completar" (default: true)
- Al crear: si RAG activado, invocar `rag-architect` action `create` con `projectId`, luego vincular `linked_rag_id` en `business_projects`

---

## 6. Frontend: Tab "Patrones" en vista de proyecto

**Archivo:** `src/pages/Projects.tsx` (ProjectDetail)

Nuevo tab `TabsTrigger value="patterns"` junto a "Detector":

- Estado del pipeline: "RAG en construccion..." / "Detectando patrones..." / "N patrones detectados"
- Patrones organizados por capas (1-5) con tarjetas colapsables
- Cada tarjeta: nombre, descripcion, confidence badge, anticipation_days, fuentes de datos, evidencia del RAG, contra-evidencia
- Badge de validacion: validated / degraded / hypothesis
- Polling del estado si run esta en progreso

---

## 7. Frontend: Vinculacion visual RAG ↔ Patrones

**Archivo:** `src/components/rag/RagBuildProgress.tsx`

Si el RAG tiene `project_id`, mostrar seccion "Patrones detectados" con conteo y link al proyecto.

---

## Archivos afectados

| Archivo | Cambio |
|---|---|
| SQL migration | 2 cols en business_projects, 2 tablas nuevas, RLS, indice |
| `supabase/functions/rag-architect/index.ts` | Hook en quality_gate + action execute-pattern-detection |
| `supabase/functions/rag-job-runner/index.ts` | Case DETECT_PATTERNS |
| `src/pages/Projects.tsx` | Wizard con campos RAG + Tab Patrones |
| `src/components/rag/RagBuildProgress.tsx` | Link a patrones si vinculado a proyecto |

## Resultado esperado

- El usuario crea un proyecto con RAG activado → espera → vuelve y tiene RAG completo + 10-15 patrones detectados con evidencia real, organizados en 5 capas
- Todo automatico, todo encadenado, usando la infraestructura existente

