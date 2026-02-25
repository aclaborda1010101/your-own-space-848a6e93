

## Plan: Arquitectura de Colas Asíncronas para Post-Build

### Diagnóstico del problema real

El `buildKnowledgeGraph` actual (líneas 1808-1932 de `rag-architect`) procesa **todos los subdominios secuencialmente** en una sola invocación:

```text
Para CADA subdominio (10-15):
  - 5000ms delay entre subdominios
  - Llamada a Gemini (chatWithTimeout 30s)
  - Retry con backoff 10-20s si rate limit
  - Para CADA nodo (hasta 20):
    - SELECT dedup
    - generateEmbedding → OpenAI (200ms+)
    - INSERT
    - 200ms delay
= Fácilmente 120-180s → TIMEOUT
```

Además, `handlePostBuild` (línea 1655) ejecuta cada paso síncronamente y cascadea al siguiente vía `triggerPostBuild`. Si el KG falla por timeout, el `catch` no cascadea → pipeline muerto. Y si el quality gate no encuentra `validation_queries` (línea 2177), simplemente retorna sin insertar nada → el veredicto en `handlePostBuild` (línea 1707) se calcula solo con coverage/chunks, ignorando si hay 0 KG nodes.

### Cambios requeridos

#### 1. `supabase/functions/rag-architect/index.ts` — Refactorizar `handlePostBuild`

**Paso `knowledge_graph` → fan-out a jobs:**

En vez de llamar `buildKnowledgeGraph(ragId, rag)` síncronamente, la nueva lógica:
1. Obtiene `getActiveSubdomains(rag)` → lista de subdominios
2. Inserta 1 job `POST_BUILD_KG` por subdominio en `rag_jobs`, con `payload: { subdomain: subName }`
3. Invoca `rag-job-runner` con `{ rag_id, maxJobs: 20 }` para iniciar procesamiento
4. Retorna inmediatamente

**Eliminar cascada síncrona de steps.** Los pasos `taxonomy`, `contradictions`, `quality_gate` ya no se triggerean desde `handlePostBuild` con `EdgeRuntime.waitUntil(triggerPostBuild(...))`. En su lugar, la cascada se controla desde el `rag-job-runner`.

#### 2. `supabase/functions/rag-architect/index.ts` — Nueva función `buildKnowledgeGraphForSubdomain`

Extraer el cuerpo del loop interno de `buildKnowledgeGraph` (líneas 1811-1931) en una función independiente que procese **un solo subdominio**:

```text
async function buildKGForSubdomain(ragId, subName, rag)
  - Busca chunks del subdominio (SELECT, limit 15)
  - Llama a Gemini una vez (30s timeout)
  - Inserta nodos + edges (sin delays artificiales)
  - Total: ~15-30s por subdominio → dentro del timeout
```

Esta función será invocada como una nueva action `execute-kg-subdomain` del `rag-architect`, llamable desde el `rag-job-runner`.

#### 3. `supabase/functions/rag-job-runner/index.ts` — Nuevos handlers de post-build

Añadir handlers para 4 nuevos job types en el switch del router (línea 562):

| Job Type | Handler | Qué hace |
|----------|---------|----------|
| `POST_BUILD_KG` | `handlePostBuildKG(job)` | Llama a `rag-architect` con `{ action: "execute-kg-subdomain", ragId, subdomain: payload.subdomain }`. Al terminar, comprueba si quedan otros `POST_BUILD_KG` PENDING/RETRY/RUNNING para ese `rag_id`. Si NO quedan → encola 1 job `POST_BUILD_TAXONOMY`. |
| `POST_BUILD_TAXONOMY` | `handlePostBuildTaxonomy(job)` | Llama a `rag-architect` con `{ action: "post-build", ragId, step: "taxonomy" }` (reutiliza `buildTaxonomy` existente). Al terminar → encola `POST_BUILD_CONTRA`. |
| `POST_BUILD_CONTRA` | `handlePostBuildContradictions(job)` | Llama a `rag-architect` con `{ action: "post-build", ragId, step: "contradictions" }`. Al terminar → encola `POST_BUILD_QG`. |
| `POST_BUILD_QG` | `handlePostBuildQG(job)` | Llama a `rag-architect` con `{ action: "post-build", ragId, step: "quality_gate" }`. |

**Lógica de dependencia del fan-out KG:**

```text
Cuando POST_BUILD_KG termina (mark_job_done):
  SELECT COUNT(*) FROM rag_jobs
  WHERE rag_id = ? AND job_type = 'POST_BUILD_KG'
    AND status IN ('PENDING', 'RETRY', 'RUNNING')
  
  Si count = 0 → INSERT INTO rag_jobs (POST_BUILD_TAXONOMY)
  Si count > 0 → no hacer nada (otro worker completará el último)
```

