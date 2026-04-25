# Plan: Brief AFFLUX v4 — retry parcial + normalización + brief limpio

Tu diagnóstico es correcto. El brief v3 es bueno como **extracción cruda completa** (8/10) pero malo como **briefing presentable** (4/10). En vez de re-extraer todo, vamos a añadir tres capas que faltan y que son baratas de ejecutar (no requieren tirar el v3):

1. **Retry quirúrgico** del único chunk fallido.
2. **Normalizador post-merge** (idioma, sector, dedup, naming, compliance).
3. **Brief Limpio resumido** generado a partir del brief crudo, separado del raw para debug.

No tocamos F2/F3/F5/PRD/propuesta. No tiramos el Step 2 actual.

---

## Lo que NO vamos a hacer
- ❌ Re-extraer todo (la extracción ya está hecha y costó tokens).
- ❌ Cambiar el flujo de F0/F1/F2.
- ❌ Tocar el sampler legacy ni la UI principal del wizard.
- ❌ Borrar el Step 2 actual: el v3 se conserva como `previous_version` para auditoría.

---

## Cambios — archivos

### A) `supabase/functions/project-wizard-step/chunked-extractor.ts` (modificar)

Añadir función pública:

```ts
export async function retryFailedChunks(
  failedChunkIds: string[],
  rawInput: string,
  ctx: ChunkExtractionContext,
): Promise<{ recovered: ChunkBriefPartial[]; stillFailed: ChunkFailure[] }>
```

- Reconstruye SOLO los chunks listados (mismo `splitInputIntoChunks` para que `char_start/char_end` sean idénticos a los del run original).
- Filtra a los IDs solicitados.
- Ejecuta `extractSignalsFromChunk` con 2 reintentos secuenciales (en lugar de 1) y `maxTokens: 12_288` (más holgura para chunks que reventaron por longitud).
- Devuelve recuperados + los que siguen fallando.

### B) `supabase/functions/project-wizard-step/brief-normalizer.ts` (nuevo, ~250 líneas)

Módulo determinista + 1 sola llamada LLM ligera. Exporta:

```ts
export interface NormalizationContext {
  projectName: string;        // "AFFLUX"
  companyName: string;        // "AFLU" (o lo que el usuario haya puesto)
  founderName?: string;       // "Alejandro Gordo"
  sectorHint?: string;        // "real_estate_off_market"
  language: "es" | "en";      // default "es"
}

export interface NormalizationResult {
  briefing: any;              // briefing normalizado (mismo shape v2.0.0)
  changes: NormalizationChange[];
}

export async function normalizeBrief(
  briefing: any,
  ctx: NormalizationContext,
): Promise<NormalizationResult>
```

Pasos internos (en orden):

1. **Naming split** — `business_extraction_v2.client_naming_check`:
   - Si `client_company_name` parece nombre de persona (heurística: ≤3 palabras, mayúsculas iniciales, sin "S.L.", "S.A.", "Ltd"), moverlo a `founder_or_decision_maker` y rellenar `client_company_name = ctx.companyName`.
   - `proposed_product_name = ctx.projectName` si está vacío.
   - Re-ejecutar `checkNamingCollision(...)`.
   - Registrar cambio con `before/after`.

2. **Sector cleanup** — sustituir tokens contaminantes en TODOS los strings recursivamente:
   - `retail` → `real estate off-market`
   - `comercio minorista` → `inversión inmobiliaria`
   - `retail data` → `real estate data`
   - Solo cuando aparece como token aislado (`\b...\b`), no en URLs ni IDs. Diff loggeado.

3. **Language normalization** (la única llamada LLM, 1 sola, Gemini Flash, ~3k tokens output):
   - Recolectar todos los `title`, `description`, `signal`, `flag`, `question` que detecten >40% palabras inglesas (heurística por wordlist `en-stopwords` y palabras técnicas).
   - Mandar lote único en JSON al LLM con prompt: *"Traduce SOLO los strings marcados a español neutro técnico. Conserva nombres propios, herramientas (HubSpot, Drive, BORME), y términos como 'RAG'. Devuelve JSON con la misma estructura."*
   - Aplicar traducciones in-place. Si LLM falla → no bloqueante, solo warning.

