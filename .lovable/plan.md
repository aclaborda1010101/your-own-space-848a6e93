# Paso 2 — Pipeline v2: F0 Signal Preservation + F1 Business Extraction Brief v2

## Objetivo
Evolucionar la fase de extracción del wizard (`extract` action) para que:
1. **F0** preserve señales de negocio (frases de oro, dolores económicos, data assets, catalysts) **antes** del filtrado de transcripción.
2. **F1** produzca un `Business Extraction Brief v2` enriquecido sin romper la UI ni los contratos legacy.
3. **F1 NO** cree `ComponentRegistryItem` ni IDs `COMP-XXX` (eso es trabajo de F2/F3 en pasos posteriores).

## Restricciones
- **No tocar:** F2/F3/F4/F6/F7, UI, migraciones, tablas, PRD generator, pattern detector, `_shared/component-registry-contract.ts` (salvo aviso).
- Cambios en `contracts.ts` **solo aditivos**.
- Compatibilidad legacy **garantizada**: la UI actual de "Briefing Extraído" no se rompe.

---

## Archivos a CREAR

### 1. `supabase/functions/project-wizard-step/f0-signal-preservation.ts`
Nueva subfase que extrae señales del raw transcript antes del filtro.

**Exporta:**
- `interface SignalPreservationResult` con campos: `version`, `golden_quotes`, `discarded_content_with_business_signal_candidates`, `quantitative_signals`, `named_entities`, `external_sources_mentioned`, `data_assets_mentioned`, `business_catalyst_candidates`, `economic_pain_candidates`, `ambiguity_notes`.
- `async function runF0SignalPreservation(rawContent: string, projectContext?: any): Promise<SignalPreservationResult>`
- `function emptyF0Result(): SignalPreservationResult` (fallback si F0 falla)

**Implementación clave:**
- Usa `callGeminiFlash` desde `./llm-helpers.ts` (JSON mode). **No crear cliente Gemini nuevo.**
- Prompt orientado a "arquitecto IA-nativo" con reglas anti-pérdida de señal lateral.
- Define `discarded_content_with_business_signal_candidates` como "frases laterales que un filtro probablemente descartaría pero contienen señal de negocio" (no afirma que fueron descartadas realmente, ya que solo hacemos 1 llamada sobre raw completo).
- **Límites duros aplicados post-parse** para evitar inflar `output_data`:
  - `golden_quotes` ≤ 25, cada texto ≤ 500 chars
  - `discarded_content_*` ≤ 20, cada texto ≤ 500 chars
  - `named_entities` ≤ 50
  - `quantitative_signals` ≤ 30
  - `external_sources_mentioned` ≤ 20
  - `data_assets_mentioned` ≤ 20
  - `business_catalyst_candidates` ≤ 15
  - `economic_pain_candidates` ≤ 15
- En caso de error o JSON inválido, devuelve `emptyF0Result()` (no rompe el pipeline).

### 2. `supabase/functions/project-wizard-step/f1-legacy-shape.ts`
Normalizador post-parse que garantiza que el brief F1 tenga todos los campos legacy esperados por la UI.

**Exporta:**
- `function ensureLegacyBriefShape(briefing: any): any`
  - Asegura que existan (como arrays vacíos o derivados): `project_summary`, `observed_facts`, `inferred_needs`, `solution_candidates`, `constraints_and_risks`, `open_questions`, `architecture_signals`, `deep_patterns`, `extraction_warnings`, `parallel_projects`.
  - Si falta `observed_facts` → derivar de `business_extraction_v2.observed_facts`.
  - Si falta `architecture_signals` → derivar de `business_extraction_v2.architecture_signals`.
  - Si falta `solution_candidates` → derivar de `business_extraction_v2.client_requested_items` + `ai_native_opportunity_signals`.
  - Si falta `project_summary` → usar `business_extraction_v2.business_model_summary`.
  - Si falta `inferred_needs`, `constraints_and_risks`, `open_questions` → derivar de su equivalente v2.
