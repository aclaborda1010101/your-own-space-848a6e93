/**
 * f2-ai-opportunity-designer.ts — Pipeline v2 · Fase F2
 *
 * Convierte `business_extraction_v2` + `_f0_signals` en oportunidades
 * IA-nativas (`AiOpportunityDesignV1`).
 *
 * Reglas duras:
 *   - F2 NO crea ComponentRegistryItem.
 *   - F2 NO usa `component_id`, `components`, `component_registry`,
 *     `ComponentRegistryItem`.
 *   - F2 NO usa IDs `COMP-XXX`. Usa IDs `OPP-001`, `OPP-002`...
 *   - F2 NO aprueba scope, NO genera SQL ni PRD.
 *   - F2 NO inventa fórmulas en motores Capa C.
 *   - F2 marca `non_ai_crud` cuando la necesidad NO requiere IA.
 *   - F2 marca oportunidades no pedidas como `unrequested_ai_insight`.
 *
 * Diseño:
 *   - 1 sola llamada LLM (gemini-2.5-flash) en JSON mode.
 *   - Helpers puros exportados para test sin red:
 *       · clampOpportunityDesign
 *       · validateOpportunityDesign
 *       · emptyOpportunityDesign
 */

import { callGeminiFlash } from "./llm-helpers.ts";
import {
  COMPLIANCE_FLAGS,
  COMPONENT_FAMILIES,
  REGISTRY_LAYERS,
  REGISTRY_PHASES,
} from "../_shared/component-registry-contract.ts";
import type {
  ComplianceFlag,
  ComponentFamily,
  RegistryLayer,
  RegistryPhase,
} from "../_shared/component-registry-contract.ts";

// ── Tipos ────────────────────────────────────────────────────────────

export type OpportunityOrigin =
  | "client_requested"
  | "inferred_need"
  | "unrequested_ai_insight"
  | "business_catalyst_activation"
  | "data_asset_activation"
  | "sector_pattern"
  | "technical_dependency"
  | "compliance_required";

export type OpportunityPriority =
  | "P0_critical"
  | "P1_high"
  | "P2_medium"
  | "P3_low"
  | "deferred";

export type OpportunityComplexity =
  | "trivial"
  | "low"
  | "medium"
  | "high"
  | "very_high";

export type OpportunityImpact =
  | "low"
  | "medium"
  | "high"
  | "critical"
  | "transformational";

export type OpportunitySoulDependency =
  | "none"
  | "consults_soul"
  | "requires_soul_approval"
  | "soul_owned";

export type OpportunityHumanReview =
  | "none"
  | "optional"
  | "recommended"
  | "mandatory"
  | "mandatory_with_veto";

export type OpportunityDeliveryPhase =
  | "data_foundation"
  | "MVP"
  | "F2"
  | "F3"
  | "roadmap"
  | "rejected";

export interface OpportunitySourceQuote {
  quote: string;
  speaker?: string;
  timestamp?: string;
  source_type?: "transcript" | "document" | "email" | "call" | "manual_note" | "unknown";
}

export interface OpportunityCandidate {
  opportunity_id: string;
  name: string;
  description: string;

  origin: OpportunityOrigin;

  evidence_strength: "low" | "medium" | "high";
  source_quotes?: OpportunitySourceQuote[];

  recommended_component_family: ComponentFamily;
  recommended_layer: RegistryLayer;

  business_job: string;
  business_justification: string;

  business_catalysts_covered?: Array<{ catalyst_id?: string; name: string }>;
  data_assets_activated?: Array<{ asset_id?: string; name: string; kind?: string }>;
  economic_pains_addressed?: Array<{ pain_id?: string; name: string; magnitude?: string }>;

  required_data?: string[];

  suggested_rags?: Array<{ name: string; scope: string; freshness?: string }>;
  suggested_agents?: Array<{ role: string; tools?: string[] }>;
  suggested_forms?: Array<{ purpose: string; fields?: string[] }>;
  suggested_external_sources?: Array<{ name: string; url?: string; reason: string }>;
  suggested_moe_route?: { router: string; experts: string[]; fallback?: string };

  soul_dependency: OpportunitySoulDependency;
  human_review: OpportunityHumanReview;

  compliance_flags?: ComplianceFlag[];