4. **Semantic dedup de candidatos** (determinista + similitud léxica):
   - Sobre `ai_native_opportunity_signals` y `client_requested_items` + `inferred_needs`:
   - Agrupar por `dedupKey` extendido: añadir tokens raíz (stem ES básico: quitar plural, sufijos `-ción`, `-ado`, `-ar`).
   - Si dos items comparten ≥60% tokens raíz, fusionar título al más descriptivo y unir `_source_chunks`, `evidence_snippets`.
   - Mapeo manual hardcodeado para casos típicos:
     - `copywriting`, `magazine generation`, `marketing content`, `revista emocional` → **"Generador de revista emocional y contenido por rol"**
     - `call analysis`, `negotiation guidance`, `coaching`, `assistant for agents` → **"Asistente pre/post llamada y coaching comercial"**
     - `unified AI platform`, `custom knowledge base` → **"RAG de conocimiento AFFLUX"**

5. **Compliance flags expansion** — añadir flags faltantes con evidencia derivada:
   - Si `external_data_sources_mentioned` contiene BORME / esquelas / Registro Civil → añadir `external_data_enrichment` y `scraping_public_sources`.
   - Si `ai_native_opportunity_signals` contiene "matching" / "priorización" / "scoring" → añadir `commercial_prioritization` y `gdpr_article_22_risk`.
   - Si `personal_data_processing` ya está → añadir `legal_basis_required`, `data_retention_required`, `human_in_the_loop_required`.
   - Cada flag añadido lleva `_inferred_by: "normalizer_v1"` y la evidencia que lo activó.

6. **Quote validator** — para señales numéricas críticas (regex `\b\d{1,3}\s*(visitas|llamadas|propietarios|meses|%)\b`):
   - Buscar en `source_quotes` que la cifra existe textualmente.
   - Si no está → marcar el item con `_unverified_number: true` (NO borrar, solo señalar).
   - Esto resuelve tu punto 7 ("71 visitas vs 71%"): el normalizador no decide, pero etiqueta para revisión manual.

Cada paso devuelve un `NormalizationChange { type, field, before, after, reason }` que se acumula en `briefing._normalization_log`.

### C) `supabase/functions/project-wizard-step/clean-brief-builder.ts` (nuevo, ~150 líneas)

Genera el "Brief Limpio" de 3-5 páginas a partir del briefing normalizado. **Determinista, sin LLM**. Exporta:

```ts
export function buildCleanBrief(briefing: any, ctx: { projectName: string }): {
  markdown: string;       // brief limpio en markdown listo para mostrar/descargar
  sections: CleanSection[]; // mismas secciones para render UI
}
```

Estructura fija (las 9 secciones que listaste):
1. Resumen del negocio (de `business_model_summary`)
2. Datos y activos existentes (de `underutilized_data_assets`)
3. Problemas detectados (de `quantified_economic_pains`)
4. Catalizadores de negocio (de `business_catalysts`)
5. Necesidades explícitas (de `client_requested_items`)
6. Oportunidades IA detectadas (de `ai_native_opportunity_signals`, ya deduplicado)
7. Riesgos y compliance (de `constraints_and_risks` + `initial_compliance_flags`)
8. Preguntas abiertas (de `open_questions`)
9. Componentes candidatos normalizados (lista corta de los 10-12 fusionados)

Cada item: 1-2 líneas. Sin `_source_chunks`, sin `_evidence_count`, sin JSON crudo. Solo lo presentable.

### D) `supabase/functions/project-wizard-step/index.ts` (modificar)

Dos acciones nuevas:

**1) `action: "retry_failed_chunks"`** — repara el Step 2 sin re-extraer todo:
- Lee `latestStep2.output_data._chunked_extraction_meta.failed_chunks`.
- Llama `retryFailedChunks(...)` con el `inputContent` original (lo recuperamos de `input_data` o, si está truncado a 500 chars, lo pedimos al frontend).
- Re-ejecuta `mergeChunkBriefs` con `[okChunks ya guardados] + recovered`.
- Llama `normalizeBrief(...)` automáticamente al final.
- Llama `buildCleanBrief(...)` y guarda `briefing._clean_brief_md`.
- Bumpea version, guarda v4.

**2) `action: "normalize_brief"`** — solo normaliza + brief limpio (sin retry, útil cuando no hay chunks fallidos):
- Carga brief actual.
- Aplica `normalizeBrief(...)`.
- Aplica `buildCleanBrief(...)`.
- Bumpea version.

Ambas guardan `previous_version_snapshot: <briefing v3>` en `input_data` para rollback si el normalizer hace algo raro.

**Importante**: el `inputContent` original ahora se trunca a 500 chars en `input_data`. Para el retry necesitamos el original. Dos opciones:
- (a) Aumentar a 250k chars en `input_data` (más seguro, ~250KB por proyecto).
- (b) Pedirle al frontend que reenvíe `inputContent` en el payload del retry (más limpio).

Recomiendo **(b)**: el frontend ya tiene el inputContent en Step 1, lo reenvía en `retry_failed_chunks`.

