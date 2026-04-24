/**
 * component-registry-contract.ts
 *
 * Pipeline v2 — Paso 1: Contrato fundacional del Component Registry.
 *
 * Fuente única de verdad para los componentes del proyecto a lo largo de
 * todo el pipeline (F0 → F8). Las fases NO deben inventar componentes
 * fuera de este contrato; deben leer/escribir/anotar mediante los tipos
 * y helpers expuestos aquí.
 *
 * Este archivo es type-only + helpers puros: no importa runtime de
 * Deno ni Supabase. Reusable desde edge functions y, si se replican
 * los tipos, desde el frontend.
 *
 * IMPORTANTE: la creación de este archivo NO modifica el comportamiento
 * actual del pipeline. Ninguna fase lo importa todavía. Será conectado
 * en pasos posteriores (F0/F1 → primero).
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export type RegistryPhase =
  | "F0_signal_preservation"
  | "F1_business_extraction"
  | "F2_ai_opportunity_designer"
  | "F3_registry_builder"
  | "F4a_registry_gap_audit"
  | "F4b_feasibility_audit"
  | "F5_scope_architect"
  | "F6_sector_pattern_detector"
  | "F7_prd_generator"
  | "F8_client_deliverables";

export type RegistryStatus =
  | "raw_signal"
  | "opportunity_candidate"
  | "audit_suggested"
  | "pattern_suggested"
  | "candidate_validated"
  | "approved_for_scope"
  | "deferred"
  | "rejected"
  | "requires_human_review";

export type RegistryLayer =
  | "A_knowledge"
  | "B_action"
  | "C_intelligence"
  | "D_soul"
  | "E_interface"
  | "F_integration"
  | "G_governance";

export type ComponentFamily =
  | "rag"
  | "agent"
  | "orchestrator"
  | "deterministic_engine"
  | "scoring_engine"
  | "matching_engine"
  | "prediction_engine"
  | "pattern_module"
  | "form"
  | "integration"
  | "workflow"
  | "dashboard"
  | "soul_module"
  | "compliance_module"
  | "data_pipeline"
  | "non_ai_crud";

export type EvidenceType =
  | "client_requested"
  | "inferred_need"
  | "unrequested_ai_insight"
  | "sector_pattern"
  | "compliance_required"
  | "technical_dependency"
  | "data_asset_activation"
  | "business_catalyst_activation";

/**
 * AJUSTE 1 — Prioridad alineada con MVP/F2/F3 (P0..P3 + deferred).
 */
export type Priority =
  | "P0_critical"
  | "P1_high"
  | "P2_medium"
  | "P3_low"
  | "deferred";

export type BuildComplexity =
  | "trivial"
  | "low"
  | "medium"
  | "high"
  | "very_high";

export type BusinessImpact =
  | "low"
  | "medium"
  | "high"
  | "transformational";

export type SoulDependency =
  | "none"
  | "consults_soul"
  | "requires_soul_approval"
  | "soul_owned";

export type HumanReviewPolicy =
  | "none"
  | "optional"
  | "recommended"
  | "mandatory"
  | "mandatory_with_veto";

/**
 * AJUSTE 6 — Compliance flags ampliadas para proyectos con profiling,
 * priorización comercial, scraping, decisión automatizada (GDPR Art.22), etc.
 */
export type ComplianceFlag =
  | "personal_data_processing"
  | "profiling"
  | "automated_decision_support"
  | "commercial_prioritization"
  | "external_data_enrichment"
  | "sensitive_data"
  | "children_data"
  | "financial_data"
  | "health_data"
  | "employment_data"
  | "large_scale_monitoring"
  | "scraping_public_sources"
  | "legal_basis_required"
  | "data_retention_required"
  | "human_in_the_loop_required"
  | "gdpr_article_22_risk";

export type DatasetRequirementType =
  | "historical"
  | "labeled"
  | "real_time_stream"
  | "external_benchmark"
  | "synthetic_allowed";