- `function stripRegistryLeaks(briefing: any): { cleaned: any; leakDetected: boolean; leakDetails: string[] }`
  - **Guard anti-ComponentRegistryItem (Ajuste 2):**
    - Inspecciona top-level y dentro de `business_extraction_v2`.
    - Elimina claves: `component_registry`, `components`, `ComponentRegistryItem`.
    - Detecta IDs con patrón `COMP-` en strings/objetos top-level y los marca.
    - Si se detecta algo, registra en `extraction_warnings`:
      ```ts
      {
        type: "registry_leak_prevented",
        message: "F1 attempted to emit registry/component data. It was removed because ComponentRegistryItems are created only in F2/F3."
      }
      ```

### 3. `supabase/functions/project-wizard-step/__fixtures__/aflu-signals.fixture.ts` (opcional, si no complica)
Fixture sintético mínimo con frases tipo:
- "tenemos 3.000 llamadas grabadas"
- "lo que más nos mueve son las muertes"
- "71 visitas en 9 meses sin cerrar"

Si el setup de tests con mock LLM resulta complejo, **se omite** y se documenta como QA manual en un comentario de `index.ts`. **No bloquea implementación.**

---

## Archivos a MODIFICAR

### 4. `supabase/functions/project-wizard-step/contracts.ts`
**Cambios solo aditivos** en el contrato del Step 2:

```ts
allowedTopLevelKeys: [
  // ... existentes
  "brief_version",
  "business_extraction_v2",
  "legacy_compatibility",
  "_f0_signals",
],
```

**No tocar:** `forbiddenKeys`, `forbiddenTerms`, `requiredFields`, `requiredItemMeta`, `inputStepsAllowed`. Subir `outputSchemaVersion` a `"v3.2"` (cambio menor).

### 5. `supabase/functions/project-wizard-step/index.ts`
Cambios mínimos en el `extract` action:

**Imports añadidos:**
```ts
import { runF0SignalPreservation, emptyF0Result } from "./f0-signal-preservation.ts";
import { ensureLegacyBriefShape, stripRegistryLeaks } from "./f1-legacy-shape.ts";
import { checkNamingCollision } from "../_shared/component-registry-contract.ts";
// NO importar ComplianceFlag salvo que se use realmente en tipos locales (Ajuste 3).
```

**Nuevo orden de ejecución (F0 → filtro paralelo → F1):**
```ts
const f0Promise = runF0SignalPreservation(inputContent, projectContext)
  .catch(() => emptyF0Result());

const filteredPromise = needsTranscriptFilter(inputContent)
  ? runTranscriptFilter(inputContent)
  : Promise.resolve({ filteredContent: inputContent, wasFiltered: false });

const [f0Result, filterResult] = await Promise.all([f0Promise, filteredPromise]);

// Inyectar F0_SIGNALS en el prompt F1
const f1Prompt = buildF1PromptV2({
  filteredTranscript: filterResult.filteredContent,
  f0Signals: f0Result,
  documents,
  projectContext,
});
```

**Prompt F1 v2 (cambios clave):**
- Añadir framing "Eres un arquitecto IA-nativo senior. No estás aquí para resumir...".
- Reglas anti-pérdida explícitas (frases laterales, números concretos, data assets, catalysts, founder soul como riesgo).
- **Límites orientativos por sección (Ajuste 1):**
  - `observed_facts` ≤25, `business_catalysts` ≤10, `underutilized_data_assets` ≤8, `quantified_economic_pains` ≤10, `decision_points` ≤8, `stakeholder_map` ≤10, `client_requested_items` ≤12, `inferred_needs` ≤12, `ai_native_opportunity_signals` ≤10, `external_data_sources_mentioned` ≤10, `architecture_signals` ≤12, `initial_compliance_flags` ≤10, `constraints_and_risks` ≤10, `open_questions` ≤10.
