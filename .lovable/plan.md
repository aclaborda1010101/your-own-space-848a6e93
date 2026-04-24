
## Paso 1 Pipeline v2 — Crear el contrato fundacional del Component Registry

### Alcance estricto
- **Crear UN ÚNICO archivo nuevo**: `supabase/functions/_shared/component-registry-contract.ts`
- **No modificar nada más**: ni F1, F4, F6, F7, ni UI, ni migraciones, ni `contracts.ts`, ni dependencias.
- **Sin librerías externas**: Levenshtein y normalización implementados internamente.
- Comportamiento del pipeline intacto. El archivo queda disponible pero nadie lo importa todavía.

### Estructura del archivo

#### 1. Tipos exportados
- `RegistryPhase` = `"F0_signal_preservation" | "F1_business_extraction" | "F2_ai_opportunity_designer" | "F3_registry_builder" | "F4a_registry_gap_audit" | "F4b_feasibility_audit" | "F5_scope_architect" | "F6_sector_pattern_detector" | "F7_prd_generator" | "F8_client_deliverables"`
- `RegistryStatus` = `"raw_signal" | "opportunity_candidate" | "audit_suggested" | "pattern_suggested" | "candidate_validated" | "approved_for_scope" | "deferred" | "rejected" | "requires_human_review"`
- `RegistryLayer` = `"A_knowledge" | "B_action" | "C_intelligence" | "D_soul" | "E_interface" | "F_integration" | "G_governance"`
- `ComponentFamily` = `"rag" | "agent" | "orchestrator" | "deterministic_engine" | "scoring_engine" | "matching_engine" | "prediction_engine" | "pattern_module" | "form" | "integration" | "workflow" | "dashboard" | "soul_module" | "compliance_module" | "data_pipeline" | "non_ai_crud"`
- `EvidenceType` = `"client_requested" | "inferred_need" | "unrequested_ai_insight" | "sector_pattern" | "compliance_required" | "technical_dependency" | "data_asset_activation" | "business_catalyst_activation"`
- **`Priority` (AJUSTE 1)** = `"P0_critical" | "P1_high" | "P2_medium" | "P3_low" | "deferred"`
- `BuildComplexity` = `"trivial" | "low" | "medium" | "high" | "very_high"`
- `BusinessImpact` = `"low" | "medium" | "high" | "transformational"`
- `SoulDependency` = `"none" | "consults_soul" | "requires_soul_approval" | "soul_owned"`
- `HumanReviewPolicy` = `"none" | "optional" | "recommended" | "mandatory" | "mandatory_with_veto"`
- **`ComplianceFlag` (AJUSTE 6 ampliado)** =
  ```
  "personal_data_processing" | "profiling" | "automated_decision_support"
  | "commercial_prioritization" | "external_data_enrichment" | "sensitive_data"
  | "children_data" | "financial_data" | "health_data" | "employment_data"
  | "large_scale_monitoring"
  | "scraping_public_sources" | "legal_basis_required" | "data_retention_required"
  | "human_in_the_loop_required" | "gdpr_article_22_risk"
  ```
- `DatasetRequirementType` = `"historical" | "labeled" | "real_time_stream" | "external_benchmark" | "synthetic_allowed"`
- `RegistryMutationAction` = `"created" | "updated" | "status_changed" | "approved" | "deferred" | "rejected" | "merged" | "split" | "flagged_for_review"`

#### 2. Interfaces

**`SourceQuote` (AJUSTE 2 ampliado)**
```ts
interface SourceQuote {
  quote: string;
  speaker?: string;
  timestamp?: string;
  meeting_date?: string;
  source_id?: string;
  source_type?: "transcript" | "document" | "email" | "call" | "manual_note" | "unknown";
  confidence?: number;
}
```

**Refs y requisitos**
- `DataAssetRef { asset_id: string; name?: string; activation_note?: string }`
- `BusinessCatalystRef { catalyst_id: string; name?: string; coverage_note?: string }`
- `EconomicPainRef { pain_id: string; description?: string; estimated_impact_eur?: number }`
- `ExternalSourceRef { source_id?: string; name: string; url?: string; access_type?: "public" | "api" | "scraping" | "partner" | "purchased"; legal_basis_note?: string }`
- `RagRequirement { rag_id?: string; name: string; purpose: string; expected_corpus?: string }`
- `AgentRequirement { agent_id?: string; name: string; role: string; tools?: string[] }`
- `FormRequirement { form_id?: string; name: string; purpose?: string; fields_summary?: string }`
- `MoeRouteSpec { route_id?: string; routing_criteria?: string; experts?: string[]; default_expert?: string }`
- `DatasetRequirement { type: DatasetRequirementType; minimum_sample_size?: number; historical_data_needed?: string; validation_method?: string; abstention_policy?: string; notes?: string }`
- `ComponentCostEstimate { build_eur?: number; monthly_run_eur?: number; assumptions?: string }`
- `RegistryMutation { phase: RegistryPhase; action: RegistryMutationAction; at: string; reason?: string; previous_status?: RegistryStatus; new_status?: RegistryStatus; actor?: string }`

