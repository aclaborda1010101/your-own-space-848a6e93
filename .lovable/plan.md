

## Plan: Fix EXTERNAL_SCRAPE + Verificar Firecrawl

### Problema encontrado

El `rag-job-runner` tiene un bug critico: `pick_next_job` recoge jobs `EXTERNAL_SCRAPE` pero el switch router no tiene case para ellos (linea 813: `default: throw new Error("Unknown job_type")`). Resultado: 30 EXTERNAL_SCRAPE en RETRY, el worker de Railway nunca los ve.

### Estado actual del RAG Bosco

| Tipo | DONE | RETRY | DLQ |
|------|------|-------|-----|
| FETCH | 143 | 6 | 89 |
| EXTERNAL_SCRAPE | 0 | 30 | 0 |
| EXTRACT/CLEAN/CHUNK/SCORE/EMBED | 95 cada uno | 0 | 0 |

### Fix 1: Excluir EXTERNAL_SCRAPE del runner

**Archivo**: `supabase/functions/rag-job-runner/index.ts`

En el switch router (linea 773), agregar un case que simplemente libere el job sin procesarlo:

```typescript
case "EXTERNAL_SCRAPE":
  // These jobs are for the external Python worker, not this runner.
  // Unlock the job so the external worker can pick it up.
  await sb.from("rag_jobs").update({ 
    locked_by: null, 
    locked_at: null 
  }).eq("id", job.id);
  return { ok: true, job_id: job.id, job_type: job.job_type, status: "SKIPPED_FOR_EXTERNAL" };
```

### Fix 2: Filtrar EXTERNAL_SCRAPE en pick_next_job (DB function)

Alternativa mas robusta: modificar la funcion SQL `pick_next_job` para excluir `EXTERNAL_SCRAPE` del SELECT. Esto evita que el runner los tome.

Necesito ver la funcion `pick_next_job` para determinar la mejor opcion.

### Fix 3: Reset 30 EXTERNAL_SCRAPE de RETRY a PENDING

```sql
UPDATE rag_jobs 
SET status = 'PENDING', attempt = 0, error = NULL,
    locked_by = NULL, locked_at = NULL
WHERE rag_id = '8edd368f-31c2-4522-8b47-22a81f4a0000'
  AND job_type = 'EXTERNAL_SCRAPE' AND status = 'RETRY';
```

### Fix 4: Reset 6 FETCH RETRY restantes

Estos son errores de SSL/DNS que el runner no puede resolver. Derivarlos a EXTERNAL_SCRAPE o moverlos a DLQ:
- 4x `journal.unj.ac.id` (certificado SSL invalido)
- 1x `mjmr.journals.ekb.eg` (DNS failure)
- 1x connection body read error

### Verificacion del worker de Railway

Despues de los fixes:
1. Deploy rag-job-runner actualizado
2. Reset EXTERNAL_SCRAPE a PENDING
3. El worker de Railway deberia recogerlos via polling a `rag-architect` action `external-worker-poll`
4. Monitorizar si el worker reporta jobs via `external-worker-complete`

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/rag-job-runner/index.ts` | Agregar case EXTERNAL_SCRAPE que libera el job |
| DB migration | Opcionalmente filtrar EXTERNAL_SCRAPE en `pick_next_job` |
| DB migration | Reset 30 EXTERNAL_SCRAPE RETRY a PENDING |

### Detalle tecnico

Hay dos enfoques para evitar que el runner tome EXTERNAL_SCRAPE:

**Opcion A (rapida)**: Case en el switch que hace unlock + return skip. Simple pero el runner desperdicia un ciclo.

**Opcion B (limpia)**: Modificar `pick_next_job` para `WHERE job_type != 'EXTERNAL_SCRAPE'`. Mas eficiente, los jobs nunca se lockan.

Recomiendo **Opcion B** como solucion definitiva + **Opcion A** como safety net.

