
## Diagnóstico del estado actual

Los cambios anteriores ya implementaron la mayoría de las 4 fases, pero hay **3 bugs residuales** que impiden que funcione:

### Bug 1: Self-kick global sin scoping
El `selfKickIfNeeded` en `rag-job-runner` consulta **todos** los jobs PENDING/RETRY de la cola global. Si hay jobs de otros RAGs, sigue kicking aunque el RAG actual ya terminó. Quieres que se scope al RAG en curso.

### Bug 2: Sin safety cap en self-kicks
No hay límite de re-invocaciones. Si un job falla repetidamente (ej: RETRY con backoff), el self-kick seguirá re-invocando infinitamente.

### Bug 3: ragId no se propaga en la cadena de self-kick
El `ragId` se pierde entre invocaciones. La línea 680 hace `const ragId = processedJob ? null : null;` — siempre null. El self-kick no puede filtrar por RAG.

---

## Cambios necesarios

### Archivo: `supabase/functions/rag-job-runner/index.ts`

**1. Propagar `ragId` y `kickCount` desde el body**
- En el handler principal (línea 666-674): parsear `ragId` y `kickCount` del body además de `maxJobs`.
- Default `maxJobs` a 20 (no 1) cuando viene de self-kick.

**2. Scoped self-kick**
- `selfKickIfNeeded(ragId, kickCount)`: filtrar la query de jobs pendientes con `.eq("rag_id", ragId)` cuando ragId no es null.
- Pasar `ragId` y `kickCount + 1` al body del self-kick.
- Si `kickCount >= 50`, loguear warning y parar.

**3. Extraer ragId de jobs procesados**
- Línea 680: en vez de `null`, extraer el `rag_id` real del primer job procesado para pasarlo al self-kick.

### Archivo: `supabase/functions/rag-enqueue-sources/index.ts`

**4. Pasar ragId al fire-and-forget del runner**
- En el body del fetch al job-runner (línea 76), incluir `rag_id` para que el self-kick se scope a este RAG.

### Archivo: `supabase/functions/rag-architect/index.ts`

**5. Pasar ragId en todos los fire-and-forget al job-runner**
- Líneas ~911, ~1231, ~1772: añadir `rag_id` al body del fetch.

---

## Detalle técnico

```text
Flujo corregido:
rag-enqueue-sources → POST rag-job-runner { maxJobs:20, rag_id:"8a3b..." }
  → drainJobs(20) procesa hasta 20 jobs
  → selfKickIfNeeded("8a3b...", kickCount=0)
    → COUNT rag_jobs WHERE status IN (PENDING,RETRY) AND rag_id="8a3b..."
    → Si count > 0 y kickCount < 50:
      → POST rag-job-runner { maxJobs:20, rag_id:"8a3b...", kickCount:1 }
      → ... repite hasta count=0 o kickCount=50
```

Esto garantiza que el drenado sea automático, scoped al RAG, y con safety cap.
