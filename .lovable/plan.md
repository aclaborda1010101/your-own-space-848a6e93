

## Plan: Desbloquear RAG Bosco — 4 pasos + re-ejecucion post-build

### Estado confirmado
- Status: `building` (correcto, pipeline no bloqueado)
- 89 FETCH en RETRY con error `[object Object]` (bug serialization)
- 149 fuentes en NEW (nunca encoladas)
- Post-build completo (KG x10, TAXONOMY, CONTRA, QG todos DONE) pero con solo 64 chunks

### Paso 1: Fix serialization en rag-job-runner

**Archivo**: `supabase/functions/rag-job-runner/index.ts`, linea 826

```typescript
// Antes:
const errMsg = e instanceof Error ? e.message : String(e);

// Despues:
const errMsg = e instanceof Error
  ? e.message
  : (typeof e === 'object' && e !== null
      ? JSON.stringify(e).slice(0, 500)
      : String(e));
```

### Paso 2: Reset 89 FETCH RETRY a PENDING (SQL via insert tool)

```sql
UPDATE rag_jobs 
SET status = 'PENDING', attempt = 0, run_after = now(), error = NULL,
    locked_by = NULL, locked_at = NULL
WHERE rag_id = '8edd368f-31c2-4522-8b47-22a81f4a0000' 
  AND job_type = 'FETCH' AND status = 'RETRY';
```

### Paso 3: Encolar 149 fuentes NEW

Llamar a `rag-enqueue-sources` con `rag_id` via curl. Esto crea FETCH jobs y auto-dispara el job-runner.

### Paso 4: Monitorizar errores

Despues de deploy + reset + encolado, esperar ~30s y consultar los primeros jobs que fallen para ver el error real (ahora serializado correctamente).

### Paso 5: Re-ejecucion post-build tras ingesta

**Problema**: El indice unico `idx_single_post_build_job` impide insertar nuevos POST_BUILD_TAXONOMY/CONTRA/QG mientras existan los DONE. La solucion:

1. **No borrar ahora** — esperar a que la ingesta termine (status pase a post-processing o se agoten los FETCH/chunks).
2. Cuando la ingesta este completa, ejecutar:

```sql
-- Borrar post-build DONE antiguos
DELETE FROM rag_jobs 
WHERE rag_id = '8edd368f-31c2-4522-8b47-22a81f4a0000'
  AND job_type IN ('POST_BUILD_KG','POST_BUILD_TAXONOMY','POST_BUILD_CONTRA','POST_BUILD_QG')
  AND status = 'DONE';

-- Borrar nodos KG antiguos para regenerar
DELETE FROM rag_knowledge_graph_nodes 
WHERE rag_id = '8edd368f-31c2-4522-8b47-22a81f4a0000';
```

3. Luego usar el boton "Regenerar KG" de la UI (llama a `regenerate-enrichment` con step `knowledge_graph`), que encola los POST_BUILD_KG por subdominio y estos cascadean automaticamente a TAXONOMY → CONTRA → QG.

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/rag-job-runner/index.ts` | Fix serialization (1 linea) |

### Operaciones de DB (one-time via insert tool)

- Reset 89 RETRY a PENDING
- Encolar 149 NEW via edge function call
- (Despues de ingesta) Borrar POST_BUILD DONE + nodos KG para re-enriquecer

