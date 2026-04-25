# Plan — Chunked Extraction (Map-Reduce) para Step 2

## Diagnóstico de la situación actual

El flujo actual en `supabase/functions/project-wizard-step/index.ts` (acción `extract`) hace:

1. Carga `inputContent` raw.
2. **Sampler agresivo** (`prepareLongInputForExtract`) — si > 90k chars, recorta a ~42k preservando cabeza, cola y ventanas ±800 chars alrededor de keywords. **Lossy: pierde el medio del documento si las keywords se concentran en pocas zonas** (es lo que pasó en AFFLUX: 34 ventanas, todas gastadas en "muerte" + "llamada").
3. F0 (signal preservation) + filtro de transcripción en paralelo, ambos sobre el contenido **ya sampleado**.
4. **1 sola llamada LLM (F1/F2)** que devuelve el briefing completo en un único JSON.

Además detecté un bug en línea 131: si ya existe un Step 2 válido, devuelve la versión vieja **sin re-extraer**, lo que explica por qué a veces "no se regeneraba". Hay que añadir un bypass.

## Objetivo

Procesar el input completo (los 189k chars de AFFLUX) sin perder señal del medio y sin riesgo de 504, vía **map-reduce**: dividir en chunks → extraer señales por chunk en paralelo → fusionar en un briefing global → continuar pipeline normal.

---

## Arquitectura propuesta

### Nuevo modo: `chunkedExtraction`

Cuando `inputContent.length > 90_000` (o cuando el cliente pasa `chunkedExtraction: true`):

```
inputContent (raw, sin samplear)
   │
   ▼
splitIntoChunks() → [chunk_001, chunk_002, ..., chunk_N]
   │
   ▼  (concurrencia = 3, retry por chunk)
extractSignalsFromChunk(chunk) → MiniBrief por chunk (sin componentes, sin IDs COMP-XXX)
   │
   ▼
mergeChunkBriefs(miniBriefs) → BusinessExtractionBriefV2 global + campos legacy
   │
   ▼
post-parse hardening (igual que ahora: ensureLegacyBriefShape, F0 attach, validation)
   │
   ▼
guardar como Step 2 v(N+1)
```

El sampler **se queda como fallback** para cuando `chunkedExtraction === false` explícito o cuando el input es < 90k.

---

## Archivos a crear

### 1. `supabase/functions/project-wizard-step/chunked-extractor.ts` (NUEVO)

Núcleo del map-reduce. Contiene:

#### a) `splitInputIntoChunks(raw: string, opts?: SplitOpts): Chunk[]`

```ts
interface SplitOpts {
  targetSize?: number;   // default 35_000 chars
  overlap?: number;      // default 1_800 chars
  maxChunks?: number;    // default 8 (cap de seguridad)
}

interface Chunk {
  chunk_id: string;       // "CHUNK-001", "CHUNK-002", ...
  char_start: number;
  char_end: number;
  text: string;
  overlap_before: number;
  overlap_after: number;
}
```

Reglas:
- Tamaño objetivo: 35k chars por chunk (queda margen para prompt + output dentro de 150s).
- Overlap: 1.800 chars para no cortar ideas a mitad.
- **Corte por límites naturales preferido** (en orden):
  1. Marcadores de documento adjunto: `--- nombre.pdf ---` (extractor de Step 1 los añade).
  2. Speaker changes: `Speaker N`, `[hh:mm]`.
  3. Saltos de párrafo dobles (`\n\n`).
  4. Caída a corte por carácter si nada coincide en ±2k chars del objetivo.
- Cap de seguridad: max 8 chunks. Si el input es > 280k chars, se trunca el resto y se añade un warning.
- 189k chars de AFFLUX → ~5-6 chunks.

#### b) `extractSignalsFromChunk(chunk, ctx): Promise<ChunkBrief>`

Llamada LLM a `callGeminiFlash` (Gemini 3 Flash) con prompt **acotado a extracción de señales**, sin componentes ni PRD.