### E) `src/hooks/useProjectWizard.ts` (modificar)

Añadir dos métodos al hook:

```ts
retryFailedChunks: (inputContent: string) => Promise<void>
normalizeBrief: () => Promise<void>
```

Ambos invocan la edge function con la action correspondiente y refrescan el briefing.

### F) `src/components/projects/wizard/ProjectWizardStep2.tsx` (modificar)

En la sección "Alertas de Integridad" (línea 629-700):

- Si `briefing._chunked_extraction_meta?.failed_chunks?.length > 0`:
  - Mostrar alerta **amarilla** (no bloqueante): *"X bloque(s) fallaron en la extracción inicial"*.
  - Botón: **"🔁 Reintentar bloques fallidos"** → llama `retryFailedChunks(originalInputContent)`.

- Botón nuevo siempre visible cuando es chunked: **"✨ Limpiar y normalizar brief"** → llama `normalizeBrief()`.
  - Tooltip: *"Aplica deduplicación, traducción a español, corrección de naming/sector y compliance."*

- Nueva pestaña/acordeón **"Brief Limpio"** que renderiza `briefing._clean_brief_md` con `react-markdown`.
  - Si no existe (v3 antiguo), mostrar CTA *"Generar brief limpio"* que llama `normalizeBrief()`.

### G) Tests `chunked-extractor_test.ts` y `brief-normalizer_test.ts` (nuevo)

- `retryFailedChunks: reconstruye chunks por ID y devuelve recuperados`.
- `normalizeBrief: separa founder de company name`.
- `normalizeBrief: reemplaza "retail" por "real estate off-market"`.
- `normalizeBrief: añade compliance flags inferidos cuando hay BORME en sources`.
- `normalizeBrief: marca _unverified_number cuando la cifra no está en quotes`.
- `dedup: fusiona "AI agent for copywriting" + "Magazine generation" en un solo candidato`.
- `buildCleanBrief: genera 9 secciones deterministas sin _source_chunks visibles`.

---

## Flujo de uso (para AFFLUX, este briefing v3)

1. Usuario abre Step 2 → ve alerta **"1 bloque falló"** (amarilla).
2. Click **"🔁 Reintentar bloques fallidos"** → frontend reenvía `inputContent` original → backend ejecuta retry del CHUNK fallido (~30s) → merge + normalize + clean brief → guarda v4.
3. Si sólo quiere normalizar sin retry: **"✨ Limpiar y normalizar brief"** (~10-20s).
4. Pestaña **"Brief Limpio"** muestra las 9 secciones deterministas legibles.
5. Pestaña **"Brief Crudo (debug)"** mantiene el JSON con `_source_chunks`, `_evidence_count`, etc. para auditoría.
6. F2/F3 siguen consumiendo el `business_extraction_v2` (ahora normalizado), no el clean brief markdown.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Normalizer rompe semántica al traducir | LLM call es no bloqueante; si falla → warning, brief crudo intacto |
| Mapeo de naming heurístico falsifica founder | UI muestra el cambio en `_normalization_log` y permite revertir desde un botón |
| Sector replacement reemplaza algo válido | Solo aplica `\b retail \b` (token aislado), no en URLs/IDs |
| Snapshot v3 ocupa espacio | Solo en `input_data.previous_version_snapshot`, ~50KB por proyecto |
| Retry usa el input que el usuario ya editó | `inputContent` viene del frontend, garantiza coherencia con Step 1 actual |

---

## Criterios de aceptación AFFLUX v4

Después de retry + normalize:
- ✅ `failed_chunks_count == 0` (o documentado por qué no se pudo).
- ✅ `client_naming_check.client_company_name == "AFLU"` y `founder_or_decision_maker == "Alejandro Gordo"`.
- ✅ `proposed_product_name == "AFFLUX"`.
- ✅ Cero apariciones de "retail" / "comercio minorista" en strings.
- ✅ Cero strings con >40% palabras inglesas (excepto nombres propios).
- ✅ `initial_compliance_flags` incluye al menos 5 de los 7 que mencionas.
- ✅ `ai_native_opportunity_signals` ≤ 14 candidatos (vs los ~25 duplicados actuales).
- ✅ Existe `briefing._clean_brief_md` con las 9 secciones renderizables.
- ✅ Items con cifras tipo "71 visitas" tienen `_unverified_number: true` si la cifra no está en `source_quotes`.

---

## Rollback

Si algo va mal: el botón "Reintentar/Normalizar" guarda el v3 en `input_data.previous_version_snapshot`. Añado un botón menor "Restaurar versión anterior" que copia ese snapshot al `output_data` y bumpea version.
