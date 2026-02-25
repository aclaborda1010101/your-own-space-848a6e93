
Objetivo: explicar por qué no se ejecuta “todo seguido” y por qué tienes `0 variables`, y proponer el arreglo para que el pipeline quede 100% automático sin perder los 107 chunks actuales.

## Diagnóstico (paso a paso, con evidencia)

1) El RAG quedó marcado como `completed` antes de terminar post-build  
- En `rag-architect/index.ts`, `handleStatus` está mutando estado (no solo leyendo) y puede hacer:
  - `status = "completed"` cuando todos los `rag_research_runs` están `completed/failed`.
- Eso ocurre por polling del frontend (`useRagArchitect` llama `status` cada 5s).
- Resultado: se “cierra” el RAG aunque no se hayan ejecutado:
  - `knowledge_graph`
  - `taxonomy` (de donde salen variables)
  - `quality_gate`

2) El pipeline de ingesta de fuentes NO se drena solo  
- `rag-enqueue-sources` solo encola jobs `FETCH` para `rag_sources.status = 'NEW'` (hasta 200), pero no dispara runner automáticamente.
- `rag-job-runner` procesa `maxJobs` y termina.
- En varias llamadas “fire-and-forget” se usa `maxJobs: 1`, lo que deja cola pendiente sin orquestación continua.
- Estado real actual del RAG `8a3b722d...`:
  - `rag_sources`: `135 FETCHED`, `20 SKIPPED`, `5 NEW`, `1 PENDING_EXTERNAL`, `1 FAILED`
  - `rag_jobs`: `134 EXTRACT PENDING`, `8 FETCH RETRY`, `1 EXTERNAL_SCRAPE PENDING`
- Conclusión: sí avanzó, pero quedó a medio pipeline por falta de drenado continuo.

3) `0 variables` porque no se ejecutó (o no produjo) la etapa de taxonomy  
- `total_variables` solo se actualiza dentro de `buildTaxonomy`.
- Ahora mismo en DB:
  - `rag_taxonomy = 0`
  - `rag_variables = 0`
  - `rag_knowledge_graph_nodes = 0`
  - `rag_quality_checks = 0`
- Es consistente con “post-build nunca ejecutado correctamente”.

4) Además, auto-patterns sigue desactivado  
- En `business_projects`, `auto_patterns = false` para ese proyecto.
- Aunque el RAG cierre, no dispara patrones automáticos.

## Qué está fallando exactamente (resumen corto)

- Falla lógica de estado: `handleStatus` no debería completar un RAG.
- Falla de orquestación: la cola de jobs no tiene drenado automático robusto.
- Falla de dependencia: variables dependen de taxonomy; taxonomy no corrió.
- Config de proyecto: `auto_patterns` en false.

## Plan de corrección (sin perder tus 107 chunks)

### Fase 1 — Corregir “completed prematuro”
Archivo: `supabase/functions/rag-architect/index.ts`

1. Cambiar `handleStatus` para que sea solo lectura (sin actualizar `rag_projects.status` a `completed/failed`).
2. El único punto autorizado para marcar `completed` será fin de `handlePostBuild -> quality_gate`.
3. Añadir guard de recuperación:
   - si `status = completed` y no existen `rag_quality_checks`, forzar `post_processing` + `triggerPostBuild("knowledge_graph")`.

Impacto: evita cierres falsos y garantiza que variables/KG/quality se ejecuten antes del estado final.

### Fase 2 — Hacer que la ingesta se procese sola hasta vaciar cola
Archivos:
- `supabase/functions/rag-enqueue-sources/index.ts`
- `supabase/functions/rag-job-runner/index.ts`
- `supabase/functions/rag-architect/index.ts` (llamadas fire-and-forget)

1. En `rag-enqueue-sources`, tras encolar, disparar `rag-job-runner` automáticamente (`maxJobs` alto, p.ej. 20).
2. En `rag-job-runner`, al finalizar un lote:
   - si siguen jobs `PENDING/RETRY`, auto-invocarse nuevamente (self-kick) hasta drenar.
3. Subir llamadas actuales de `maxJobs: 1` a lote útil (10–20) en puntos de disparo.
4. Mantener límites de seguridad (cap por invocación) para no pasarse de CPU/timeout.

Impacto: no tendrás que lanzar manualmente runner repetidas veces; los `EXTRACT/CLEAN/CHUNK/SCORE/EMBED` avanzarán solos.

### Fase 3 — Garantizar variables aunque falle extracción de conceptos
Archivo: `supabase/functions/rag-architect/index.ts` (función `buildTaxonomy`)

1. Si `conceptsSummary` viene vacío:
   - construir contexto alterno con muestras de `rag_chunks.content` (no solo `metadata.concepts`).
2. Si LLM devuelve `variables` vacío:
   - fallback con `domain_map.critical_variables` (normalizando nombre/tipo/descripcion).
3. Recontar y persistir `total_variables` al final siempre.

Impacto: se evita `0 variables` cuando hay chunks pero falta metadata enriquecida.

### Fase 4 — Activar automatización de patrones al cerrar bien el RAG
- Ajustar `auto_patterns = true` en el `business_project` vinculado.
- Verificar que al completar `quality_gate` se cree `pattern_detection_runs` y job `DETECT_PATTERNS`.

## Verificación funcional (E2E)

1. Estado de cola:
- `rag_jobs` debe tender a 0 `PENDING/RETRY` (excepto bloqueos externos puntuales).
2. Estado de fuentes:
- `NEW` debe bajar a 0 (o casi 0 si entran nuevas).
3. Post-build:
- Deben existir registros en:
  - `rag_knowledge_graph_nodes`
  - `rag_taxonomy`
  - `rag_variables`
  - `rag_quality_checks`
4. RAG final:
- `status = completed`
- `total_variables > 0`
- `quality_verdict` no nulo
5. Patrones:
- con `auto_patterns = true`, debe crearse `pattern_detection_runs` automáticamente tras completion.

## Detalle técnico (para implementación)

- Causa raíz principal: mezcla de “lectura” y “orquestación” en `handleStatus`; el polling del frontend provoca transiciones de estado no terminalmente válidas.
- Mejora estructural recomendada:
  - `status` endpoint = observabilidad pura.
  - transiciones de estado = solo en handlers de pipeline (`build-batch`, `post-build`, `quality_gate`).
- Para escalado:
  - mantener idempotencia en inserciones (`on conflict`/dedup) y no romper el historial.
  - no borrar chunks existentes (cumple tu requisito de conservar 107 y sumar nuevos).