- Regla explícita: "Genera SIEMPRE dos capas — campos legacy + bloque `business_extraction_v2`. Si hay tensión, prioriza no romper legacy."
- Regla explícita: "NO generes ComponentRegistryItem. NO uses IDs `COMP-XXX`. Usa IDs blandos: `CAT-001`, `ASSET-001`, `PAIN-001`, `REQ-001`, `SIGNAL-001`."
- Output con `brief_version: "2.0.0"`.

**Post-parse pipeline:**
```ts
let briefing = parseRobustJSON(llmOutput);

// 1. Strip registry leaks (Ajuste 2)
const { cleaned, leakDetected, leakDetails } = stripRegistryLeaks(briefing);
briefing = cleaned;
if (leakDetected) {
  briefing.extraction_warnings = [
    ...(briefing.extraction_warnings || []),
    { type: "registry_leak_prevented", message: "...", details: leakDetails },
  ];
}

// 2. Legacy shape (Ajuste 4 original)
briefing = ensureLegacyBriefShape(briefing);

// 3. Naming collision check (server-side)
if (briefing.business_extraction_v2?.client_naming_check) {
  const clientName = briefing.business_extraction_v2.client_naming_check.client_company_name || companyName;
  const productName = briefing.business_extraction_v2.client_naming_check.proposed_product_name;
  // Solo comprobar si productName existe explícitamente (no inventar)
  if (clientName && productName) {
    const collision = checkNamingCollision(clientName, productName);
    briefing.business_extraction_v2.client_naming_check.collision_detected = collision.detected;
    briefing.business_extraction_v2.client_naming_check.collision_reason = collision.reason;
  }
}

// 4. Adjuntar F0 signals (con límites ya aplicados dentro de runF0SignalPreservation)
briefing._f0_signals = f0Result;
briefing.brief_version = briefing.brief_version || "2.0.0";
briefing.legacy_compatibility = { mapped_to_old_brief_fields: true };
```

---

## Orden final confirmado
```
inputContent (raw)
   ├─→ F0 runF0SignalPreservation()  ─┐
   └─→ needsTranscriptFilter() ?      │  Promise.all
        ├─ runTranscriptFilter()  ────┤
        └─ passthrough                │
                                       ▼
                          F1 buildF1PromptV2({filtered, f0Signals, docs, ctx})
                                       ▼
                          callGeminiFlash (JSON mode, brief_version=2.0.0)
                                       ▼
                          parseRobustJSON
                                       ▼
                          stripRegistryLeaks  ← Guard Ajuste 2
                                       ▼
                          ensureLegacyBriefShape  ← Compat UI
                                       ▼
                          checkNamingCollision (solo si product_name existe)
                                       ▼
                          attach _f0_signals + brief_version
                                       ▼
                          persist en project_wizard_steps
```

---

## Validación
- `deno check` debe pasar para los archivos tocados.
- Action `extract` sigue funcionando (smoke test manual con un proyecto existente).
- Output JSON contiene `brief_version: "2.0.0"`.
- Output sigue conteniendo todos los campos legacy esperados.
- F0 reinyecta señales en el prompt F1.
- F1 no emite `component_registry`, `components`, ni IDs `COMP-XXX` (si lo intenta, queda en `extraction_warnings`).

## Riesgos y rollback
- **Riesgo:** F0 añade ~3-8s de latencia. Mitigado con `Promise.all` paralelo al filtro.
- **Riesgo:** prompt F1 más largo puede hacer que el LLM omita campos legacy. Mitigado con `ensureLegacyBriefShape`.
- **Rollback:** revertir `index.ts` y `contracts.ts` a la versión previa; eliminar los 2-3 archivos nuevos. Sin migraciones, sin cambios en tablas, sin cambios en UI → rollback trivial.

## Entregables al terminar
1. Archivos creados.
2. Archivos modificados.
3. Confirmación del orden F0 raw → filtro paralelo → F1.
4. Confirmación de campos legacy presentes en el output.
5. Confirmación de `business_extraction_v2` generado.
6. Confirmación de que F1 no crea `ComponentRegistryItem`.
7. Resultado de `deno check`.
8. Errores preexistentes detectados (no causados por este cambio).
