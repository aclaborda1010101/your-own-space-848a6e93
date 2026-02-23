

# RAG Architect -- Upgrade a Nivel Competicion (7 Upgrades)

El documento describe 7 mejoras para llevar el RAG de "basico" a "competicion". Las tablas necesarias ya existen en la BD. Los cambios son principalmente en el edge function y una migracion SQL.

## Estado actual vs lo que falta

| Upgrade | Tablas | Logica | Estado |
|---------|--------|--------|--------|
| 1. RRF + Reranking | `rag_chunks` (falta columna `content_tsv`) | Solo vector search en `handleQuery` | Falta todo |
| 2. Knowledge Graph | `rag_knowledge_graph_nodes`, `_edges` existen | Nunca se pueblan durante el build | Falta logica |
| 3. Fuentes completas (PDFs) | No aplica | Solo se usan abstracts de Semantic Scholar | Falta logica |
| 4. Quality Gate real | `rag_quality_checks` existe | Solo cuenta chunks, no evalua respuestas | Falta logica |
| 5. Taxonomia automatica | `rag_taxonomy`, `rag_variables` existen | Nunca se pueblan durante el build | Falta logica |
| 6. Contradiction Detection | `rag_contradictions` existe | Nunca se puebla durante el build | Falta logica |
| 7. Formatos de entrega | `rag_api_keys` existe, export parcial | Falta embed page y public_query | Falta UI + logica |

## Orden de implementacion (por impacto)

Dado el limite de 150s por ejecucion de edge function, los upgrades 2, 4, 5 y 6 se ejecutaran como pasos post-build (un batch extra al final).

### Fase 1 -- Migracion SQL

1. Agregar columna `content_tsv tsvector` a `rag_chunks`
2. Trigger para auto-generar tsvector al insertar/actualizar
3. Indice GIN para busqueda rapida
4. Funcion `search_rag_hybrid` (RRF: semantica + keywords)
5. Funcion `search_graph_nodes` (busqueda de nodos del knowledge graph por embedding)
6. Funcion `increment_node_source_count`
7. Generar tsvector para chunks existentes

```text
-- Columna + trigger + indice para tsvector
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS content_tsv tsvector;
UPDATE rag_chunks SET content_tsv = to_tsvector('spanish', coalesce(content, ''));
CREATE TRIGGER trg_chunk_tsvector BEFORE INSERT OR UPDATE ON rag_chunks
  FOR EACH ROW EXECUTE FUNCTION update_chunk_tsvector();
CREATE INDEX idx_chunks_tsv ON rag_chunks USING GIN (content_tsv);

-- search_rag_hybrid: RRF combinando semantica + keywords
-- search_graph_nodes: buscar nodos del knowledge graph por embedding
-- increment_node_source_count: incrementar contador de fuentes en nodo
```

### Fase 2 -- Edge Function: Upgrade 1 (RRF + Reranking en handleQuery)

Modificar `handleQuery` (lineas 1453-1563):
- Paso 1: Generar embedding (ya existe)
- Paso 2: Llamar `search_rag_hybrid` en vez de `search_rag_chunks` (RRF: top 15 candidatos)
- Paso 3: Reranking con Gemini (puntuar relevancia 0-10 para cada candidato, quedarse con top 5)
- Paso 4: Generar respuesta con los top 5 chunks rerankeados

Nueva funcion `rerankChunks(question, chunks)` que usa Gemini para puntuar relevancia.

### Fase 3 -- Edge Function: Upgrades 2, 5, 6 (Post-build processing)

Agregar un paso final al build (cuando el ultimo batch termina, lineas 1259-1283). En vez de solo guardar quality_verdict, encadenar 3 pasos post-build via auto-invocacion:

**Nuevo action `post-build`** con sub-acciones:

1. **Knowledge Graph** (Upgrade 2): Para cada subdomain, tomar sus chunks, pedir a Gemini que extraiga entidades + relaciones, guardar en `rag_knowledge_graph_nodes` y `_edges`. Deduplicar nodos por label.

2. **Taxonomy** (Upgrade 5): Tomar todos los chunks y sus conceptos, pedir a Gemini que organice jerarquicamente, guardar en `rag_taxonomy` y `rag_variables`.

3. **Contradiction Detection** (Upgrade 6): Por subdomain, enviar batches de chunks a Gemini para detectar contradicciones, guardar en `rag_contradictions`.

Cada sub-accion se ejecuta como un batch separado (auto-invocacion) para respetar el limite de 150s.

### Fase 4 -- Edge Function: Upgrade 3 (Fuentes completas)

Mejorar `handleBuildBatch` para papers academicos:
- Intentar descargar PDF completo de Semantic Scholar (`pdfs.semanticscholar.org`)
- Si el PDF se descarga, extraer texto con Gemini (puede procesar PDFs inline)
- Fallback: usar abstract (como ahora)
- No agregar CORE API (requiere API key adicional, lo dejamos para despues)

### Fase 5 -- Edge Function: Upgrade 4 (Quality Gate real)

Agregar al post-build (despues de Knowledge Graph, Taxonomy, Contradictions):
- Tomar las `validation_queries` del `domain_map`
- Ejecutar cada query contra el RAG usando `handleQuery`
- Evaluar cada respuesta con Gemini (faithfulness, relevancy, completeness, sources, 0-10)
- Calcular Use-Case Fitness Score (promedio * 10 = 0-100)
- Guardar en `rag_quality_checks` con el score real
- Actualizar verdict: >= 70 PRODUCTION_READY, >= 50 GOOD_ENOUGH, < 50 INCOMPLETE

### Fase 6 -- Upgrade 7A: Chat embebible

- Nueva pagina `src/pages/RagEmbed.tsx` en ruta `/rag/:ragId/embed`
- Chat minimalista sin sidebar ni navegacion
- Verifica API key via query param `?token=API_KEY` contra `rag_api_keys`
- Nuevo action `public_query` en la edge function que valida API key y ejecuta query
- Incrementa contador de uso mensual

### Fase 7 -- UI: Gestion de API keys

- En la vista de detalle del RAG completado, agregar tab "API / Integracion"
- Crear/revocar API keys
- Ver uso mensual
- Copiar URL del iframe embebible
- Copiar snippet de iframe HTML

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `supabase/migrations/nuevo.sql` | tsvector, trigger, indice, 3 funciones SQL |
| `supabase/functions/rag-architect/index.ts` | rerankChunks, search_rag_hybrid, post-build (KG + taxonomy + contradictions + quality gate), fetchFullPaper, public_query |
| `src/pages/RagEmbed.tsx` | Nueva pagina: chat embebible publico |
| `src/App.tsx` | Nueva ruta `/rag/:ragId/embed` |
| `src/components/rag/RagBuildProgress.tsx` | Tab de API/integracion con gestion de API keys |

## Consideraciones

- Cada post-build step se ejecuta como batch separado (auto-invocacion) para no exceder 150s
- El Knowledge Graph puede ser costoso en tokens (1 llamada a Gemini por subdomain), se procesa en batches de 10 chunks
- La Quality Gate ejecuta N queries reales, cada una con embedding + vector search + Gemini. Para un RAG con 10 validation_queries, esto toma ~60-90s
- No se agrega CORE API (requiere API key que no tenemos configurada)
- El reranking agrega ~3-5s por query pero mejora drasticamente la relevancia

