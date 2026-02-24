

# Plan: Multiplicar Fuentes + Cola Worker Externo

Este es un cambio grande que toca 4 archivos y requiere una migración SQL. Lo divido en dos bloques independientes.

---

## CAMBIO A — Multiplicar Fuentes Académicas

### A1. Query Expansion dinámico en `searchWithSemanticScholar`

**Archivo:** `supabase/functions/rag-architect/index.ts`

Reemplazar la función `searchWithSemanticScholar` (lineas 313-363) para que:
- Reciba el `domainMap` como parámetro adicional
- Genere queries dinámicamente desde `domain_map.subdomains[].key_authors` y `fundamental_works`
- Agregue variaciones técnicas: systematic review, meta-analysis, longitudinal study, intervention effectiveness
- Para nivel `frontier`: añadir queries de "2024 2025 recent advances" y "preprint emerging research"
- Total: hasta 10 queries por batch

### A2. Paginación en `searchSemanticScholarSingle`

**Archivo:** `supabase/functions/rag-architect/index.ts`

Modificar `searchSemanticScholarSingle` (lineas 367-411) para hacer hasta 3 páginas (offset 0, 20, 40). Delay de 1.2s entre páginas. Si una página devuelve < 20 resultados, parar.

### A3. Más papers por batch

**Archivo:** `supabase/functions/rag-architect/index.ts`

En `handleBuildBatch` (linea 1260): cambiar `papers.slice(0, 8)` a `papers.slice(0, 30)`. En `processSemanticScholarResults` (linea 434): cambiar `.slice(0, 10)` a `.slice(0, 20)`. En `searchWithSemanticScholar` (linea 359): cambiar `.slice(0, 15)` a `.slice(0, 30)`.

### A4. Abstracts como chunks directos

**Archivo:** `supabase/functions/rag-architect/index.ts`

Después de insertar sources en `handleBuildBatch` (tras linea 1281), para los top 15 papers con abstract > 200 chars: crear chunks directamente del abstract con formato `{title}\n\nYear: {year}\nCitations: {citationCount}\n\n{abstract}`. Insertar en `rag_chunks` con embedding, sin pasar por Gemini chunking. Esto genera chunks de alta calidad inmediatos.

### A5. PDFs Open Access como sources separadas

**Archivo:** `supabase/functions/rag-architect/index.ts`

Para papers con `pdfUrl`, insertar la URL del PDF como `rag_source` adicional con tier `tier1_gold` para que el pipeline FETCH la procese.

### A6. Expandir Perplexity para niveles no-académicos

**Archivo:** `supabase/functions/rag-architect/index.ts`

En `handleBuildBatch`, rama de niveles no-académicos (linea 1342): hacer 3 queries variadas en vez de 1. Delay de 2s entre queries.

---

## CAMBIO B — Cola EXTERNAL_SCRAPE

### B1. Migración SQL: 2 nuevas RPCs

```sql
-- pick_external_job: selecciona job EXTERNAL_SCRAPE con lock atómico
CREATE OR REPLACE FUNCTION pick_external_job(p_worker_id TEXT) ...

-- complete_external_job: marca job como completado y encola CLEAN
CREATE OR REPLACE FUNCTION complete_external_job(p_job_id UUID, p_extracted_text TEXT, p_extraction_quality TEXT) ...
```

### B2. Detección automática de URLs bloqueadas en FETCH handler

**Archivo:** `supabase/functions/rag-job-runner/index.ts`

Modificar `handleFetch` (lineas 65-130): si HTTP status es 403/503 O el dominio está en lista de protegidos (sciencedirect, springer, wiley, tandfonline, jstor, nature, sagepub, cambridge, oxfordacademic):
1. Actualizar source status a `PENDING_EXTERNAL`
2. Insertar job `EXTERNAL_SCRAPE` con payload `{url, reason}`
3. No encolar EXTRACT

### B3. Nuevas actions en rag-architect

**Archivo:** `supabase/functions/rag-architect/index.ts`

Agregar al bloque service-role (linea 2841):
- `external-worker-poll`: llama `pick_external_job`, devuelve job + URL de la source
- `external-worker-complete`: llama `complete_external_job`, devuelve `{ok: true}`
- `external-worker-fail`: llama `mark_job_retry`, devuelve `{ok: true}`

### B4. UI: Sección Worker Externo en RagIngestionConsole

**Archivo:** `src/components/rag/RagIngestionConsole.tsx`

Agregar una sección que muestre:
- Contadores de jobs EXTERNAL_SCRAPE por estado (pendientes, running, completados, fallidos)
- Badge: "Worker no conectado" (si hay pendientes y 0 running) o "Worker procesando" (si hay running)
- Estos datos vienen de los mismos `jobStats` pero filtrados; se necesita un query adicional o expandir `fetch_job_stats` para devolver stats por `job_type`

---

## Archivos afectados

| Archivo | Cambios |
|---|---|
| `supabase/functions/rag-architect/index.ts` | A1-A6 (query expansion, paginación, más papers, abstract chunks, PDF sources, Perplexity expansion) + B3 (3 nuevas actions) |
| `supabase/functions/rag-job-runner/index.ts` | B2 (detección EXTERNAL_SCRAPE en FETCH) |
| `src/components/rag/RagIngestionConsole.tsx` | B4 (sección Worker Externo) |
| SQL Migration | B1 (2 RPCs: pick_external_job, complete_external_job) |

## Resultado esperado

- CAMBIO A: ~500-800 fuentes tier1_gold por RAG (vs 91 actuales) + chunks directos de abstracts
- CAMBIO B: Infraestructura lista para que el Worker Python externo consuma jobs de scraping pesado

## Nota sobre el Worker Python

Los archivos `worker.py`, `requirements.txt`, `Dockerfile` y `README_WORKER.md` subidos son para desplegar externamente en Railway/Render. No se integran en el proyecto de Lovable; son infraestructura separada que consumirá las actions creadas en B3.

