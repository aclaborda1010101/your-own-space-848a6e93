

# Fix: Cobertura prematura y reanudacion de ingesta RAG

## Diagnostico

Analice los datos del RAG `bcb87cf0`:
- **91 research runs**, todas con status `completed`
- **133 chunks** reales, pero muchos runs generaron **0 chunks** (scraping fallido, contenido insuficiente)
- **Formula de cobertura erronea** (linea 1388): `newTotalChunks / (subdomains * levels * 5)` usa un multiplicador arbitrario de 5 chunks esperados por batch. Con 13 subdominios * 7 niveles * 5 = 455 esperados, pero solo 133 reales → 29%
- **Quality gate permisivo** (linea 1461): marca `PRODUCTION_READY` con solo 50+ chunks, ignorando el coverage_pct real
- **Sin mecanismo de reanudacion**: si la cadena de `EdgeRuntime.waitUntil(triggerBatch(...))` se rompe, no hay forma de continuar

## Cambios propuestos

### 1. `rag-architect/index.ts` — Corregir formula de cobertura

Linea 1385-1395: Reemplazar la formula basada en chunks estimados por una basada en **runs completados vs runs totales**:

```text
// Contar runs completados para este RAG
const { count: completedRuns } = await supabase
  .from("rag_research_runs")
  .select("*", { count: "exact", head: true })
  .eq("rag_id", ragId)
  .eq("status", "completed");

const coverage = Math.min(100, Math.round(((completedRuns || 0) / Math.max(1, totalBatches)) * 100));
```

Esto garantiza que coverage_pct refleje el progreso real del pipeline (91/91 = 100% en el caso actual).

### 2. `rag-architect/index.ts` — Quality gate con coverage real

Linea 1456-1466 en `handlePostBuild`: Ademas del conteo de chunks, verificar coverage real:

```text
const { count: totalRuns } = await supabase
  .from("rag_research_runs")
  .select("*", { count: "exact", head: true })
  .eq("rag_id", ragId);

const { count: completedRuns } = await supabase
  .from("rag_research_runs")
  .select("*", { count: "exact", head: true })
  .eq("rag_id", ragId)
  .eq("status", "completed");

const realCoverage = Math.round(((completedRuns || 0) / Math.max(1, totalRuns || 1)) * 100);

const qualityVerdict = realCoverage >= 90 && (chunkCount || 0) >= 50
  ? "PRODUCTION_READY"
  : realCoverage >= 70 && (chunkCount || 0) >= 20
  ? "GOOD_ENOUGH"
  : "INCOMPLETE";

await updateRag(ragId, { coverage_pct: realCoverage });
```

### 3. `rag-architect/index.ts` — Nueva action `resume-build`

Agregar al bloque service-role una action `resume-build` que:
1. Lee el RAG y sus research_runs existentes
2. Calcula que subdomain/level faltan por procesar
3. Encuentra el batchIndex correcto y dispara `triggerBatch` desde ahi

```text
case "resume-build":
  // Contar runs completados, calcular siguiente batch
  // Actualizar status a "building" y disparar triggerBatch(nextBatchIndex)
```

Tambien agregar al switch JWT una action `resume` invocable por el usuario que:
1. Valide que el RAG pertenece al usuario
2. Inserte un job `RESUME_BUILD` en rag_jobs (o llame directamente a resume-build via service role)

### 4. `rag-job-runner/index.ts` — Nuevo case `RESUME_BUILD`

```text
case "RESUME_BUILD":
  // Invocar rag-architect con action resume-build
  await handleResumeBuild(job);
  break;
```

### 5. `useRagArchitect.tsx` — Agregar funcion `resumeRag`

```text
const resumeRag = async (ragId: string) => {
  const data = await invoke("resume", { ragId });
  // Iniciar polling
  ...
};
```

### 6. `RagBuildProgress.tsx` — Boton "Reanudar Ingesta"

Agregar boton visible cuando:
- `rag.status` es `completed` con `coverage_pct < 90`
- `rag.status` es `failed` o `building` (stuck)
- `rag.quality_verdict` es `INCOMPLETE`

```text
{(rag.status === "failed" || rag.quality_verdict === "INCOMPLETE" ||
  (rag.status === "completed" && rag.coverage_pct < 90)) && (
  <Button onClick={handleResume}>
    <RefreshCw /> Reanudar Ingesta
  </Button>
)}
```

### 7. `RagBuildProgress.tsx` — Barra de progreso corregida

Linea 102: Mostrar 100% solo cuando coverage real sea 100%:

```text
<Progress value={isCompleted ? 100 : (rag.coverage_pct || 0)} className="h-2 mb-3" />
```

Si el RAG esta completado pero con cobertura parcial, mostrar la cobertura real junto con una nota informativa.

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/rag-architect/index.ts` | (1) Corregir formula coverage en handleBuildBatch. (2) Quality gate con coverage real. (3) Nuevas actions resume-build (service-role) y resume (JWT). |
| `supabase/functions/rag-job-runner/index.ts` | Agregar case RESUME_BUILD. |
| `src/hooks/useRagArchitect.tsx` | Agregar funcion resumeRag. |
| `src/components/rag/RagBuildProgress.tsx` | (1) Boton "Reanudar Ingesta". (2) Barra de progreso corregida. |

## Flujo de reanudacion

```text
Usuario pulsa "Reanudar Ingesta"
  -> useRagArchitect.resumeRag(ragId)
  -> rag-architect action "resume" (JWT)
  -> Inserta job RESUME_BUILD en rag_jobs
  -> Fire-and-forget al rag-job-runner

rag-job-runner picks RESUME_BUILD
  -> Invoca rag-architect action "resume-build" (service-role)
  -> Calcula batches pendientes
  -> Dispara triggerBatch(nextBatchIndex)
  -> Pipeline continua normalmente desde donde se quedo
```