Prompt resumido:
```
Eres analista senior. Estás analizando UN BLOQUE PARCIAL ({chunk_id}, chars {start}-{end}) 
de una transcripción/material más largo del proyecto "{projectName}" de "{companyName}".

REGLAS:
- Extrae SOLO señales presentes en ESTE bloque. No inventes, no especules sobre otros bloques.
- NO generes ComponentRegistryItem ni IDs COMP-XXX.
- NO generes PRD ni propuesta.
- Conserva citas literales relevantes.
- Devuelve JSON ESTRICTO con esta estructura...

{
  "chunk_id": "...",
  "observed_facts": [...],
  "business_catalysts": [...],
  "underutilized_data_assets": [...],
  "quantified_economic_pains": [...],
  "decision_points": [...],
  "stakeholder_signals": [...],
  "client_requested_items": [...],
  "inferred_needs": [...],
  "ai_native_opportunity_signals": [...],
  "external_data_sources_mentioned": [...],
  "founder_commitment_signals": [...],
  "initial_compliance_flags": [...],
  "constraints_and_risks": [...],
  "open_questions": [...],
  "source_quotes": [...]
}

CONTENIDO DEL BLOQUE:
{chunk.text}
```

- `maxTokens: 8192` por chunk (suficiente para mini-brief, generación rápida ~30s).
- `maxRetries: 1`.
- Cada item devuelto se etiqueta server-side con `_source_chunks: [chunk_id]` antes de devolverlo.

#### c) `mergeChunkBriefs(briefs: ChunkBrief[], ctx): BusinessExtractionBriefV2`

Fusión **determinista primero, LLM solo si hace falta**:

1. **Deduplicación por similitud**:
   - Para listas con `description` (observed_facts, inferred_needs, etc.): hash normalizado de las primeras ~80 chars en lowercase + dedupe.
   - Si dos items quedan deduplicados, fusionar `_source_chunks` y subir `_evidence_count`.
2. **Citas literales**: dedupe por hash exacto.
3. **Conteo de evidencia**: items que aparecen en ≥2 chunks suben prioridad (`certainty: high`).
4. **Generación del business_extraction_v2 final**:
   - Bloques que requieren narrativa global (project_summary, client_naming_check) se generan con **una segunda llamada LLM ligera** que recibe SOLO los topes de cada lista (resumen estructurado) — NO los chunks crudos. Output objetivo: ~3k tokens.
5. **Campos legacy** (project_summary, observed_facts, inferred_needs, solution_candidates, constraints_and_risks, open_questions, architecture_signals, deep_patterns, extraction_warnings) — se construyen mappeando desde el v2 igual que hace `ensureLegacyBriefShape` ahora.
6. **Metadata**:
   ```ts
   briefing._chunked_extraction_meta = {
     enabled: true,
     original_chars,
     chunks_count,
     chunks_succeeded: [...],
     failed_chunks: [...],
     chunk_size_target: 35_000,
     overlap_chars: 1_800,
     extraction_strategy: "chunked_map_reduce",
     merge_llm_called: true | false,
   }
   ```

#### d) Concurrencia + retry

```ts
async function runChunkedExtraction(chunks, ctx) {
  const concurrency = 3;
  const results: (ChunkBrief | { failed: true; chunk_id: string; error: string })[] = [];
  // Ejecutar en lotes de 3
  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(async (c) => {
      try {
        return await extractSignalsFromChunk(c, ctx);
      } catch (e) {
        // Reintento único
        try { return await extractSignalsFromChunk(c, ctx); }
        catch (e2) { return { failed: true, chunk_id: c.chunk_id, error: String(e2) }; }
      }
    }));
    results.push(...batchResults);
  }
  return results;
}
```

- Si falla > 30% de chunks → abortar y devolver error explícito (no hacemos un brief con la mitad faltante).
- Si fallan 1-2 chunks → continuar, registrar en `failed_chunks`, añadir `extraction_warnings` con el detalle.

---

### 2. `supabase/functions/project-wizard-step/chunked-extractor_test.ts` (NUEVO)

Tests Deno mínimos:
- `splitInputIntoChunks` con input < 90k devuelve 1 chunk.
- `splitInputIntoChunks` con 200k chars devuelve N chunks con overlap correcto.
- `splitInputIntoChunks` corta por `--- archivo.pdf ---` cuando está cerca del objetivo.
- `mergeChunkBriefs` deduplica items idénticos y suma `_source_chunks`.
- `mergeChunkBriefs` con 0 chunks válidos lanza error.