**`ComponentRegistryItem`** — todos los campos enumerados en el brief, con `mutation_history: RegistryMutation[]` obligatorio.

**`ComponentRegistry` (AJUSTE 4 — bloque DPIA top-level)**
```ts
interface ComponentRegistry {
  registry_version: string;
  project_id?: string;
  client_company_name: string;
  product_name?: string;
  naming_collision?: { detected: boolean; reason?: string; user_override?: boolean; override_reason?: string };
  business_model_summary?: string;
  sector?: { primary_sector?: string; sub_vertical?: string; confidence?: number };
  components: ComponentRegistryItem[];
  dpia?: {
    required: boolean;
    trigger_flags: ComplianceFlag[];
    status: "not_started" | "draft" | "completed" | "not_required";
    reason?: string;
    notes?: string;
  };
  created_at: string;
  updated_at: string;
}
```

**`RegistryValidationIssue`**
```ts
{ severity: "info" | "warning" | "error"; code: string; message: string; component_id?: string; suggested_fix?: string }
```

**`RegistryValidationResult { valid: boolean; issues: RegistryValidationIssue[] }`**

**`RegistryMutationRule { phase: RegistryPhase; can_create: boolean; can_modify: boolean; can_approve: boolean; allowed_target_statuses: RegistryStatus[]; notes?: string }`**

#### 3. Constantes
- `REGISTRY_STATUSES`, `REGISTRY_PHASES`, `REGISTRY_LAYERS`, `COMPONENT_FAMILIES`, `COMPLIANCE_FLAGS` — arrays `as const` con los valores anteriores.
- **`DPIA_TRIGGER_FLAGS`** — subconjunto de `ComplianceFlag` que dispara DPIA:
  ```
  ["personal_data_processing", "profiling", "automated_decision_support",
   "commercial_prioritization", "external_data_enrichment", "sensitive_data",
   "children_data", "financial_data", "health_data", "employment_data",
   "large_scale_monitoring", "gdpr_article_22_risk"]
  ```
- **`LAYER_C_DATASET_REQUIRED_FAMILIES`** = `["scoring_engine", "matching_engine", "prediction_engine"]`
- **`MUTATION_RULES_BY_PHASE`** — Map `RegistryPhase → RegistryMutationRule`. **AJUSTE 5 aplicado**: F7 tiene `can_create=false`, `can_modify=false`, `can_approve=false`. F8 idem.

  | Fase | create | modify | approve | Targets permitidos |
  |---|---|---|---|---|
  | F0 | false | false | false | `raw_signal` |
  | F1 | false | false | false | `raw_signal`, `opportunity_candidate` (soft) |
  | F2 | true | true | false | `opportunity_candidate` |
  | F3 | true | true | false | `candidate_validated`, `requires_human_review` |
  | F4a | true | true | false | `audit_suggested`, `requires_human_review` |
  | F4b | false* | true | false | `deferred`, `rejected`, `requires_human_review` |
  | F5 | false | true | true | `approved_for_scope`, `deferred` |
  | F6 | true | false | false | `pattern_suggested` |
  | **F7** | **false** | **false** | **false** | — (solo emite `WARNING`) |
  | F8 | false | false | false | — |

#### 4. Helpers