  dataset_readiness_required?: boolean;
  dataset_readiness_reason?: string;
  minimum_dataset_needed?: string;

  suggested_phase: RegistryPhase;
  suggested_delivery_phase: OpportunityDeliveryPhase;

  priority: OpportunityPriority;
  build_complexity: OpportunityComplexity;
  business_impact: OpportunityImpact;

  confidence: number;
}

export interface AiOpportunityDesignV1 {
  version: "1.0.0";
  source_brief_version?: string;
  sector_context: {
    primary_sector?: string;
    sub_vertical?: string;
    confidence?: number;
    sector_assumptions?: string[];
  };
  opportunity_candidates: OpportunityCandidate[];
  coverage_analysis: {
    catalysts_without_opportunity: string[];
    data_assets_without_opportunity: string[];
    pains_without_opportunity: string[];
    decision_points_without_opportunity: string[];
  };
  warnings: Array<{ code: string; message: string; severity: "info" | "warning" | "error" }>;
  _meta?: { generated: boolean; error?: string; truncated_fields?: string[] };
}

// ── Límites duros ────────────────────────────────────────────────────

const LIMITS = {
  opportunities: 30,
  source_quotes_per_op: 8,
  description_chars: 500,
  justification_chars: 800,
  business_job_chars: 300,
  name_chars: 120,
  required_data_items: 12,
  suggested_rags: 6,
  suggested_agents: 6,
  suggested_forms: 6,
  suggested_external_sources: 8,
  coverage_items: 30,
  warnings: 30,
};

const ORIGIN_VALUES = new Set<OpportunityOrigin>([
  "client_requested",
  "inferred_need",
  "unrequested_ai_insight",
  "business_catalyst_activation",
  "data_asset_activation",
  "sector_pattern",
  "technical_dependency",
  "compliance_required",
]);
const PRIORITY_VALUES = new Set<OpportunityPriority>([
  "P0_critical", "P1_high", "P2_medium", "P3_low", "deferred",
]);
const COMPLEXITY_VALUES = new Set<OpportunityComplexity>([
  "trivial", "low", "medium", "high", "very_high",
]);
const IMPACT_VALUES = new Set<OpportunityImpact>([
  "low", "medium", "high", "critical", "transformational",
]);
const SOUL_VALUES = new Set<OpportunitySoulDependency>([
  "none", "consults_soul", "requires_soul_approval", "soul_owned",
]);
const HR_VALUES = new Set<OpportunityHumanReview>([
  "none", "optional", "recommended", "mandatory", "mandatory_with_veto",
]);
const DELIVERY_VALUES = new Set<OpportunityDeliveryPhase>([
  "data_foundation", "MVP", "F2", "F3", "roadmap", "rejected",
]);
const FAMILY_VALUES = new Set<ComponentFamily>(COMPONENT_FAMILIES);
const LAYER_VALUES = new Set<RegistryLayer>(REGISTRY_LAYERS);
const PHASE_VALUES = new Set<RegistryPhase>(REGISTRY_PHASES);
const COMPLIANCE_SET = new Set<ComplianceFlag>(COMPLIANCE_FLAGS);

// ── Helpers ──────────────────────────────────────────────────────────

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function truncate(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  if (s.length <= max) return s;
  return s.substring(0, max - 1) + "…";
}

function pickEnum<T>(v: unknown, set: Set<T>, fallback: T): T {
  return typeof v === "string" && set.has(v as unknown as T) ? (v as unknown as T) : fallback;
}