---

## Archivos a modificar

### 3. `supabase/functions/project-wizard-step/index.ts` (acción `extract`)

#### Cambio 1: Bypass del cache cuando se fuerza re-extracción
Línea 120 — añadir `forceRefresh` y `chunkedExtraction` al destructuring:
```ts
const {
  projectName, companyName, projectType, clientNeed,
  inputContent, inputType,
  skipSampler,         // ya existe
  forceRefresh,        // NUEVO
  chunkedExtraction,   // NUEVO
} = stepData;
```

Línea 131 — solo reusar si NO se pidió refresh:
```ts
if (latestStep2 && isValidStep2Briefing(latestStep2.output_data) 
    && !forceRefresh && !chunkedExtraction && !skipSampler) {
  // ... return reused
}
```

#### Cambio 2: Branching del modo de extracción

Reemplazar el bloque actual del sampler + F0 + filter + 1 llamada LLM (líneas ~159-650) por:

```ts
const useChunked = chunkedExtraction === true 
  || (skipSampler !== true && (inputContent || "").length > 90_000);

let briefing: any;
let extractionMode: "single" | "sampled" | "chunked" = "single";
let chunkedMeta: any = null;
let totalTokensInput = 0, totalTokensOutput = 0;

if (useChunked) {
  // ── Modo chunked map-reduce ──
  extractionMode = "chunked";
  const { runChunkedExtraction, splitInputIntoChunks, mergeChunkBriefs } 
    = await import("./chunked-extractor.ts");
  
  const chunks = splitInputIntoChunks(inputContent || "");
  console.log(`[wizard][chunked] split ${inputContent.length} chars into ${chunks.length} chunks`);
  
  // F0 sigue corriendo en paralelo, pero sobre HEAD del input (primeros 40k) — F0 ya tiene su propio cap
  const f0Promise = runF0SignalPreservation(
    (inputContent || "").slice(0, 40_000),
    { projectName, companyName, projectType },
    { maxRetries: 0 },
  ).catch(...);
  
  const chunkResults = await runChunkedExtraction(chunks, { projectName, companyName, projectType, clientNeed });
  const failedChunks = chunkResults.filter(r => "failed" in r);
  const okChunks = chunkResults.filter(r => !("failed" in r));
  
  if (failedChunks.length / chunks.length > 0.3) {
    return new Response(JSON.stringify({
      error: `Chunked extraction failed: ${failedChunks.length}/${chunks.length} chunks failed`,
      failed_chunks: failedChunks,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  
  const mergeResult = await mergeChunkBriefs(okChunks, { projectName, companyName });
  briefing = mergeResult.briefing;
  totalTokensInput = chunkResults.reduce((a, r) => a + ((r as any).tokensInput || 0), 0) + mergeResult.mergeTokensInput;
  totalTokensOutput = chunkResults.reduce((a, r) => a + ((r as any).tokensOutput || 0), 0) + mergeResult.mergeTokensOutput;
  
  chunkedMeta = {
    enabled: true,
    original_chars: (inputContent || "").length,
    chunks_count: chunks.length,
    chunks_succeeded: okChunks.map((c: any) => c.chunk_id),
    failed_chunks: failedChunks.map((c: any) => ({ chunk_id: c.chunk_id, error: c.error })),
    chunk_size_target: 35_000,
    overlap_chars: 1_800,
    extraction_strategy: "chunked_map_reduce",
    merge_llm_called: mergeResult.mergeLlmCalled,
  };
  
  const f0Result = await f0Promise;
  briefing._f0_signals = f0Result;
  briefing._chunked_extraction_meta = chunkedMeta;
  
  // Añadir warning informativo
  appendExtractionWarning(briefing, {
    type: "chunked_extraction_used",
    message: `Material largo (${inputContent.length.toLocaleString("es-ES")} chars) procesado en ${chunks.length} bloques con extracción completa. ${failedChunks.length} bloques fallaron.`,
    chunks_count: chunks.length,
    failed_chunks_count: failedChunks.length,
  });
  
} else {
  // ── Modo actual (single LLM call con sampler) — SIN CAMBIOS ──
  // ... todo el bloque actual del sampler + F0 + filter + 1 llamada LLM
  extractionMode = prepared.wasSampled ? "sampled" : "single";
}

// post-parse hardening (común a los dos modos)
briefing = ensureLegacyBriefShape(briefing);
// ... resto igual
```