export type RegistryMutationAction =
  | "created"
  | "updated"
  | "status_changed"
  | "approved"
  | "deferred"
  | "rejected"
  | "merged"
  | "split"
  | "flagged_for_review";

// ─────────────────────────────────────────────────────────────────────────────
// 2. INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AJUSTE 2 — SourceQuote rica para trazabilidad fuerte hacia la reunión real.
 */
export interface SourceQuote {
  quote: string;
  speaker?: string;
  timestamp?: string;
  meeting_date?: string;
  source_id?: string;
  source_type?:
    | "transcript"
    | "document"
    | "email"
    | "call"
    | "manual_note"
    | "unknown";
  confidence?: number;
}

export interface DataAssetRef {
  asset_id: string;
  name?: string;
  activation_note?: string;
}

export interface BusinessCatalystRef {
  catalyst_id: string;
  name?: string;
  coverage_note?: string;
}

export interface EconomicPainRef {
  pain_id: string;
  description?: string;
  estimated_impact_eur?: number;
}

export interface ExternalSourceRef {
  source_id?: string;
  name: string;
  url?: string;
  access_type?: "public" | "api" | "scraping" | "partner" | "purchased";
  legal_basis_note?: string;
}

export interface RagRequirement {
  rag_id?: string;
  name: string;
  purpose: string;
  expected_corpus?: string;
}

export interface AgentRequirement {
  agent_id?: string;
  name: string;
  role: string;
  tools?: string[];
}

export interface FormRequirement {
  form_id?: string;
  name: string;
  purpose?: string;
  fields_summary?: string;
}

export interface MoeRouteSpec {
  route_id?: string;
  routing_criteria?: string;
  experts?: string[];
  default_expert?: string;
}

export interface DatasetRequirement {
  type: DatasetRequirementType;
  minimum_sample_size?: number;
  historical_data_needed?: string;
  validation_method?: string;
  abstention_policy?: string;
  notes?: string;
}

export interface ComponentCostEstimate {
  build_eur?: number;
  monthly_run_eur?: number;
  assumptions?: string;
}

export interface RegistryMutation {
  phase: RegistryPhase;
  action: RegistryMutationAction;
  at: string; // ISO timestamp
  reason?: string;
  previous_status?: RegistryStatus;
  new_status?: RegistryStatus;
  actor?: string;
}

export interface ComponentRegistryItem {
  // Identidad
  component_id: string;
  name: string;
  description?: string;

  // Clasificación
  family: ComponentFamily;
  layer: RegistryLayer;
  status: RegistryStatus;
  phase: RegistryPhase; // fase del pipeline que generó/actualizó por última vez este item
  priority: Priority;

  // Negocio
  business_job: string;
  business_justification?: string;

  // Evidencia y trazabilidad
  evidence_type: EvidenceType;
  evidence_strength: "low" | "medium" | "high";
  source_quotes: SourceQuote[];

  business_catalysts_covered?: BusinessCatalystRef[];
  data_assets_activated?: DataAssetRef[];
  economic_pains_addressed?: EconomicPainRef[];

  // Datos
  input_data?: string[];
  output_data?: string[];

  // Dependencias técnicas
  required_rags?: RagRequirement[];
  required_agents?: AgentRequirement[];
  required_forms?: FormRequirement[];
  external_sources?: ExternalSourceRef[];

  // Routing avanzado
  moe_route?: MoeRouteSpec;

  // Soul / supervisión
  soul_dependency: SoulDependency;
  human_review: HumanReviewPolicy;

  // Pre-requisitos y readiness
  prerequisites?: string[];
  dataset_requirements?: DatasetRequirement[];

  // Métricas de éxito
  success_metric?: string;
  acceptance_criteria?: string[];

  // Compliance
  compliance_flags?: ComplianceFlag[];
  dpia_required?: boolean;

  // Construcción
  build_complexity: BuildComplexity;
  business_impact: BusinessImpact;

  // Coste
  cost_estimate?: ComponentCostEstimate;

  // Historial
  mutation_history: RegistryMutation[];
}

