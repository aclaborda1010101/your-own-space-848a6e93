

## Diagnóstico: RAG de Alarmas atascado en post-procesamiento

**Problema identificado:** Un job `POST_BUILD_KG` para el subdominio "Régimen Sancionador" lleva más de 6 horas en estado `RUNNING` (colgado). Esto bloquea toda la cadena posterior: no se generan variables (taxonomía) ni se ejecuta el quality gate.

**Estado actual:**
- RAG `0fb6aae0` — status: `post_processing`, 464 fuentes, 634 chunks, 0 variables
- 23/24 jobs de Knowledge Graph completados
- 1 job KG atascado (id: `c3c33fda`, subdomain: "Régimen Sancionador")

### Plan de reparación

**Step 1: Desbloquear el job atascado**
Resetear el job colgado a estado `RETRY` para que el runner lo recoja de nuevo:
```sql
UPDATE rag_jobs 
SET status = 'RETRY', locked_by = NULL, locked_at = NULL, run_after = now()
WHERE id = 'c3c33fda-13c9-4dbd-8dd7-35d6caebf75b';
```

**Step 2: Disparar el job runner**
Invocar `rag-job-runner` con el `rag_id` para que procese el job desbloqueado y continúe la cascada (taxonomy batches → merge → contradictions → quality gate → completed).

### Resultado esperado
El KG del último subdominio se completará, lo que disparará automáticamente:
1. Fan-out de taxonomía (extracción de variables en lotes de 100 chunks)
2. Merge de variables
3. Detección de contradicciones
4. Quality gate
5. Estado final: `completed` con variables generadas

No requiere cambios de código.