- `createEmptyComponentRegistry(params: { project_id?: string; client_company_name: string; product_name?: string }): ComponentRegistry`
- `canPhaseCreateComponent(phase)` / `canPhaseModifyComponent(phase)` / `canPhaseApproveComponent(phase)` — leen `MUTATION_RULES_BY_PHASE`.
- `appendMutation(item, mutation)` — devuelve nuevo item con mutation añadida (no mutar in-place).
- `checkNamingCollision(clientCompanyName, productName)` — normaliza (lowercase, strip diacritics, trim, collapse spaces), comprueba igualdad / contención / Levenshtein ≤ 2 para nombres ≤10 chars. Levenshtein interno (matriz DP). Devuelve `{ detected, reason? }`.
- **`requiresDatasetReadiness(item)` (AJUSTE 3 — clave)**:
  ```ts
  const ALWAYS = ["scoring_engine","matching_engine","prediction_engine"];
  const PREDICTIVE_KEYWORDS = ["rank","ranking","score","scoring","predict","prediction",
    "match","matching","price","pricing","anomaly","anomalía","recommend","recommendation",
    "recomendación","forecast","prioritize","priorización","priorizar"];
  function hasPredictiveKeyword(item) {
    const haystack = [item.name, item.description, item.business_job, ...(item.output_data||[])]
      .filter(Boolean).join(" ").toLowerCase();
    return PREDICTIVE_KEYWORDS.some(k => haystack.includes(k));
  }
  return ALWAYS.includes(item.family)
      || ((item.layer === "C_intelligence" || item.family === "pattern_module") && hasPredictiveKeyword(item));
  ```
  → Motores deterministas de reglas explícitas NO se bloquean.

- `shouldTriggerDpia(registry)` — true si algún componente tiene una flag de `DPIA_TRIGGER_FLAGS`.

- **`validateRegistryItem(item)`**:
  - Campos obligatorios: `component_id, name, family, layer, status, phase, business_job, evidence_type, priority, build_complexity, business_impact`.
  - Si `status === "approved_for_scope"` → exige `success_metric` o `acceptance_criteria.length > 0`.
  - Si `requiresDatasetReadiness(item)` → exige `dataset_requirements[]` con al menos un item que tenga `minimum_sample_size`, `historical_data_needed`, `validation_method`, `abstention_policy` (si falta cualquiera → warning `MISSING_DATASET_READINESS` con sugerencia de pasar a readiness plan).
  - **AJUSTE 7 — `WEAK_EVIDENCE_TRACEABILITY`**: si `evidence_type ∈ {client_requested, inferred_need, unrequested_ai_insight, sector_pattern}` y NO hay (`source_quotes.length>0` OR `business_justification` OR `business_catalysts_covered.length>0` OR `data_assets_activated.length>0`) → warning.

- **`validateComponentRegistry(registry)`**:
  - Naming collision (usa `checkNamingCollision`, respeta `user_override`).
  - IDs duplicados → error `DUPLICATE_COMPONENT_ID`.
  - Llama `validateRegistryItem` a cada componente y agrega issues.
  - **DPIA (AJUSTE 4)**:
    - Si `shouldTriggerDpia(registry)` y no existe `registry.dpia` → warning `DPIA_BLOCK_MISSING`.
    - Si existe `registry.dpia.required === false` pero hay trigger flags → warning `DPIA_INCONSISTENT`.
    - Si algún componente tiene `dpia_required === true` pero falta `registry.dpia` → warning `DPIA_COMPONENT_TRIGGERED_BUT_NO_BLOCK`.
  - Devuelve `{ valid: errors===0, issues }`.

#### 5. Issue codes canónicos
`NAMING_COLLISION`, `DUPLICATE_COMPONENT_ID`, `MISSING_REQUIRED_FIELD`, `MISSING_SUCCESS_METRIC`, `MISSING_DATASET_READINESS`, `WEAK_EVIDENCE_TRACEABILITY`, `DPIA_BLOCK_MISSING`, `DPIA_INCONSISTENT`, `DPIA_COMPONENT_TRIGGERED_BUT_NO_BLOCK`, `F7_NEW_COMPONENT_REQUIRES_REVIEW` (este último expuesto como helper `buildF7NewComponentIssue(componentName)` para que F7, cuando se conecte en futuros pasos, pueda emitirlo sin tener que reconstruir el objeto).

### Criterios de aceptación
1. Existe `supabase/functions/_shared/component-registry-contract.ts`.
2. No se modifica ningún otro archivo (ni `contracts.ts`, ni edge functions, ni UI, ni `config.toml`, ni migraciones).
3. TypeScript compila (validable con `deno check` mentalmente; sintaxis estricta, sin `any` salvo en internals controlados).
4. Exporta todos los tipos, interfaces, constantes y helpers listados.
5. La validación detecta: naming collision, Capa C/familias predictivas sin dataset (con regla matizada del Ajuste 3), DPIA, aprobados sin métrica, IDs duplicados, evidencia débil.
6. F7 y F8 NO pueden crear/modificar/aprobar componentes según `MUTATION_RULES_BY_PHASE`.

### Entregable final
Resumen con: archivo creado, confirmación de no-modificación, decisiones de implementación, supuestos, desviaciones (si las hubiera).