#### Cambio 3: Persistir `extraction_mode` en el step
Línea 758 — añadir en `output_data` o en metadata:
```ts
briefing._extraction_mode = extractionMode;
```

---

### 4. `src/hooks/useProjectWizard.ts`

Añadir parámetros opcionales a `runExtraction`:
```ts
const runExtraction = async (
  overrideInput?: string,
  opts?: { skipSampler?: boolean; forceRefresh?: boolean; chunkedExtraction?: boolean },
) => {
  // ...
  const stepData = {
    projectName, companyName, projectType, clientNeed,
    inputContent,
    inputType: project.inputType,
    skipSampler: opts?.skipSampler === true,
    forceRefresh: opts?.forceRefresh === true,
    chunkedExtraction: opts?.chunkedExtraction === true,
  };
  // ...
};
```

Aumentar el polling timeout del frontend de 600s a **900s** (15min) — porque chunked con 6 chunks × ~30s + merge ~30s + overhead = ~3-4 min en el peor caso, pero queremos margen.

---

### 5. `src/components/projects/wizard/ProjectWizardStep2.tsx` (donde se renderizan las alertas)

Buscar el componente que pinta `extraction_warnings` y añadir:

- Si la alerta es `long_input_sampled` → mostrar **2 botones**:
  1. "Re-extraer con extracción completa por bloques" → `runExtraction(undefined, { chunkedExtraction: true, forceRefresh: true })` ← **opción recomendada**.
  2. "Forzar contenido completo (1 sola llamada — riesgo de timeout)" → `runExtraction(undefined, { skipSampler: true, forceRefresh: true })` ← opción avanzada.

- Si la alerta es `chunked_extraction_used` → mostrar tarjeta informativa con:
  - Chunks procesados / fallados
  - Tamaño original vs estrategia
  - Si hay fallos: botón "Reintentar bloques fallidos" (futuro, no en este sprint).

---

## Cómo se mantiene compatibilidad con el resto del pipeline

**Nada del pipeline F2 → F8 cambia.**

- `business_extraction_v2` se construye con la misma estructura.
- `solution_candidates` siguen en estado `inferred`/`hypothesis` (nunca `confirmed` desde la brief layer).
- Campos legacy (`project_summary`, `observed_facts`, etc.) se mapean igual.
- F2 (build_registry) lee `business_extraction_v2` y opera sin saber si vino de chunked o single.

El único campo nuevo es `_chunked_extraction_meta` que es metadata informativa, ignorada por F2-F8.

---

## Cómo se evita el timeout

Cálculo para AFFLUX (189k chars):
- 6 chunks de ~35k chars.
- Concurrencia 3 → 2 lotes de 3.
- Cada chunk: ~30s (input pequeño, output ~5k tokens).
- Lote 1: 30s. Lote 2: 30s. Total chunks: ~60s.
- Merge LLM (sobre estructuras resumidas, no chunks crudos): ~25s.
- F0 paralelo: ya cubierto.
- **Total wall time: ~90-100s** ← cómodo dentro de 150s.

Si AFFLUX creciera a 280k chars (8 chunks):
- 3 lotes de 3 + 1 lote suelto = 4 lotes × 30s = 120s + merge 25s = **145s** ← justo en el límite.
- Cap de seguridad: 8 chunks máx. Si > 280k chars, truncar y warning.

---

## Validación AFFLUX (criterios de aceptación)

Re-ejecutar `extract` con `chunkedExtraction: true` sobre AFFLUX (`6ef807d1-9c3b-4a9d-b88a-71530c3d7aaf`).

