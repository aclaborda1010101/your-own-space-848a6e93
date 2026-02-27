

## Diagnóstico: RAG de Alarmas atascado (de nuevo) en post-procesamiento

**Estado actual:**
- RAG `0fb6aae0` — status: `post_processing`, 464 fuentes, 634 chunks, **174 variables** (la taxonomía SÍ se completó)
- 24/24 KG jobs: DONE
- 7/7 taxonomy batches + merge: DONE
- **1 job `POST_BUILD_CONTRA` (detección de contradicciones) colgado en `RUNNING`** (id: `ed6569d2`)
- No existe aún el job `POST_BUILD_QG` (quality gate) porque se crea después de CONTRA

**Causa raíz recurrente:** Los jobs de post-procesamiento pesados (KG, CONTRA, QG) hacen llamadas a Gemini con contextos grandes. Cuando el edge function excede su timeout, el proceso muere pero el job queda en `RUNNING` indefinidamente, bloqueando toda la cascada.

### Plan de reparación inmediata

**Step 1: Resetear el job CONTRA atascado**
Usar el endpoint admin del `rag-job-runner` para resetear el job `ed6569d2` a `RETRY`.

**Step 2: Disparar el job runner**
Invocar `rag-job-runner` con `rag_id` para que procese CONTRA y luego encadene QG → completed.

### Plan de prevención (evitar que se repita)

**Step 3: Añadir detección automática de jobs colgados en el runner**
Modificar `rag-job-runner` para que al inicio de cada ejecución detecte jobs en estado `RUNNING` con `locked_at` mayor a 10 minutos y los resetee automáticamente a `RETRY`. Esto eliminará la necesidad de intervención manual cada vez que un job se cuelga.

### Detalle técnico del Step 3

En `rag-job-runner/index.ts`, antes de llamar a `drainJobs()`, añadir:

```typescript
// Auto-recover stuck jobs (locked > 10 min)
const { data: stuckJobs } = await sb
  .from("rag_jobs")
  .update({ status: "RETRY", locked_by: null, locked_at: null, run_after: new Date().toISOString() })
  .eq("status", "RUNNING")
  .lt("locked_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
  .select("id, job_type");
if (stuckJobs?.length) console.log(`[auto-recovery] Reset ${stuckJobs.length} stuck jobs`);
```

Si se proporciona `rag_id`, limitar la recuperación solo a ese proyecto.

### Resultado esperado
- Reparación inmediata: CONTRA se reintenta → QG se ejecuta → status pasa a `completed`
- Prevención: cualquier job futuro que se cuelgue será auto-recuperado en la siguiente invocación del runner