/**
 * AJUSTE 4 — Bloque DPIA top-level: el DPIA es una obligación de
 * governance del proyecto completo, no solo un flag por componente.
 */
export interface ComponentRegistry {
  registry_version: string;
  project_id?: string;
  client_company_name: string;
  product_name?: string;
  naming_collision?: {
    detected: boolean;
    reason?: string;
    user_override?: boolean;
    override_reason?: string;
  };
  business_model_summary?: string;
  sector?: {
    primary_sector?: string;
    sub_vertical?: string;
    confidence?: number;
  };
  components: ComponentRegistryItem[];
  dpia?: {
    required: boolean;
    trigger_flags: ComplianceFlag[];
    status: "not_started" | "draft" | "completed" | "not_required";
    reason?: string;
    notes?: string;
  };
  created_at: string; // ISO
  updated_at: string; // ISO
}

export interface RegistryValidationIssue {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  component_id?: string;
  suggested_fix?: string;
}

export interface RegistryValidationResult {
  valid: boolean;
  issues: RegistryValidationIssue[];
}

export interface RegistryMutationRule {
  phase: RegistryPhase;
  can_create: boolean;
  can_modify: boolean;
  can_approve: boolean;
  allowed_target_statuses: RegistryStatus[];
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

export const REGISTRY_PHASES = [
  "F0_signal_preservation",
  "F1_business_extraction",
  "F2_ai_opportunity_designer",
  "F3_registry_builder",
  "F4a_registry_gap_audit",
  "F4b_feasibility_audit",
  "F5_scope_architect",
  "F6_sector_pattern_detector",
  "F7_prd_generator",
  "F8_client_deliverables",
] as const satisfies readonly RegistryPhase[];

export const REGISTRY_STATUSES = [
  "raw_signal",
  "opportunity_candidate",
  "audit_suggested",
  "pattern_suggested",
  "candidate_validated",
  "approved_for_scope",
  "deferred",
  "rejected",
  "requires_human_review",
] as const satisfies readonly RegistryStatus[];

export const REGISTRY_LAYERS = [
  "A_knowledge",
  "B_action",
  "C_intelligence",
  "D_soul",
  "E_interface",
  "F_integration",
  "G_governance",
] as const satisfies readonly RegistryLayer[];

export const COMPONENT_FAMILIES = [
  "rag",
  "agent",
  "orchestrator",
  "deterministic_engine",
  "scoring_engine",
  "matching_engine",
  "prediction_engine",
  "pattern_module",
  "form",
  "integration",
  "workflow",
  "dashboard",
  "soul_module",
  "compliance_module",
  "data_pipeline",
  "non_ai_crud",
] as const satisfies readonly ComponentFamily[];

export const COMPLIANCE_FLAGS = [
  "personal_data_processing",
  "profiling",
  "automated_decision_support",
  "commercial_prioritization",
  "external_data_enrichment",
  "sensitive_data",
  "children_data",
  "financial_data",
  "health_data",
  "employment_data",
  "large_scale_monitoring",
  "scraping_public_sources",
  "legal_basis_required",
  "data_retention_required",
  "human_in_the_loop_required",
  "gdpr_article_22_risk",
] as const satisfies readonly ComplianceFlag[];

/**
 * Familias que SIEMPRE requieren dataset/readiness, independientemente de
 * si la descripción menciona keywords predictivos o no.
 */
export const LAYER_C_DATASET_REQUIRED_FAMILIES = [
  "scoring_engine",
  "matching_engine",
  "prediction_engine",
] as const satisfies readonly ComponentFamily[];

/**
 * Subset de ComplianceFlag que dispara DPIA (Data Protection Impact Assessment).
 */
export const DPIA_TRIGGER_FLAGS = [
  "personal_data_processing",
  "profiling",
  "automated_decision_support",
  "commercial_prioritization",
  "external_data_enrichment",
  "sensitive_data",
  "children_data",
  "financial_data",
  "health_data",
  "employment_data",
  "large_scale_monitoring",
  "gdpr_article_22_risk",
] as const satisfies readonly ComplianceFlag[];

/**
 * Reglas de mutación por fase del pipeline.
 *
 * AJUSTE 5 — F7 NO puede crear/modificar/aprobar componentes. Si detecta
 * uno nuevo, debe emitir un RegistryValidationIssue
 * (ver buildF7NewComponentIssue) en vez de añadirlo al registry.
 *
 * F8 (deliverables) es solo lectura.
 */
export const MUTATION_RULES_BY_PHASE: Record<RegistryPhase, RegistryMutationRule> = {
  F0_signal_preservation: {
    phase: "F0_signal_preservation",
    can_create: false,
    can_modify: false,
    can_approve: false,
    allowed_target_statuses: ["raw_signal"],
    notes:
      "F0 preserva señales en bruto; no crea componentes finales ni candidatos.",
  },
  F1_business_extraction: {
    phase: "F1_business_extraction",
    can_create: false,
    can_modify: false,
    can_approve: false,
    allowed_target_statuses: ["raw_signal", "opportunity_candidate"],
    notes:
      "F1 extrae jobs/dolores/catalysts/data assets de negocio. NO crea componentes finales; emite señales que F2/F3 convertirán en candidatos.",
  },
  F2_ai_opportunity_designer: {
    phase: "F2_ai_opportunity_designer",
    can_create: true,
    can_modify: true,
    can_approve: false,
    allowed_target_statuses: ["opportunity_candidate"],
    notes:
      "F2 propone oportunidades IA como opportunity_candidate. No aprueba.",
  },
  F3_registry_builder: {
    phase: "F3_registry_builder",
    can_create: true,
    can_modify: true,
    can_approve: false,
    allowed_target_statuses: [
      "candidate_validated",
      "requires_human_review",
      "deferred",
    ],
    notes:
      "F3 normaliza, asigna IDs canónicos y mueve a candidate_validated. No aprueba para alcance.",
  },
  F4a_registry_gap_audit: {
    phase: "F4a_registry_gap_audit",
    can_create: true,
    can_modify: true,
    can_approve: false,
    allowed_target_statuses: ["audit_suggested", "requires_human_review"],
    notes:
      "F4a detecta gaps y propone componentes faltantes como audit_suggested.",
  },
  F4b_feasibility_audit: {
    phase: "F4b_feasibility_audit",
    can_create: false,
    can_modify: true,
    can_approve: false,
    allowed_target_statuses: ["deferred", "rejected", "requires_human_review"],
    notes:
      "F4b NO debe crear componentes salvo excepción documentada. Recomienda deferred/rejected/requires_human_review.",
  },
  F5_scope_architect: {
    phase: "F5_scope_architect",
    can_create: false,
    can_modify: true,
    can_approve: true,
    allowed_target_statuses: [
      "approved_for_scope",
      "deferred",
      "requires_human_review",
    ],
    notes:
      "F5 aprueba componentes para alcance (approved_for_scope) o los pospone.",
  },
  F6_sector_pattern_detector: {
    phase: "F6_sector_pattern_detector",
    can_create: true,
    can_modify: false,
    can_approve: false,
    allowed_target_statuses: ["pattern_suggested"],
    notes:
      "F6 propone componentes basados en patrones sectoriales como pattern_suggested.",
  },
  F7_prd_generator: {
    phase: "F7_prd_generator",
    can_create: false,
    can_modify: false,
    can_approve: false,
    allowed_target_statuses: [],
    notes:
      "F7 genera PRD a partir del registry. NUNCA crea ni modifica componentes. Si detecta uno nuevo emite F7_NEW_COMPONENT_REQUIRES_REVIEW.",
  },
  F8_client_deliverables: {
    phase: "F8_client_deliverables",
    can_create: false,
    can_modify: false,
    can_approve: false,
    allowed_target_statuses: [],
    notes:
      "F8 produce entregables al cliente a partir del registry aprobado. Solo lectura.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Crea un registry vacío con metadatos canónicos y check de naming collision. */
export function createEmptyComponentRegistry(params: {
  client_company_name: string;
  product_name?: string;
  project_id?: string;
}): ComponentRegistry {
  const { client_company_name, product_name, project_id } = params;
  const now = new Date().toISOString();
  const collision = checkNamingCollision(client_company_name, product_name);

  return {
    registry_version: "1.0.0",
    project_id,
    client_company_name,
    product_name,
    naming_collision: {
      detected: collision.detected,
      reason: collision.reason,
      user_override: false,
    },
    components: [],
    created_at: now,
    updated_at: now,
  };
}

export function canPhaseCreateComponent(phase: RegistryPhase): boolean {
  return MUTATION_RULES_BY_PHASE[phase]?.can_create === true;
}

export function canPhaseModifyComponent(phase: RegistryPhase): boolean {
  return MUTATION_RULES_BY_PHASE[phase]?.can_modify === true;
}

export function canPhaseApproveComponent(phase: RegistryPhase): boolean {
  return MUTATION_RULES_BY_PHASE[phase]?.can_approve === true;
}

/**
 * AJUSTE 3 — No bloquear motores deterministas de reglas explícitas.
 *
 * Devuelve true si el componente requiere un dataset/readiness plan antes
 * de poder llevar fórmula predictiva.
 */
const ALWAYS_REQUIRES_DATASET_FAMILIES: ReadonlyArray<ComponentFamily> =
  LAYER_C_DATASET_REQUIRED_FAMILIES;

const PREDICTIVE_KEYWORDS: ReadonlyArray<string> = [
  "rank",
  "ranking",
  "score",
  "scoring",
  "predict",
  "prediction",
  "match",
  "matching",
  "price",
  "pricing",
  "anomaly",
  "anomalía",
  "recommend",
  "recommendation",
  "recomendación",
  "forecast",
  "prioritize",
  "priorización",
  "priorizar",
];

function hasPredictiveKeyword(item: ComponentRegistryItem): boolean {
  const haystack = [
    item.name,
    item.description ?? "",
    item.business_job,
    ...(item.output_data ?? []),
  ]
    .filter((s) => typeof s === "string" && s.length > 0)
    .join(" ")
    .toLowerCase();
  return PREDICTIVE_KEYWORDS.some((k) => haystack.includes(k));
}

export function requiresDatasetReadiness(item: ComponentRegistryItem): boolean {
  if (ALWAYS_REQUIRES_DATASET_FAMILIES.includes(item.family)) {
    return true;
  }
  const isCapaCOrPattern =
    item.layer === "C_intelligence" || item.family === "pattern_module";
  return isCapaCOrPattern && hasPredictiveKeyword(item);
}

export function shouldTriggerDpia(registry: ComponentRegistry): boolean {
  const triggerSet = new Set<ComplianceFlag>(DPIA_TRIGGER_FLAGS);
  return registry.components.some((c) =>
    (c.compliance_flags ?? []).some((f) => triggerSet.has(f)),
  );
}

/** Lista las flags de DPIA detectadas en el registry (deduplicadas). */
function collectDpiaTriggerFlags(registry: ComponentRegistry): ComplianceFlag[] {
  const triggerSet = new Set<ComplianceFlag>(DPIA_TRIGGER_FLAGS);
  const found = new Set<ComplianceFlag>();
  for (const c of registry.components) {
    for (const f of c.compliance_flags ?? []) {
      if (triggerSet.has(f)) found.add(f);
    }
  }
  return Array.from(found);
}

// ── Naming collision ──────────────────────────────────────────────────────

function normalizeName(s: string): string {
  return (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Levenshtein iterativo, sin libs. Memoria O(min(n,m)). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Asegura que `a` es la cadena más corta para minimizar memoria.
  let s1 = a;
  let s2 = b;
  if (s1.length > s2.length) {
    const tmp = s1;
    s1 = s2;
    s2 = tmp;
  }

  const prev = new Array<number>(s1.length + 1);
  const curr = new Array<number>(s1.length + 1);
  for (let i = 0; i <= s1.length; i++) prev[i] = i;

  for (let j = 1; j <= s2.length; j++) {
    curr[0] = j;
    for (let i = 1; i <= s1.length; i++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        curr[i - 1] + 1, // insert
        prev[i] + 1, // delete
        prev[i - 1] + cost, // substitute
      );
    }
    for (let i = 0; i <= s1.length; i++) prev[i] = curr[i];
  }

  return prev[s1.length];
}

export function checkNamingCollision(
  clientCompanyName: string,
  productName?: string,
): { detected: boolean; reason?: string } {
  if (!productName || productName.trim().length === 0) {
    return { detected: false };
  }

  const a = normalizeName(clientCompanyName);
  const b = normalizeName(productName);

  if (a.length === 0 || b.length === 0) {
    return { detected: false };
  }

  if (a === b) {
    return {
      detected: true,
      reason: "El nombre del producto coincide con el del cliente tras normalizar.",
    };
  }

  // Contención (con longitud útil mínima 3 para evitar falsos positivos).
  if (a.length >= 3 && b.length >= 3) {
    if (a.includes(b) || b.includes(a)) {
      return {
        detected: true,
        reason: "Un nombre contiene íntegramente al otro.",
      };
    }
  }

  // Levenshtein <= 2 cuando alguno mide <= 10.
  const minLen = Math.min(a.length, b.length);
  if (minLen <= 10) {
    const dist = levenshtein(a, b);
    if (dist <= 2) {
      return {
        detected: true,
        reason: `Distancia Levenshtein muy baja (${dist}) entre nombres cortos — alta confusión visual.`,
      };
    }
  }

  // Heurística visual: mismo prefijo de 4+ chars y longitud similar (±1).
  if (a.length >= 5 && b.length >= 5 && Math.abs(a.length - b.length) <= 1) {
    const prefixLen = 4;
    if (a.slice(0, prefixLen) === b.slice(0, prefixLen)) {
      return {
        detected: true,
        reason: "Comparten prefijo de 4 caracteres y longitud similar — alta similitud visual.",
      };
    }
  }

  return { detected: false };
}

// ── Mutaciones ────────────────────────────────────────────────────────────

/**
 * Devuelve un nuevo ComponentRegistryItem con la mutation añadida.
 * Inmutable: no muta el item de entrada.
 *
 * Si la mutation no incluye `at`, se rellena con new Date().toISOString().
 */
export function appendMutation(
  item: ComponentRegistryItem,
  mutation: Omit<RegistryMutation, "at"> & { at?: string },
): ComponentRegistryItem {
  const stamped: RegistryMutation = {
    phase: mutation.phase,
    action: mutation.action,
    reason: mutation.reason,
    previous_status: mutation.previous_status,
    new_status: mutation.new_status,
    actor: mutation.actor,
    at: mutation.at ?? new Date().toISOString(),
  };
  return {
    ...item,
    mutation_history: [...(item.mutation_history ?? []), stamped],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDACIÓN
// ─────────────────────────────────────────────────────────────────────────────

/** Issue codes canónicos. */
export const REGISTRY_ISSUE_CODES = {
  NAMING_COLLISION: "NAMING_COLLISION",
  DUPLICATE_COMPONENT_ID: "DUPLICATE_COMPONENT_ID",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  MISSING_SUCCESS_METRIC: "MISSING_SUCCESS_METRIC",
  MISSING_DATASET_READINESS: "MISSING_DATASET_READINESS",
  WEAK_EVIDENCE_TRACEABILITY: "WEAK_EVIDENCE_TRACEABILITY",
  DPIA_BLOCK_MISSING: "DPIA_BLOCK_MISSING",
  DPIA_INCONSISTENT: "DPIA_INCONSISTENT",
  DPIA_COMPONENT_TRIGGERED_BUT_NO_BLOCK: "DPIA_COMPONENT_TRIGGERED_BUT_NO_BLOCK",
  F7_NEW_COMPONENT_REQUIRES_REVIEW: "F7_NEW_COMPONENT_REQUIRES_REVIEW",
} as const;

/**
 * AJUSTE 5 — helper para que F7 emita el issue cuando detecte un componente
 * nuevo en vez de añadirlo al registry.
 */
export function buildF7NewComponentIssue(
  componentName: string,
): RegistryValidationIssue {
  return {
    severity: "warning",
    code: REGISTRY_ISSUE_CODES.F7_NEW_COMPONENT_REQUIRES_REVIEW,
    message: `F7 detected a component not present in the registry ("${componentName}"). It must be reviewed by F3/F5 before being included.`,
    suggested_fix:
      "Send this component back to registry review instead of adding it directly to the PRD.",
  };
}

const REQUIRED_ITEM_FIELDS: ReadonlyArray<keyof ComponentRegistryItem> = [
  "component_id",
  "name",
  "family",
  "layer",
  "status",
  "phase",
  "business_job",
  "evidence_type",
  "priority",
  "build_complexity",
  "business_impact",
];

const EVIDENCE_TYPES_REQUIRING_TRACEABILITY: ReadonlyArray<EvidenceType> = [
  "client_requested",
  "inferred_need",
  "unrequested_ai_insight",
  "sector_pattern",
];

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function validateRegistryItem(
  item: ComponentRegistryItem,
): RegistryValidationIssue[] {
  const issues: RegistryValidationIssue[] = [];

  // Campos obligatorios.
  for (const field of REQUIRED_ITEM_FIELDS) {
    const value = item[field];
    if (value === undefined || value === null || value === "") {
      issues.push({
        severity: "error",
        code: REGISTRY_ISSUE_CODES.MISSING_REQUIRED_FIELD,
        message: `Campo obligatorio ausente: "${String(field)}".`,
        component_id: item.component_id,
        suggested_fix: `Rellena el campo "${String(field)}" antes de promover el componente.`,
      });
    }
  }

  // Aprobado para alcance: success_metric o acceptance_criteria.
  if (item.status === "approved_for_scope") {
    const hasMetric = isNonEmptyString(item.success_metric);
    const hasAccept =
      Array.isArray(item.acceptance_criteria) &&
      item.acceptance_criteria.some(isNonEmptyString);
    if (!hasMetric && !hasAccept) {
      issues.push({
        severity: "error",
        code: REGISTRY_ISSUE_CODES.MISSING_SUCCESS_METRIC,
        message:
          "Componente aprobado para alcance sin métrica de éxito ni criterios de aceptación.",
        component_id: item.component_id,
        suggested_fix:
          "Añade success_metric o al menos un acceptance_criteria antes de aprobar para alcance.",
      });
    }
  }

  // Dataset readiness (regla matizada del Ajuste 3).
  if (requiresDatasetReadiness(item)) {
    const reqs = item.dataset_requirements ?? [];
    const valid = reqs.find(
      (r) =>
        r.minimum_sample_size !== undefined &&
        isNonEmptyString(r.historical_data_needed) &&
        isNonEmptyString(r.validation_method) &&
        isNonEmptyString(r.abstention_policy),
    );
    if (!valid) {
      issues.push({
        severity: "warning",
        code: REGISTRY_ISSUE_CODES.MISSING_DATASET_READINESS,
        message:
          "El componente produce ranking/scoring/predicción/matching/pricing/anomalía/recomendación pero no tiene dataset_requirements completos. No puede llevar fórmula predictiva todavía.",
        component_id: item.component_id,
        suggested_fix:
          "Mueve el componente a un readiness plan: define minimum_sample_size, historical_data_needed, validation_method y abstention_policy.",
      });
    }
  }

  // AJUSTE 7 — evidencia mínima de negocio.
  if (EVIDENCE_TYPES_REQUIRING_TRACEABILITY.includes(item.evidence_type)) {
    const hasQuotes =
      Array.isArray(item.source_quotes) && item.source_quotes.length > 0;
    const hasJustification = isNonEmptyString(item.business_justification);
    const hasCatalysts =
      Array.isArray(item.business_catalysts_covered) &&
      item.business_catalysts_covered.length > 0;
    const hasAssets =
      Array.isArray(item.data_assets_activated) &&
      item.data_assets_activated.length > 0;

    if (!hasQuotes && !hasJustification && !hasCatalysts && !hasAssets) {
      issues.push({
        severity: "warning",
        code: REGISTRY_ISSUE_CODES.WEAK_EVIDENCE_TRACEABILITY,
        message:
          "Trazabilidad de negocio insuficiente: sin source_quotes, business_justification, business_catalysts_covered ni data_assets_activated.",
        component_id: item.component_id,
        suggested_fix:
          "Añade al menos una cita textual, una justificación de negocio, un catalyst cubierto o un data asset activado.",
      });
    }
  }

  return issues;
}

export function validateComponentRegistry(
  registry: ComponentRegistry,
): RegistryValidationResult {
  const issues: RegistryValidationIssue[] = [];

  // 1) Naming collision (respeta user_override).
  const collision = checkNamingCollision(
    registry.client_company_name,
    registry.product_name,
  );
  const overrideAccepted = registry.naming_collision?.user_override === true;
  if (collision.detected && !overrideAccepted) {
    issues.push({
      severity: "error",
      code: REGISTRY_ISSUE_CODES.NAMING_COLLISION,
      message: `Colisión de nombres entre cliente y producto: ${collision.reason ?? "alta similitud."}`,
      suggested_fix:
        "Elige un product_name distinto, o marca naming_collision.user_override=true con un override_reason justificado.",
    });
  }

  // 2) IDs duplicados.
  const seen = new Map<string, number>();
  for (const c of registry.components) {
    if (!c.component_id) continue;
    seen.set(c.component_id, (seen.get(c.component_id) ?? 0) + 1);
  }
  for (const [id, count] of seen.entries()) {
    if (count > 1) {
      issues.push({
        severity: "error",
        code: REGISTRY_ISSUE_CODES.DUPLICATE_COMPONENT_ID,
        message: `component_id duplicado (${count} ocurrencias): "${id}".`,
        component_id: id,
        suggested_fix: "Renombra o fusiona los componentes con el mismo ID.",
      });
    }
  }

  // 3) Validación por componente.
  for (const item of registry.components) {
    issues.push(...validateRegistryItem(item));
  }

  // 4) DPIA (Ajuste 4).
  const dpiaTriggered = shouldTriggerDpia(registry);
  const triggerFlags = collectDpiaTriggerFlags(registry);

  if (dpiaTriggered && !registry.dpia) {
    issues.push({
      severity: "warning",
      code: REGISTRY_ISSUE_CODES.DPIA_BLOCK_MISSING,
      message: `El registry contiene componentes con flags que disparan DPIA (${triggerFlags.join(", ")}) pero no existe bloque registry.dpia.`,
      suggested_fix:
        "Añade registry.dpia con required=true, status='not_started' y trigger_flags detectados.",
    });
  }

  if (dpiaTriggered && registry.dpia && registry.dpia.required === false) {
    issues.push({
      severity: "warning",
      code: REGISTRY_ISSUE_CODES.DPIA_INCONSISTENT,
      message: `registry.dpia.required = false pero hay flags que disparan DPIA: ${triggerFlags.join(", ")}.`,
      suggested_fix:
        "Cambia registry.dpia.required a true o documenta en notes por qué no aplica.",
    });
  }

  const someComponentRequiresDpia = registry.components.some(
    (c) => c.dpia_required === true,
  );
  if (someComponentRequiresDpia && !registry.dpia) {
    issues.push({
      severity: "warning",
      code: REGISTRY_ISSUE_CODES.DPIA_COMPONENT_TRIGGERED_BUT_NO_BLOCK,
      message:
        "Hay componentes con dpia_required=true pero falta el bloque registry.dpia.",
      suggested_fix:
        "Añade registry.dpia con required=true y enumera trigger_flags.",
    });
  }

  const valid = issues.every((i) => i.severity !== "error");
  return { valid, issues };
}