#### 4. `supabase/functions/rag-architect/index.ts` — Nueva action `execute-kg-subdomain`

Action de service-role que recibe `{ ragId, subdomain }` y ejecuta `buildKGForSubdomain` para ese único subdominio. Se registra en el router de actions de service-role (línea ~3390).

#### 5. `supabase/functions/rag-architect/index.ts` — Modificar `handlePostBuild` step `taxonomy`/`contradictions`

Estos steps ya **no** deben cascadear con `triggerPostBuild`. La cascada la controla el `rag-job-runner`. Simplemente ejecutan su lógica y retornan. El `rag-job-runner` handler es quien encola el siguiente paso.

#### 6. `supabase/functions/rag-architect/index.ts` — Fix del Quality Gate falso positivo

En `handlePostBuild` step `quality_gate` (línea 1686-1718):

- **Antes** de calcular el veredicto, contar KG nodes:
  ```text
  SELECT COUNT(*) FROM rag_knowledge_graph_nodes WHERE rag_id = ragId
  ```
- Si `kgNodeCount === 0`, forzar `qualityVerdict = "DEGRADED"` independientemente de coverage/chunks
- En `runQualityGate` (línea 2177): si no hay `validation_queries`, insertar un quality_check con verdict `SKIPPED` en vez de retornar silenciosamente

#### 7. `supabase/functions/rag-architect/index.ts` — Punto de entrada del fan-out

Modificar `handlePostBuild` case `knowledge_graph` (línea 1671-1673) para que en vez de:
```
await buildKnowledgeGraph(ragId, rag);
EdgeRuntime.waitUntil(triggerPostBuild(ragId, "taxonomy"));
```

Haga:
```
const subdomains = getActiveSubdomains(rag);
// Insert 1 POST_BUILD_KG job per subdomain
for (const sub of subdomains) {
  await supabase.from("rag_jobs").insert({
    rag_id: ragId,
    job_type: "POST_BUILD_KG",
    payload: { subdomain: sub.name_technical },
  });
}
// Kick job runner to start processing
EdgeRuntime.waitUntil(fetch(rag-job-runner, { rag_id, maxJobs: 20 }));
// Return immediately — cascade handled by job runner
```

### Flujo completo corregido

```text
rag-architect(post-build, step=knowledge_graph)
  │
  ├─ Encola N jobs POST_BUILD_KG (1 por subdominio)
  └─ Kick rag-job-runner
       │
       ├─ POST_BUILD_KG(sub1) → execute-kg-subdomain → DONE
       ├─ POST_BUILD_KG(sub2) → execute-kg-subdomain → DONE
       ├─ ...
       └─ POST_BUILD_KG(subN) → execute-kg-subdomain → DONE
            │
            └─ Último detecta count=0 pendientes
                 │
                 └─ Encola POST_BUILD_TAXONOMY
                      │
                      └─ DONE → Encola POST_BUILD_CONTRA
                           │
                           └─ DONE → Encola POST_BUILD_QG
                                │
                                └─ DONE (con check KG nodes > 0)
```

### Archivos a modificar

1. **`supabase/functions/rag-architect/index.ts`**:
   - Extraer `buildKGForSubdomain` del loop de `buildKnowledgeGraph`
   - Nueva action `execute-kg-subdomain` en el router
   - Modificar `handlePostBuild` case `knowledge_graph` → fan-out
   - Eliminar `triggerPostBuild` cascades de los otros steps
   - Fix quality gate: check KG nodes antes de veredicto

2. **`supabase/functions/rag-job-runner/index.ts`**:
   - 4 nuevos handlers: `POST_BUILD_KG`, `POST_BUILD_TAXONOMY`, `POST_BUILD_CONTRA`, `POST_BUILD_QG`
   - Lógica de dependencia: el último KG done → encola TAXONOMY
   - Cada handler encola el siguiente step al completar

3. **NO se toca `rag-recovery`** hasta que este fix esté desplegado y verificado.

### Detalle técnico: por qué cada subdominio cabe en el timeout

```text
1 subdominio en POST_BUILD_KG:
  - SELECT chunks (1 query, <1s)
  - chatWithTimeout Gemini (30s max)
  - Insert ~20 nodes: 20 × (dedup query + embedding + insert) ≈ 20 × 0.5s = 10s
  - Insert ~30 edges: 30 × insert ≈ 3s
  Total: ~45s máximo → dentro de 120s con margen
```