function clampNumber(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// ── Hardening: name derivation + confidence normalization ────────────

const FAMILY_NAME_FALLBACK: Partial<Record<ComponentFamily, string>> = {
  rag: "RAG funcional",
  agent: "Agente especialista",
  data_pipeline: "Pipeline de datos",
  matching_engine: "Motor de matching",
  prediction_engine: "Motor predictivo",
  scoring_engine: "Motor de scoring",
  deterministic_engine: "Motor determinista",
  pattern_module: "Módulo de patrones",
  soul_module: "Soul del fundador",
  compliance_module: "Gobernanza y compliance",
  orchestrator: "Orquestador",
  workflow: "Workflow operativo",
  dashboard: "Dashboard analítico",
  form: "Formulario funcional",
  integration: "Integración externa",
  non_ai_crud: "Componente CRUD",
};

function firstShortSentence(s: unknown, maxWords = 10, maxChars = 90): string {
  if (typeof s !== "string") return "";
  const cleaned = s.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  // Cortar en signo de puntuación fuerte para quedarnos con la primera frase.
  const cut = cleaned.split(/[.!?:;]/)[0]?.trim() ?? cleaned;
  const words = cut.split(/\s+/).slice(0, maxWords).join(" ");
  return truncate(words, maxChars).replace(/[…]+$/, "").trim();
}

/**
 * Deriva un nombre humano para una oportunidad cuando el LLM NO lo emitió.
 *
 * Orden de preferencia:
 *   1. raw.name (si no vacío y no parece COMP-XXX)
 *   2. raw.signal_name | raw.item | raw.title
 *   3. Primera frase corta de raw.business_job
 *   4. Primera frase corta de raw.description
 *   5. Fallback por family
 *   6. `Oportunidad N`
 *
 * Reglas:
 *   - máx 10 palabras / 90 chars
 *   - sin saltos de línea
 *   - nunca string vacío
 *   - nunca prefijo COMP-XXX
 */
export function deriveOpportunityName(raw: any, index: number): string {
  const tryClean = (s: unknown): string => {
    if (typeof s !== "string") return "";
    const t = s.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
    if (!t) return "";
    if (/^COMP-/i.test(t)) return "";
    const words = t.split(/\s+/).slice(0, 10).join(" ");
    return truncate(words, 90).replace(/[…]+$/, "").trim();
  };

  const candidates = [
    tryClean(raw?.name),
    tryClean(raw?.signal_name),
    tryClean(raw?.item),
    tryClean(raw?.title),
    firstShortSentence(raw?.business_job),
    firstShortSentence(raw?.description),
  ];
  for (const c of candidates) {
    if (c && c.length > 0) return c;
  }

  const fam = typeof raw?.recommended_component_family === "string"
    ? raw.recommended_component_family as ComponentFamily
    : undefined;
  if (fam && FAMILY_NAME_FALLBACK[fam]) return FAMILY_NAME_FALLBACK[fam]!;

  return `Oportunidad ${index + 1}`;
}

/**
 * Normaliza confidence a number [0..1] usando evidence_strength como ancla
 * cuando el LLM no lo emite o lo emite como string inválido.
 */
export function normalizeConfidence(rawConfidence: unknown, evidenceStrength?: string): number {
  // 1. Number directo válido
  if (typeof rawConfidence === "number" && Number.isFinite(rawConfidence)) {
    return Math.min(1, Math.max(0, rawConfidence));
  }
  // 2. String parseable
  if (typeof rawConfidence === "string" && rawConfidence.trim().length > 0) {
    const parsed = Number(rawConfidence);
    if (Number.isFinite(parsed)) {
      return Math.min(1, Math.max(0, parsed));
    }
  }
  // 3. Anclado por evidence_strength
  switch (evidenceStrength) {
    case "high": return 0.85;
    case "medium": return 0.65;
    case "low": return 0.4;
    default: return 0.6;
  }
}

function clampStringArray(arr: unknown, max: number, charLimit = 200): string[] {
  return asArray<unknown>(arr)
    .map((x) => (typeof x === "string" ? x : ""))
    .filter((s) => s.length > 0)
    .map((s) => truncate(s, charLimit))
    .slice(0, max);
}

function clampSourceQuotes(arr: unknown): OpportunitySourceQuote[] {
  return asArray<any>(arr)
    .slice(0, LIMITS.source_quotes_per_op)
    .map((q) => {
      if (typeof q === "string") return { quote: truncate(q, LIMITS.description_chars) };
      return {
        quote: truncate(q?.quote ?? q?.text ?? "", LIMITS.description_chars),
        speaker: typeof q?.speaker === "string" ? truncate(q.speaker, 80) : undefined,
        timestamp: typeof q?.timestamp === "string" ? truncate(q.timestamp, 40) : undefined,
        source_type: typeof q?.source_type === "string" ? q.source_type : undefined,
      };
    })
    .filter((q) => q.quote.length > 0);
}

function clampComplianceFlags(arr: unknown): ComplianceFlag[] {
  return asArray<unknown>(arr)
    .filter((x): x is ComplianceFlag => typeof x === "string" && COMPLIANCE_SET.has(x as ComplianceFlag))
    .slice(0, COMPLIANCE_FLAGS.length);
}

function clampCandidate(raw: any, idx: number): { candidate: OpportunityCandidate; nameDerived: boolean } {
  const family = pickEnum<ComponentFamily>(raw?.recommended_component_family, FAMILY_VALUES, "non_ai_crud");
  const layer = pickEnum<RegistryLayer>(raw?.recommended_layer, LAYER_VALUES, "B_action");

  // Forzar IDs OPP-XXX. NUNCA COMP-XXX (regla F2).
  const rawId = typeof raw?.opportunity_id === "string" ? raw.opportunity_id : "";
  const safeId = /^OPP-\d{3,}$/i.test(rawId)
    ? rawId.toUpperCase()
    : `OPP-${String(idx + 1).padStart(3, "0")}`;

  // Detectar si el LLM emitió un name válido o si toca derivarlo.
  const llmRawName = typeof raw?.name === "string" ? raw.name.trim() : "";
  const llmHasValidName = llmRawName.length > 0 && !/^COMP-/i.test(llmRawName);
  const finalName = llmHasValidName
    ? truncate(llmRawName.replace(/[\r\n]+/g, " ").replace(/\s+/g, " "), LIMITS.name_chars)
    : deriveOpportunityName(raw, idx);
  const nameDerived = !llmHasValidName;

  const evidenceStrength = pickEnum<"low" | "medium" | "high">(
    raw?.evidence_strength,
    new Set(["low", "medium", "high"] as const),
    "medium",
  );

  const candidate: OpportunityCandidate = {
    opportunity_id: safeId,
    name: finalName,
    description: truncate(raw?.description ?? "", LIMITS.description_chars),

    origin: pickEnum<OpportunityOrigin>(raw?.origin, ORIGIN_VALUES, "inferred_need"),

    evidence_strength: evidenceStrength,
    source_quotes: clampSourceQuotes(raw?.source_quotes),

    recommended_component_family: family,
    recommended_layer: layer,

    business_job: truncate(raw?.business_job ?? "", LIMITS.business_job_chars),
    business_justification: truncate(raw?.business_justification ?? "", LIMITS.justification_chars),

    business_catalysts_covered: asArray<any>(raw?.business_catalysts_covered)
      .slice(0, 10)
      .map((c) => ({
        catalyst_id: typeof c?.catalyst_id === "string" ? c.catalyst_id : undefined,
        name: truncate(c?.name ?? "", 200),
      }))
      .filter((c) => c.name.length > 0),
    data_assets_activated: asArray<any>(raw?.data_assets_activated)
      .slice(0, 10)
      .map((c) => ({
        asset_id: typeof c?.asset_id === "string" ? c.asset_id : undefined,
        name: truncate(c?.name ?? "", 200),
        kind: typeof c?.kind === "string" ? c.kind : undefined,
      }))
      .filter((c) => c.name.length > 0),
    economic_pains_addressed: asArray<any>(raw?.economic_pains_addressed)
      .slice(0, 10)
      .map((c) => ({
        pain_id: typeof c?.pain_id === "string" ? c.pain_id : undefined,
        name: truncate(c?.name ?? "", 200),
        magnitude: typeof c?.magnitude === "string" ? c.magnitude : undefined,
      }))
      .filter((c) => c.name.length > 0),

    required_data: clampStringArray(raw?.required_data, LIMITS.required_data_items, 200),

    suggested_rags: asArray<any>(raw?.suggested_rags)
      .slice(0, LIMITS.suggested_rags)
      .map((r) => ({
        name: truncate(r?.name ?? "", 200),
        scope: truncate(r?.scope ?? "", 300),
        freshness: typeof r?.freshness === "string" ? r.freshness : undefined,
      }))
      .filter((r) => r.name.length > 0),
    suggested_agents: asArray<any>(raw?.suggested_agents)
      .slice(0, LIMITS.suggested_agents)
      .map((a) => ({
        role: truncate(a?.role ?? "", 200),
        tools: clampStringArray(a?.tools, 10, 100),
      }))
      .filter((a) => a.role.length > 0),
    suggested_forms: asArray<any>(raw?.suggested_forms)
      .slice(0, LIMITS.suggested_forms)
      .map((f) => ({
        purpose: truncate(f?.purpose ?? "", 200),
        fields: clampStringArray(f?.fields, 20, 80),
      }))
      .filter((f) => f.purpose.length > 0),
    suggested_external_sources: asArray<any>(raw?.suggested_external_sources)
      .slice(0, LIMITS.suggested_external_sources)
      .map((s) => ({
        name: truncate(s?.name ?? "", 200),
        url: typeof s?.url === "string" ? truncate(s.url, 400) : undefined,
        reason: truncate(s?.reason ?? "", 300),
      }))
      .filter((s) => s.name.length > 0),
    suggested_moe_route: raw?.suggested_moe_route && typeof raw.suggested_moe_route === "object"
      ? {
          router: truncate(raw.suggested_moe_route.router ?? "", 200),
          experts: clampStringArray(raw.suggested_moe_route.experts, 10, 100),
          fallback: typeof raw.suggested_moe_route.fallback === "string"
            ? truncate(raw.suggested_moe_route.fallback, 200)
            : undefined,
        }
      : undefined,

    soul_dependency: pickEnum<OpportunitySoulDependency>(raw?.soul_dependency, SOUL_VALUES, "none"),
    human_review: pickEnum<OpportunityHumanReview>(raw?.human_review, HR_VALUES, "optional"),

    compliance_flags: clampComplianceFlags(raw?.compliance_flags),

    dataset_readiness_required: typeof raw?.dataset_readiness_required === "boolean"
      ? raw.dataset_readiness_required
      : undefined,
    dataset_readiness_reason: typeof raw?.dataset_readiness_reason === "string"
      ? truncate(raw.dataset_readiness_reason, 400)
      : undefined,
    minimum_dataset_needed: typeof raw?.minimum_dataset_needed === "string"
      ? truncate(raw.minimum_dataset_needed, 400)
      : undefined,

    suggested_phase: pickEnum<RegistryPhase>(raw?.suggested_phase, PHASE_VALUES, "F3_registry_builder"),
    suggested_delivery_phase: pickEnum<OpportunityDeliveryPhase>(
      raw?.suggested_delivery_phase, DELIVERY_VALUES, "MVP",
    ),

    priority: pickEnum<OpportunityPriority>(raw?.priority, PRIORITY_VALUES, "P2_medium"),
    build_complexity: pickEnum<OpportunityComplexity>(raw?.build_complexity, COMPLEXITY_VALUES, "medium"),
    business_impact: pickEnum<OpportunityImpact>(raw?.business_impact, IMPACT_VALUES, "medium"),

    confidence: clampNumber(raw?.confidence, 0, 1, 0.5),
  };
}

// ── API pública ──────────────────────────────────────────────────────

export function emptyOpportunityDesign(error?: string): AiOpportunityDesignV1 {
  return {
    version: "1.0.0",
    sector_context: {},
    opportunity_candidates: [],
    coverage_analysis: {
      catalysts_without_opportunity: [],
      data_assets_without_opportunity: [],
      pains_without_opportunity: [],
      decision_points_without_opportunity: [],
    },
    warnings: [],
    _meta: { generated: false, error },
  };
}

/**
 * Aplica límites duros y normaliza. Pure function, exportada para tests.
 * Garantiza:
 *   - opportunity_id único con prefijo OPP-XXX (renumera duplicados/colisiones).
 *   - Enums siempre válidos (caen a defaults seguros).
 *   - Sin claves prohibidas (component_id, components, ComponentRegistryItem).
 */
export function clampOpportunityDesign(raw: any): AiOpportunityDesignV1 {
  const truncatedFields: string[] = [];
  const rawCandidates = asArray<any>(raw?.opportunity_candidates);
  if (rawCandidates.length > LIMITS.opportunities) truncatedFields.push("opportunity_candidates");

  // Strip claves prohibidas si vinieron del LLM
  const r = (raw && typeof raw === "object") ? { ...raw } : {};
  delete (r as any).components;
  delete (r as any).component_registry;
  delete (r as any).ComponentRegistryItem;

  const sliced = rawCandidates.slice(0, LIMITS.opportunities);
  const candidates: OpportunityCandidate[] = [];
  const usedIds = new Set<string>();

  for (let i = 0; i < sliced.length; i++) {
    const c = clampCandidate(sliced[i], i);
    // Dedup IDs
    let id = c.opportunity_id;
    if (usedIds.has(id)) {
      let n = i + 1;
      while (usedIds.has(`OPP-${String(n).padStart(3, "0")}`)) n++;
      id = `OPP-${String(n).padStart(3, "0")}`;
    }
    usedIds.add(id);
    // Strip claves prohibidas a nivel item por si el LLM las metió
    const cleaned = { ...c, opportunity_id: id } as any;
    delete cleaned.component_id;
    delete cleaned.components;
    candidates.push(cleaned);
  }

  const coverage = (raw?.coverage_analysis && typeof raw.coverage_analysis === "object") ? raw.coverage_analysis : {};
  const warnings = asArray<any>(raw?.warnings)
    .slice(0, LIMITS.warnings)
    .map((w) => ({
      code: truncate(w?.code ?? "WARNING", 80),
      message: truncate(w?.message ?? "", 400),
      severity: pickEnum<"info" | "warning" | "error">(
        w?.severity,
        new Set(["info", "warning", "error"] as const),
        "warning",
      ),
    }))
    .filter((w) => w.message.length > 0);

  return {
    version: "1.0.0",
    source_brief_version: typeof raw?.source_brief_version === "string"
      ? truncate(raw.source_brief_version, 40)
      : undefined,
    sector_context: {
      primary_sector: typeof raw?.sector_context?.primary_sector === "string"
        ? truncate(raw.sector_context.primary_sector, 120) : undefined,
      sub_vertical: typeof raw?.sector_context?.sub_vertical === "string"
        ? truncate(raw.sector_context.sub_vertical, 120) : undefined,
      confidence: clampNumber(raw?.sector_context?.confidence, 0, 1, 0.5),
      sector_assumptions: clampStringArray(raw?.sector_context?.sector_assumptions, 10, 300),
    },
    opportunity_candidates: candidates,
    coverage_analysis: {
      catalysts_without_opportunity: clampStringArray(coverage.catalysts_without_opportunity, LIMITS.coverage_items, 200),
      data_assets_without_opportunity: clampStringArray(coverage.data_assets_without_opportunity, LIMITS.coverage_items, 200),
      pains_without_opportunity: clampStringArray(coverage.pains_without_opportunity, LIMITS.coverage_items, 200),
      decision_points_without_opportunity: clampStringArray(coverage.decision_points_without_opportunity, LIMITS.coverage_items, 200),
    },
    warnings,
    _meta: { generated: true, truncated_fields: truncatedFields.length > 0 ? truncatedFields : undefined },
  };
}

export interface OpportunityValidationIssue {
  code: string;
  severity: "warning" | "error";
  message: string;
  opportunity_id?: string;
}

/**
 * Validador puro post-clamp. NO modifica el design.
 * Detecta:
 *   - IDs duplicados.
 *   - IDs con prefijo COMP-* (prohibido en F2).
 *   - Claves prohibidas a nivel item (component_id, components).
 *   - Familias/capas inválidas (debería ya haber sido normalizado por clamp,
 *     pero validamos por defensa en profundidad).
 */
export function validateOpportunityDesign(design: AiOpportunityDesignV1): OpportunityValidationIssue[] {
  const issues: OpportunityValidationIssue[] = [];
  const seen = new Map<string, number>();
  for (const c of design.opportunity_candidates) {
    seen.set(c.opportunity_id, (seen.get(c.opportunity_id) ?? 0) + 1);

    if (/^COMP-/i.test(c.opportunity_id)) {
      issues.push({
        code: "F2_FORBIDDEN_COMP_PREFIX",
        severity: "error",
        message: `Opportunity con prefijo COMP- (prohibido en F2): ${c.opportunity_id}`,
        opportunity_id: c.opportunity_id,
      });
    }
    const ic = c as unknown as Record<string, unknown>;
    if ("component_id" in ic) {
      issues.push({
        code: "F2_FORBIDDEN_COMPONENT_ID",
        severity: "error",
        message: `Opportunity con campo prohibido component_id: ${c.opportunity_id}`,
        opportunity_id: c.opportunity_id,
      });
    }
    if ("components" in ic) {
      issues.push({
        code: "F2_FORBIDDEN_COMPONENTS",
        severity: "error",
        message: `Opportunity con campo prohibido components: ${c.opportunity_id}`,
        opportunity_id: c.opportunity_id,
      });
    }
    if (!FAMILY_VALUES.has(c.recommended_component_family)) {
      issues.push({
        code: "F2_INVALID_FAMILY",
        severity: "error",
        message: `Familia inválida en ${c.opportunity_id}: ${c.recommended_component_family}`,
        opportunity_id: c.opportunity_id,
      });
    }
    if (!LAYER_VALUES.has(c.recommended_layer)) {
      issues.push({
        code: "F2_INVALID_LAYER",
        severity: "error",
        message: `Capa inválida en ${c.opportunity_id}: ${c.recommended_layer}`,
        opportunity_id: c.opportunity_id,
      });
    }
  }
  for (const [id, count] of seen.entries()) {
    if (count > 1) {
      issues.push({
        code: "F2_DUPLICATE_OPPORTUNITY_ID",
        severity: "error",
        message: `opportunity_id duplicado (${count}x): ${id}`,
        opportunity_id: id,
      });
    }
  }
  return issues;
}

// ── Prompt + runner ──────────────────────────────────────────────────

const F2_SYSTEM_PROMPT = `Eres un Senior AI-native Solutions Architect actuando como AI OPPORTUNITY DESIGNER (Fase F2).

Tu misión es convertir el brief del cliente (business_extraction_v2 + _f0_signals) en oportunidades IA-nativas accionables. NO eres aún el Component Registry Builder — solo diseñas oportunidades.

REGLAS DURAS — INVIOLABLES:
1. Usa SIEMPRE IDs con prefijo "OPP-" seguido de 3 dígitos (OPP-001, OPP-002, ...). PROHIBIDO el prefijo "COMP-".
2. PROHIBIDO emitir las claves "component_id", "components", "component_registry", "ComponentRegistryItem".
3. PROHIBIDO el campo "approved_for_scope" o cualquier status de aprobación. F2 NO aprueba scope.
4. NO inventes fórmulas para motores de Capa C (scoring/matching/prediction). Si requieren dataset, marca dataset_readiness_required=true y describe minimum_dataset_needed.
5. Si una necesidad NO requiere IA, marca recommended_component_family="non_ai_crud".
6. Si detectas una oportunidad que el cliente NO pidió pero claramente aporta valor, márcala con origin="unrequested_ai_insight".
7. Si una oportunidad procesa datos personales, hace profiling, prioriza comercialmente personas físicas, o enriquece con fuentes externas, añade los compliance_flags correspondientes y human_review mínimo "recommended".
8. NO generes SQL, NO generes PRD, NO generes prompts de otros agentes.

CATEGORÍAS A CUBRIR (no todas son obligatorias en cada caso, depende del brief):
A. RAGs funcionales del producto (no el RAG interno del proyecto): RAG de llamadas, propietarios, compradores, documentación legal, Soul.
B. Agentes especialistas: clasificadores, analizadores, preparadores de llamada, generadores de copy, extractores.
C. Motores deterministas: detectores de eventos, reglas de alerta, validadores, workflows no-LLM.
D. Motores Capa C: scoring, matching, predicción, ranking, anomaly detection (siempre dataset_readiness_required).
E. Formularios necesarios.
F. Fuentes externas (BOE, BORME, esquelas, ayuntamientos, APIs sectoriales).
G. MoE / routing.
H. Soul (módulos que dependen del criterio del fundador/CEO).
I. Compliance / governance (DPIA, legal basis, human-in-the-loop, retención).

ENUMS PERMITIDAS (úsalas literalmente):
- origin: client_requested | inferred_need | unrequested_ai_insight | business_catalyst_activation | data_asset_activation | sector_pattern | technical_dependency | compliance_required
- recommended_component_family: rag | agent | orchestrator | deterministic_engine | scoring_engine | matching_engine | prediction_engine | pattern_module | form | integration | workflow | dashboard | soul_module | compliance_module | data_pipeline | non_ai_crud
- recommended_layer: A_knowledge | B_action | C_intelligence | D_soul | E_interface | F_integration | G_governance
- soul_dependency: none | consults_soul | requires_soul_approval | soul_owned
- human_review: none | optional | recommended | mandatory | mandatory_with_veto
- compliance_flags: personal_data_processing | profiling | automated_decision_support | commercial_prioritization | external_data_enrichment | sensitive_data | children_data | financial_data | health_data | employment_data | large_scale_monitoring | scraping_public_sources | legal_basis_required | data_retention_required | human_in_the_loop_required | gdpr_article_22_risk
- suggested_phase: F0_signal_preservation | F1_business_extraction | F2_ai_opportunity_designer | F3_registry_builder | F4a_registry_gap_audit | F4b_feasibility_audit | F5_scope_architect | F6_sector_pattern_detector | F7_prd_generator | F8_client_deliverables
- suggested_delivery_phase: data_foundation | MVP | F2 | F3 | roadmap | rejected
- priority: P0_critical | P1_high | P2_medium | P3_low | deferred
- build_complexity: trivial | low | medium | high | very_high
- business_impact: low | medium | high | critical | transformational
- evidence_strength: low | medium | high

LÍMITES MÁXIMOS:
- opportunity_candidates: máximo 30
- description: ≤ 500 chars
- business_justification: ≤ 800 chars
- business_job: ≤ 300 chars
- source_quotes por oportunidad: ≤ 8
- required_data: ≤ 12 items

Devuelve SOLO JSON válido (sin markdown, sin backticks) con esta estructura:
{
  "version": "1.0.0",
  "source_brief_version": "...",
  "sector_context": { "primary_sector": "...", "sub_vertical": "...", "confidence": 0..1, "sector_assumptions": [] },
  "opportunity_candidates": [ ... ],
  "coverage_analysis": {
    "catalysts_without_opportunity": [],
    "data_assets_without_opportunity": [],
    "pains_without_opportunity": [],
    "decision_points_without_opportunity": []
  },
  "warnings": [ { "code": "...", "message": "...", "severity": "info|warning|error" } ]
}`;

export interface F2ProjectContext {
  projectName?: string;
  companyName?: string;
  projectType?: string;
}

function parseJsonLoose(text: string): any {
  let cleaned = (text || "").trim();
  cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/gm, "").replace(/\n?```\s*$/gm, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first !== -1 && last > first) {
      try { return JSON.parse(cleaned.substring(first, last + 1)); } catch { return null; }
    }
    return null;
  }
}

/**
 * Ejecuta F2 contra el LLM. Devuelve un design ya pasado por clamp.
 * En cualquier error devuelve `emptyOpportunityDesign(error)`.
 */
export async function runF2OpportunityDesigner(
  briefing: any,
  ctx?: F2ProjectContext,
): Promise<AiOpportunityDesignV1> {
  if (!briefing || typeof briefing !== "object") {
    return emptyOpportunityDesign("empty_briefing");
  }

  const v2 = briefing.business_extraction_v2 ?? null;
  const f0 = briefing._f0_signals ?? null;

  // Hard cap input para no quemar prompt budget.
  const v2Str = v2 ? JSON.stringify(v2).substring(0, 60_000) : "(no business_extraction_v2)";
  const f0Str = f0 ? JSON.stringify(f0).substring(0, 30_000) : "(no _f0_signals)";

  // Campos legacy útiles para contexto narrativo.
  const projSummary = briefing.project_summary ? JSON.stringify(briefing.project_summary).substring(0, 4000) : "";

  const ctxLine = ctx
    ? `Proyecto: ${ctx.projectName ?? "?"} | Cliente: ${ctx.companyName ?? "?"} | Tipo: ${ctx.projectType ?? "?"}`
    : "Proyecto: (sin contexto)";

  const userPrompt = `${ctxLine}

PROJECT_SUMMARY (legacy):
${projSummary}

BUSINESS_EXTRACTION_V2:
${v2Str}

F0_SIGNALS:
${f0Str}

Diseña las oportunidades IA-nativas siguiendo las REGLAS DURAS y enums permitidas. Devuelve SOLO el JSON.`;

  try {
    const result = await callGeminiFlash(F2_SYSTEM_PROMPT, userPrompt);
    const parsed = parseJsonLoose(result.text);
    if (!parsed || typeof parsed !== "object") {
      console.warn("[F2] JSON parse failed");
      return emptyOpportunityDesign("parse_failed");
    }
    const clamped = clampOpportunityDesign(parsed);
    if (briefing.brief_version && !clamped.source_brief_version) {
      clamped.source_brief_version = String(briefing.brief_version);
    }
    return clamped;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[F2] LLM error: ${msg}`);
    return emptyOpportunityDesign(msg);
  }
}