El nuevo Step 2 v2 debe contener obligatoriamente, marcado con su `_source_chunks`:
- ✅ Fallecimientos / herencias
- ✅ 3.000 llamadas grabadas (centralita / Whisper)
- ✅ 71 visitas en 9 meses sin cierre
- ✅ Catalogación de propietarios en 7 roles
- ✅ Compradores institucionales tipo Benatar
- ✅ Matching activo-inversor / "vender antes de comprar"
- ✅ Revista emocional por rol
- ✅ Soul de Alejandro / riesgo de seguimiento
- ✅ HubSpot / Gmail / Drive
- ✅ BrainsRE
- ✅ BORME / CNAE / licencias / BOE / ayuntamiento (si aparecen)
- ✅ Compliance flags: personal_data_processing, profiling, commercial_prioritization, external_data_enrichment

Si falta alguna señal que sí está en la transcripción, el log debe permitir identificar **en qué chunk falló** vía el campo `_source_chunks` y la trazabilidad `chunk_id → char_start/end`.

---

## Lo que NO se toca

- `input-sampler.ts` (sigue como fallback para inputs medianos o cuando se desactiva chunked).
- F0 / F1 prompts internos (`f0-signal-preservation.ts`, `f1-legacy-shape.ts`).
- F2 / F3 / F4 / F5 / F6 / F7 / F8 (toda la cadena de generación posterior).
- Schema de DB (no se necesitan tablas nuevas; `_chunked_extraction_meta` va dentro de `output_data` JSON).
- PRD / presupuesto / propuesta cliente.
- UI fuera de la alerta de Step 2.

---

## Riesgos y mitigación

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Merge LLM produce JSON inválido | Media | Reuse del parser robusto + truncation repair que ya existe (líneas 600-651). |
| Concurrencia 3 dispara rate limits del Gemini Gateway | Baja | Backoff exponencial ya incluido en `callGeminiFlash`. Si pasa, bajar a concurrencia 2. |
| Fallo silencioso de un chunk con info crítica | Media | `failed_chunks` se loguea y se muestra en UI. Botón futuro de reintento por chunk. |
| Coste se duplica (6 llamadas + 1 merge vs 1 llamada) | Cierta | Real: ~6× input tokens + 1× output. Estimado AFFLUX: ~$0.20 vs $0.05 actual. Aceptable para análisis serio. |
| Frontend timeout 600s insuficiente | Baja | Subir a 900s en `useProjectWizard.ts`. |

---

## Rollback

Si algo se rompe:
1. Revertir `index.ts` al branching anterior (un solo modo single+sampler).
2. Borrar `chunked-extractor.ts` y su test.
3. Revertir `useProjectWizard.ts` (parámetros opcionales son backward-compatible, no hace falta tocar nada en el frontend si solo quitamos el botón).
4. La UI seguiría funcionando con el modo single+sampler como hasta ahora.

Cambios localizados, sin migraciones de DB, sin cambios en F2-F8.

---

## Tests

1. **Unit (Deno)**:
   - `chunked-extractor_test.ts`: split, merge, dedup.
2. **End-to-end manual**:
   - Re-extraer AFFLUX con `chunkedExtraction: true` y verificar señales del checklist arriba.
   - Verificar logs: `[wizard][chunked] split 189988 chars into 6 chunks`, `chunks_succeeded: 6`, `failed_chunks: 0`.
   - Verificar en UI que aparece la nueva alerta `chunked_extraction_used` con cifras reales.
3. **Regresión**:
   - Crear proyecto con input < 90k chars → debe usar modo single (sin chunked, sin sampler) y funcionar igual que antes.
   - Crear proyecto con input ~120k chars y `skipSampler: true` (botón "forzar 1 sola llamada") → debe seguir funcionando como override.

---

## Criterios de aceptación

1. ✅ Re-extraer AFFLUX sin sampler ni truncado (todos los 189k chars analizados).
2. ✅ Briefing resultante contiene las 12 señales del checklist con `_source_chunks`.
3. ✅ Wall time < 150s (probablemente ~90-100s).
4. ✅ Si un chunk falla, los demás siguen y se reporta el fallo.
5. ✅ El usuario tiene 2 botones en la alerta: "extracción por bloques" (recomendado) y "1 sola llamada" (avanzado).
6. ✅ No se rompe ningún proyecto con input < 90k chars (regresión).
7. ✅ El pipeline F2 → F8 no necesita cambios.
