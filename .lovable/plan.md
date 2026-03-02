

## Plan: RAG Constructor v6 — Upgrade Completo (4 Sprints)

El documento define 17 mejoras en 4 sprints. Implementación en orden según prioridad de impacto.

---

### SPRINT A: Impacto Máximo

**A1. Chunking inteligente con overlap** (`rag-job-runner/index.ts`)
- Reemplazar `cheapChunk()` (lines 403-429) con `chunkText()` que usa separadores jerárquicos (##, \n\n, \n, .) con overlap de 200 chars y tamaño max 1500 chars
- Actualizar `handleChunk()` para usar el nuevo chunker
- Resultado esperado: ratio chunks/fuente de 1.1:1 → 5-10:1

**A2. Weighting por tier en retrieval** (`rag-architect/index.ts`)
- En `handleQuery()`, tras el hybrid search (line ~2890), ampliar `match_count` a 60 (3× top_k)
- Aplicar re-ranking por tier después del retrieve: Gold=1.0, Silver=0.5, Bronze=0.2
- Actualizar `applySourceAuthorityBoosts` para usar estos pesos multiplicativos

**A3. Edges en KG — fix matching** (`rag-architect/index.ts`)
- Ya funciona la estructura: tabla `rag_knowledge_graph_edges` existe, CHECK constraint ya fue eliminado, y `buildKGForSubdomain` ya genera y persiste edges
- **Fix**: Reemplazar `ilike` matching (line 2140) por `normalized_name` matching para manejar tildes/variantes
- SQL migration: `ALTER TABLE rag_knowledge_graph_nodes ADD COLUMN IF NOT EXISTS normalized_name TEXT` + index
- Guardar `normalized_name` en cada insert de nodo y buscar edges por nombre normalizado

**A4. Deduplicación de fuentes** (`rag-job-runner/index.ts`)
- Añadir `isDuplicateSource()` con 4 checks: content_hash, DOI, título normalizado, URL canónica
- Integrar en `handleFetch()` antes de procesar cada fuente
- La columna `content_hash` en `rag_sources` ya existe

---

### SPRINT B: Calidad de Variables

**B1. Schema de variables por dominio** (`rag-architect/index.ts` + `rag-job-runner/index.ts`)
- Definir `VARIABLE_SCHEMAS` por tipo de dominio (psychology, legal, marketing, generic)
- Guardar schema elegido en `domain_map.variable_schema` durante el domain analysis
- Inyectar categorías válidas en el prompt de `handleTaxonomyBatch`

**B2. Normalización de sinónimos** (`rag-job-runner/index.ts`)
- En `handleTaxonomyMerge`, ejecutar normalización de categorías (context→contexto, trigger→detonante, etc.)

**B3. Confidence threshold** (`rag-job-runner/index.ts`)
- Filtrar variables con confianza <0.3 en `handleTaxonomyBatch`
- En merge, eliminar variables con <2 chunks de soporte y confianza <0.4

---

### SPRINT C: Guardrails y Contexto

**C1. Variables de contexto obligatorias** 
- SQL: `ALTER TABLE rag_projects ADD COLUMN IF NOT EXISTS context_variables JSONB DEFAULT '{}'`
- UI: Formulario en `RagDomainReview` para definir variables de contexto según dominio
- Inyectar en todos los prompts de query

**C2. Guardrails automáticos por dominio** (`rag-architect/index.ts`)
- Definir `DOMAIN_GUARDRAILS` y `ALWAYS_GUARDRAIL_DOMAINS`
- Detectar tipo de dominio desde `domain_map` y añadir disclaimers automáticos en respuestas

**C3. Confianza calibrada** (`rag-architect/index.ts`)
- Reemplazar `confidence = 0.7` hardcoded (line 3017) con `calculateConfidence()` basado en: similaridad normalizada (40%), ratio Gold (30%), cobertura de chunks (30%)

---

### SPRINT D: Monitorización y Feedback

**D1. Dashboard de salud** (nuevo componente `RagHealthTab.tsx`)
- Nueva pestaña "Salud" en `RagBuildProgress` con métricas: chunks/fuente, % Gold, KG edges/nodos, variables/100 chunks, avg confianza variables
- Semáforo visual por métrica

**D2. Logging de consultas** — ya existe `rag_query_log` con schema básico
- SQL: añadir columnas `chunks_retrieved`, `reranked_count`, `confidence`, `guardrail_triggered`, `feedback`
- UI: botón thumbs up/down en `RagChat` para feedback

**D3. Quality gate mejorado** (`rag-architect/index.ts`)
- Actualizar `runQualityGate` para incluir nuevas métricas (chunks/fuente, KG edges/nodos, confianza variables)
- Añadir verdicts: PRODUCTION_READY, GOOD_ENOUGH, NEEDS_IMPROVEMENT, NOT_READY

---

### SQL Migration (una sola)

```sql
-- A3: normalized_name para KG nodes
ALTER TABLE rag_knowledge_graph_nodes ADD COLUMN IF NOT EXISTS normalized_name TEXT;
CREATE INDEX IF NOT EXISTS idx_kg_nodes_normalized ON rag_knowledge_graph_nodes (rag_id, normalized_name);

-- C1: context_variables
ALTER TABLE rag_projects ADD COLUMN IF NOT EXISTS context_variables JSONB DEFAULT '{}';

-- D2: extra columns en query_log
ALTER TABLE rag_query_log 
  ADD COLUMN IF NOT EXISTS chunks_retrieved INT,
  ADD COLUMN IF NOT EXISTS reranked_count INT,
  ADD COLUMN IF NOT EXISTS confidence NUMERIC,
  ADD COLUMN IF NOT EXISTS guardrail_triggered BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS feedback TEXT;
```

---

### Archivos a modificar

1. **SQL migration** — schema updates
2. **`supabase/functions/rag-job-runner/index.ts`** — A1 (chunking), A4 (dedup), B1-B3 (variables)
3. **`supabase/functions/rag-architect/index.ts`** — A2 (weighting), A3 (KG fix), C1-C3 (guardrails/confidence), D3 (quality gate)
4. **`src/components/rag/RagHealthTab.tsx`** — D1 (nuevo componente)
5. **`src/components/rag/RagBuildProgress.tsx`** — añadir pestaña Salud
6. **`src/components/rag/RagChat.tsx`** — D2 (feedback thumbs)
7. Redeploy: `rag-job-runner`, `rag-architect`

---

### Orden de implementación

Dado el volumen (17 mejoras, 2 edge functions grandes), propongo implementar **Sprint A primero** en este ciclo. Es el de máximo impacto y los sprints B-D dependen de que A esté estable.

### Tareas Sprint A

1. SQL migration (normalized_name, context_variables, query_log columns)
2. Chunking inteligente con overlap en rag-job-runner
3. Deduplicación de fuentes en rag-job-runner
4. Fix KG edge matching con normalized_name en rag-architect
5. Weighting por tier y confianza calibrada en rag-architect query
6. Guardrails automáticos por dominio en rag-architect
7. Dashboard de salud del RAG (RagHealthTab)
8. Feedback thumbs en RagChat
9. Redeploy edge functions

