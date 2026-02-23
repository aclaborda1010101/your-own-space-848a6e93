

# Refactorizar analyzeDomain: De Sincrono a Job Queue

## Problema

La funcion `analyzeDomain` ejecuta una llamada LLM con `chatWithTimeout` de 50s dentro de `EdgeRuntime.waitUntil()`. Si el LLM tarda mas, falla con timeout. Aunque hay un AbortController de 380s, el timeout real del `chatWithTimeout` es 50s (linea 934).

## Solucion

Reemplazar la ejecucion directa por un job `DOMAIN_ANALYSIS` en la tabla `rag_jobs`, procesado por el `rag-job-runner` existente sin restricciones de timeout.

---

## Cambios

### 1. Edge Function `rag-architect/index.ts`

**handleCreate** (lineas 822-846): Eliminar `EdgeRuntime.waitUntil(analyzeDomain(...))`. En su lugar, insertar un job en `rag_jobs`:

```text
INSERT INTO rag_jobs (rag_id, job_type, payload)
VALUES (rag.id, 'DOMAIN_ANALYSIS', {
  domain_description: domainDescription,
  moral_mode: moralMode
})
```

La funcion `analyzeDomain` se mantiene intacta pero ya no se invoca desde `handleCreate`. Se exporta como funcion reutilizable para el job runner.

Ademas, agregar un nuevo action handler `domain-analysis` (para uso interno del job runner) que reciba `{ ragId }` y ejecute `analyzeDomain` con los datos del payload del job.

### 2. Edge Function `rag-job-runner/index.ts`

Agregar un nuevo case `DOMAIN_ANALYSIS` en el switch de `runOneJob`:

```text
case "DOMAIN_ANALYSIS":
  await handleDomainAnalysis(job);
  break;
```

La funcion `handleDomainAnalysis(job)` hara:
1. Leer `job.payload` para obtener `domain_description` y `moral_mode`
2. Invocar `supabase.functions.invoke("rag-architect", { body: { action: "domain-analysis-execute", ragId: job.rag_id } })` -- o bien ejecutar la logica LLM directamente importando el AI client compartido.

**Opcion elegida**: Invocar `rag-architect` con una action interna `execute-domain-analysis`. Esto reutiliza toda la logica existente de `analyzeDomain` (prompt, parsing, persistencia) sin duplicar codigo. El job runner solo actua como dispatcher.

### 3. Nueva action en `rag-architect`: `execute-domain-analysis`

Agregar al router principal un case para `execute-domain-analysis` que:
- Valide que viene del service role (ya cubierto por el job runner)
- Lea el rag_project para obtener `domain_description` y `moral_mode`
- Ejecute `analyzeDomain(ragId, domain, moralMode)` directamente (sin `EdgeRuntime.waitUntil`, ya que el job runner maneja el ciclo de vida)
- Aumente el timeout de `chatWithTimeout` de 50s a 120s ya que el job runner no tiene la misma restriccion

### 4. Hook `useRagArchitect.tsx`

El polling ya existe (cada 5s cuando el status no es terminal). No requiere cambios funcionales. El flujo es:
1. `createRag` -> devuelve `ragId` con status `domain_analysis`
2. Polling via `refreshStatus` cada 5s
3. Cuando el job runner completa, `analyzeDomain` actualiza status a `waiting_confirmation`
4. El polling detecta el cambio y la UI se actualiza automaticamente

Sin embargo, el polling actual usa `refreshStatus` que llama a la action `status` del edge function. Esto ya funciona correctamente.

### 5. UI: Sin cambios requeridos

La UI ya maneja el estado `domain_analysis` con un indicador de carga. El polling existente detectara la transicion a `waiting_confirmation` sin cambios.

---

## Resumen tecnico de cambios por archivo

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/rag-architect/index.ts` | (1) `handleCreate`: reemplazar `EdgeRuntime.waitUntil(analyzeDomain)` por INSERT en `rag_jobs` con type `DOMAIN_ANALYSIS`. (2) Agregar action `execute-domain-analysis` al router. (3) Subir timeout de `chatWithTimeout` en `analyzeDomain` de 50s a 120s. |
| `supabase/functions/rag-job-runner/index.ts` | Agregar case `DOMAIN_ANALYSIS` que invoca `rag-architect` con action `execute-domain-analysis`. |

## Flujo resultante

```text
Usuario crea RAG
  -> handleCreate inserta rag_projects (status: domain_analysis)
  -> handleCreate inserta rag_jobs (type: DOMAIN_ANALYSIS)
  -> Responde inmediatamente al cliente

Job Runner (invocado externamente o por cron)
  -> pick_next_job selecciona DOMAIN_ANALYSIS
  -> Invoca rag-architect con action execute-domain-analysis
  -> analyzeDomain ejecuta LLM sin restriccion de timeout
  -> Actualiza rag_projects a waiting_confirmation

UI (polling cada 5s)
  -> Detecta cambio de status
  -> Muestra RagDomainReview
```

## Consideracion: Trigger del Job Runner

El `rag-job-runner` necesita ser invocado para procesar el job. Actualmente se invoca manualmente o por cron. Para que el domain analysis se procese automaticamente, `handleCreate` tambien debe disparar el job runner despues de insertar el job:

```text
// Fire-and-forget: trigger job runner
fetch(`${SUPABASE_URL}/functions/v1/rag-job-runner`, {
  method: "POST",
  headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ maxJobs: 1 })
}).catch(() => {});
```

Esto garantiza procesamiento inmediato sin depender de un cron externo.

