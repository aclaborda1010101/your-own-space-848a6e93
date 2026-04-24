/**
 * f3-registry-builder.ts — Pipeline v2 · Fase F3
 *
 * Convierte `AiOpportunityDesignV1` (output de F2) en un `ComponentRegistry`
 * canónico usando el contrato `_shared/component-registry-contract.ts`.
 *
 * F3 es 100% DETERMINISTA — no usa LLM. F2 ya hizo el trabajo creativo.
 *
 * Reglas críticas (verificadas también por validateComponentRegistry):
 *   1. F3 NO aprueba alcance: PROHIBIDO emitir status "approved_for_scope".
 *   2. No fórmula sin dataset: si family ∈ LAYER_C_DATASET_REQUIRED_FAMILIES o
 *      es Capa C predictiva sin datos suficientes → status "requires_human_review"
 *      + dataset_requirements + sin fórmula.
 *   3. DPIA trigger: si hay flags de DPIA → item.dpia_required=true y
 *      registry.dpia.required=true con trigger_flags.
 *   4. Naming collision: usar checkNamingCollision; flagear, no bloquear.
 *   5. Evidence traceability: cada item necesita ≥1 de {source_quotes,
 *      business_justification, catalysts, data_assets, economic_pains}.
 *   6. Deduplicación: oportunidades similares (Jaccard sobre nombre + misma
 *      family) se fusionan en un único componente.
 *   7. Human-in-the-loop: profiling/scoring/decisión sobre personas
 *      → human_review mínimo "recommended"; alto riesgo → "mandatory".
 */

import {
  appendMutation,
  COMPLIANCE_FLAGS,
  createEmptyComponentRegistry,
  DPIA_TRIGGER_FLAGS,
  LAYER_C_DATASET_REQUIRED_FAMILIES,
  requiresDatasetReadiness,
  validateComponentRegistry,
} from "../_shared/component-registry-contract.ts";
import type {
  ComplianceFlag,
  ComponentFamily,
  ComponentRegistry,
  ComponentRegistryItem,
  EvidenceType,
  HumanReviewPolicy,
  RegistryLayer,
  RegistryStatus,
  RegistryValidationIssue,
} from "../_shared/component-registry-contract.ts";
import type {
  AiOpportunityDesignV1,
  OpportunityCandidate,
  OpportunityHumanReview,
  OpportunityOrigin,
} from "./f2-ai-opportunity-designer.ts";

// ── Tipos del builder ────────────────────────────────────────────────

export interface F3BuildContext {
  projectId?: string;
  clientCompanyName: string;
  productName?: string;
  businessModelSummary?: string;
}

export interface F3BuildWarning {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  opportunity_id?: string;
  component_id?: string;
}

export interface F3BuildResult {
  registry: ComponentRegistry;
  warnings: F3BuildWarning[];
  validation_issues: RegistryValidationIssue[];
  merged_opportunities: Array<{ canonical_id: string; merged_ids: string[] }>;
}

// ── Utils ────────────────────────────────────────────────────────────

const HUMAN_REVIEW_RANK: Record<HumanReviewPolicy, number> = {
  none: 0, optional: 1, recommended: 2, mandatory: 3, mandatory_with_veto: 4,
};

function maxHumanReview(a: HumanReviewPolicy, b: HumanReviewPolicy): HumanReviewPolicy {
  return HUMAN_REVIEW_RANK[a] >= HUMAN_REVIEW_RANK[b] ? a : b;
}

function normalizeName(s: string): string {
  return (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 3) // descarta stopwords cortas
    .filter((w) => !STOPWORDS.has(w))
    .join(" ");
}

const STOPWORDS = new Set([
  "para", "con", "sin", "del", "los", "las", "una", "uno", "que", "por",
  "the", "and", "for", "from", "with", "into",
]);

function tokens(s: string): Set<string> {
  return new Set(normalizeName(s).split(/\s+/).filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

const LAYER_TO_LETTER: Record<RegistryLayer, string> = {
  A_knowledge: "A",
  B_action: "B",
  C_intelligence: "C",
  D_soul: "D",
  E_interface: "E",
  F_integration: "F",
  G_governance: "G",
};

// Mapping origin (F2) → evidence_type (contrato)
const ORIGIN_TO_EVIDENCE: Record<OpportunityOrigin, EvidenceType> = {
  client_requested: "client_requested",
  inferred_need: "inferred_need",
  unrequested_ai_insight: "unrequested_ai_insight",
  business_catalyst_activation: "business_catalyst_activation",
  data_asset_activation: "data_asset_activation",
  sector_pattern: "sector_pattern",
  technical_dependency: "technical_dependency",
  compliance_required: "compliance_required",
};

// ── Reglas puras exportadas (testables) ──────────────────────────────

/** Asigna un component_id `COMP-{LETTER}{NN}` libre dentro del counter por capa. */
export function assignComponentId(
  layer: RegistryLayer,
  counters: Record<string, number>,
): string {
  const letter = LAYER_TO_LETTER[layer] ?? "X";
  counters[letter] = (counters[letter] ?? 0) + 1;
  return `COMP-${letter}${String(counters[letter]).padStart(2, "0")}`;
}

/** Mapea OpportunityHumanReview → HumanReviewPolicy (mismas etiquetas). */
function mapHumanReview(hr: OpportunityHumanReview): HumanReviewPolicy {
  return hr as HumanReviewPolicy;
}

/**
 * Aplica reglas de dataset readiness:
 *   - Si requiresDatasetReadiness(item) = true Y no tiene dataset_requirements
 *     completos → status "requires_human_review" + añade un dataset_requirement
 *     placeholder para forzar el plan de datos.
 *   - Nunca genera fórmula (la fórmula no existe en el item; este builder
 *     no la introduce).
 */
export function applyDatasetRules(
  item: ComponentRegistryItem,
  opp?: OpportunityCandidate,
): { item: ComponentRegistryItem; warning?: F3BuildWarning } {
  if (!requiresDatasetReadiness(item)) return { item };

  const reqs = item.dataset_requirements ?? [];
  const valid = reqs.find(
    (r) =>
      r.minimum_sample_size !== undefined &&
      typeof r.historical_data_needed === "string" &&
      r.historical_data_needed.length > 0 &&
      typeof r.validation_method === "string" &&
      r.validation_method.length > 0 &&
      typeof r.abstention_policy === "string" &&
      r.abstention_policy.length > 0,
  );

  if (valid) return { item };

  const placeholder = {
    type: "historical" as const,
    minimum_sample_size: undefined,
    historical_data_needed: opp?.minimum_dataset_needed
      || opp?.dataset_readiness_reason
      || "Dataset histórico mínimo a definir antes de implementar fórmula.",
    validation_method: "Hold-out + métrica supervisada por humano.",
    abstention_policy: "Si confianza < umbral o muestra insuficiente, abstenerse y derivar a humano.",
    notes: "Plan de readiness generado por F3 — pendiente de completar por F4b.",
  };

  return {
    item: {
      ...item,
      status: "requires_human_review",
      dataset_requirements: [...reqs, placeholder],
    },
    warning: {
      code: "F3_DATASET_READINESS_FORCED_REVIEW",
      severity: "warning",
      message: `Componente ${item.component_id} (${item.family}) requiere dataset y no tiene plan completo — status forzado a requires_human_review.`,
      component_id: item.component_id,
    },
  };
}

/**
 * Aplica reglas de human-in-the-loop:
 *   - Si tiene profiling, automated_decision_support, commercial_prioritization,
 *     gdpr_article_22_risk o sensitive/children/health/financial/employment_data
 *     → human_review mínimo "recommended" (alto riesgo → "mandatory").
 */
export function applyHumanReviewRules(item: ComponentRegistryItem): ComponentRegistryItem {
  const flags = new Set(item.compliance_flags ?? []);
  const HIGH_RISK: ComplianceFlag[] = [
    "automated_decision_support", "gdpr_article_22_risk",
    "sensitive_data", "children_data", "health_data",
  ];
  const MEDIUM_RISK: ComplianceFlag[] = [
    "profiling", "commercial_prioritization",
    "financial_data", "employment_data", "large_scale_monitoring",
  ];

  let target: HumanReviewPolicy = item.human_review;
  if (HIGH_RISK.some((f) => flags.has(f))) {
    target = maxHumanReview(target, "mandatory");
  } else if (MEDIUM_RISK.some((f) => flags.has(f))) {
    target = maxHumanReview(target, "recommended");
  }

  if (target === item.human_review) return item;
  return { ...item, human_review: target };
}

/**
 * F3 NUNCA aprueba alcance: si por error llega `approved_for_scope`,
 * downgrade a `candidate_validated` y devuelve warning.
 */
export function enforceNoApproval(item: ComponentRegistryItem): {
  item: ComponentRegistryItem;
  warning?: F3BuildWarning;
} {
  if (item.status !== "approved_for_scope") return { item };
  return {
    item: { ...item, status: "candidate_validated" },
    warning: {
      code: "F3_FORBIDDEN_APPROVAL_DOWNGRADED",
      severity: "warning",
      message: `Componente ${item.component_id} llegó con status approved_for_scope — F3 lo bajó a candidate_validated. F3 no aprueba alcance.`,
      component_id: item.component_id,
    },
  };
}

/**
 * Aplica reglas DPIA al registry final:
 *   - Marca item.dpia_required=true si tiene flags ∈ DPIA_TRIGGER_FLAGS.
 *   - Si algún item dispara DPIA → registry.dpia = { required, trigger_flags, status }.
 */
export function applyDpiaRules(registry: ComponentRegistry): ComponentRegistry {
  const triggerSet = new Set<ComplianceFlag>(DPIA_TRIGGER_FLAGS);
  const allTriggered = new Set<ComplianceFlag>();
  let anyTriggered = false;

  const components = registry.components.map((c) => {
    const itemTriggered = (c.compliance_flags ?? []).filter((f) => triggerSet.has(f));
    if (itemTriggered.length > 0) {
      anyTriggered = true;
      for (const f of itemTriggered) allTriggered.add(f);
      return { ...c, dpia_required: true };
    }
    return c;
  });

  const out: ComponentRegistry = { ...registry, components };
  if (anyTriggered) {
    out.dpia = {
      required: true,
      trigger_flags: Array.from(allTriggered),
      status: "not_started",
      reason: "Componentes con flags de DPIA detectados por F3.",
    };
  } else {
    out.dpia = {
      required: false,
      trigger_flags: [],
      status: "not_required",
      reason: "Sin componentes con flags DPIA detectados por F3.",
    };
  }
  return out;
}

/**
 * Deduplica oportunidades por:
 *   - misma `recommended_component_family`
 *   - jaccard(name_tokens) >= 0.6  ó  contención de nombre normalizado
 *
 * Devuelve clusters: representante = primera oportunidad del cluster.
 */
export function dedupeOpportunities(
  opps: OpportunityCandidate[],
): { clusters: OpportunityCandidate[][]; mergedLog: Array<{ canonical_id: string; merged_ids: string[] }> } {
  const clusters: OpportunityCandidate[][] = [];
  const tokenCache = new Map<string, Set<string>>();
  const normCache = new Map<string, string>();

  const tk = (o: OpportunityCandidate) => {
    if (!tokenCache.has(o.opportunity_id)) tokenCache.set(o.opportunity_id, tokens(o.name));
    return tokenCache.get(o.opportunity_id)!;
  };
  const nm = (o: OpportunityCandidate) => {
    if (!normCache.has(o.opportunity_id)) normCache.set(o.opportunity_id, normalizeName(o.name));
    return normCache.get(o.opportunity_id)!;
  };

  for (const opp of opps) {
    let placed = false;
    for (const cluster of clusters) {
      const head = cluster[0];
      if (head.recommended_component_family !== opp.recommended_component_family) continue;
      const sim = jaccard(tk(head), tk(opp));
      const a = nm(head), b = nm(opp);
      const contains = a.length >= 5 && b.length >= 5 && (a.includes(b) || b.includes(a));
      if (sim >= 0.6 || contains) {
        cluster.push(opp);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([opp]);
  }

  const mergedLog = clusters
    .filter((c) => c.length > 1)
    .map((c) => ({
      canonical_id: c[0].opportunity_id,
      merged_ids: c.slice(1).map((o) => o.opportunity_id),
    }));

  return { clusters, mergedLog };
}

/**
 * Convierte una oportunidad (o un cluster fusionado) en un ComponentRegistryItem.
 * El primer elemento del cluster es el representante; los demás se mergean
 * (compliance_flags, source_quotes, justification anexada).
 */
export function convertOpportunityToRegistryItem(
  cluster: OpportunityCandidate[],
  componentId: string,
  phase: "F3_registry_builder" = "F3_registry_builder",
): ComponentRegistryItem {
  const head = cluster[0];

  // Merge auxiliar
  const sourceQuotes = cluster.flatMap((o) =>
    (o.source_quotes ?? []).map((q) => ({
      quote: q.quote,
      speaker: q.speaker,
      timestamp: q.timestamp,
      source_type: q.source_type,
    })),
  );
  const flagsSet = new Set<ComplianceFlag>();
  for (const o of cluster) for (const f of o.compliance_flags ?? []) flagsSet.add(f);

  const catalysts = cluster.flatMap((o) => o.business_catalysts_covered ?? []).map((c) => ({
    catalyst_id: c.catalyst_id ?? `CAT-${(c.name ?? "").substring(0, 8).toUpperCase()}`,
    name: c.name,
  }));
  const assets = cluster.flatMap((o) => o.data_assets_activated ?? []).map((a) => ({
    asset_id: a.asset_id ?? `ASSET-${(a.name ?? "").substring(0, 8).toUpperCase()}`,
    name: a.name,
    activation_note: a.kind,
  }));
  const pains = cluster.flatMap((o) => o.economic_pains_addressed ?? []).map((p) => ({
    pain_id: p.pain_id ?? `PAIN-${(p.name ?? "").substring(0, 8).toUpperCase()}`,
    description: p.name,
    estimated_impact_eur: undefined,
  }));

  const justification = cluster.length > 1
    ? `${head.business_justification}\n\n[Fusionado con: ${cluster.slice(1).map((o) => `${o.opportunity_id} ${o.name}`).join("; ")}]`
    : head.business_justification;

  // status inicial según evidencia (NUNCA approved_for_scope)
  let status: RegistryStatus;
  if (head.evidence_strength === "high") status = "candidate_validated";
  else if (head.suggested_delivery_phase === "rejected") status = "rejected";
  else if (head.suggested_delivery_phase === "roadmap") status = "deferred";
  else if (head.evidence_strength === "low") status = "requires_human_review";
  else status = "candidate_validated";

  const item: ComponentRegistryItem = {
    component_id: componentId,
    name: head.name,
    description: head.description,
    family: head.recommended_component_family as ComponentFamily,
    layer: head.recommended_layer as RegistryLayer,
    status,
    phase,
    priority: head.priority,
    business_job: head.business_job,
    business_justification: justification,
    evidence_type: ORIGIN_TO_EVIDENCE[head.origin] ?? "inferred_need",
    evidence_strength: head.evidence_strength,
    source_quotes: sourceQuotes,
    business_catalysts_covered: catalysts.length > 0 ? catalysts : undefined,
    data_assets_activated: assets.length > 0 ? assets : undefined,
    economic_pains_addressed: pains.length > 0 ? pains : undefined,
    input_data: head.required_data,
    output_data: undefined,
    required_rags: head.suggested_rags?.map((r) => ({
      name: r.name, purpose: r.scope, expected_corpus: r.freshness,
    })),
    required_agents: head.suggested_agents?.map((a, i) => ({
      name: `${head.name} · agent ${i + 1}`,
      role: a.role,
      tools: a.tools,
    })),
    required_forms: head.suggested_forms?.map((f, i) => ({
      name: `${head.name} · form ${i + 1}`,
      purpose: f.purpose,
      fields_summary: (f.fields ?? []).join(", ") || undefined,
    })),
    external_sources: head.suggested_external_sources?.map((s) => ({
      name: s.name,
      url: s.url,
      legal_basis_note: s.reason,
    })),
    moe_route: head.suggested_moe_route ? {
      experts: head.suggested_moe_route.experts,
      default_expert: head.suggested_moe_route.fallback,
      routing_criteria: head.suggested_moe_route.router,
    } : undefined,
    soul_dependency: head.soul_dependency,
    human_review: mapHumanReview(head.human_review),
    prerequisites: undefined,
    dataset_requirements: undefined,
    success_metric: undefined,
    acceptance_criteria: undefined,
    compliance_flags: flagsSet.size > 0 ? Array.from(flagsSet) : undefined,
    dpia_required: undefined, // applyDpiaRules lo set
    build_complexity: head.build_complexity,
    business_impact: head.business_impact === "critical" ? "high" : head.business_impact, // contrato no admite "critical"
    cost_estimate: undefined,
    mutation_history: [],
  };

  return item;
}

// ── Orquestador principal ────────────────────────────────────────────

/**
 * Construye un ComponentRegistry canónico a partir de un AiOpportunityDesignV1.
 * 100% determinista, sin LLM.
 */
export function buildRegistryFromDesign(
  design: AiOpportunityDesignV1,
  ctx: F3BuildContext,
): F3BuildResult {
  const warnings: F3BuildWarning[] = [];

  // 1. Registry vacío + naming check (ya hecho por createEmptyComponentRegistry).
  let registry = createEmptyComponentRegistry({
    client_company_name: ctx.clientCompanyName,
    product_name: ctx.productName,
    project_id: ctx.projectId,
  });

  if (ctx.businessModelSummary) registry.business_model_summary = ctx.businessModelSummary;
  if (design.sector_context?.primary_sector) {
    registry.sector = {
      primary_sector: design.sector_context.primary_sector,
      sub_vertical: design.sector_context.sub_vertical,
      confidence: design.sector_context.confidence,
    };
  }

  if (registry.naming_collision?.detected) {
    warnings.push({
      code: "F3_NAMING_COLLISION",
      severity: "warning",
      message: `Naming collision detectada: ${registry.naming_collision.reason ?? "(sin razón)"}`,
    });
  }

  // 2. Dedupe + asignación de IDs.
  const { clusters, mergedLog } = dedupeOpportunities(design.opportunity_candidates);
  for (const m of mergedLog) {
    warnings.push({
      code: "F3_OPPORTUNITIES_MERGED",
      severity: "info",
      message: `Fusionadas ${m.merged_ids.length + 1} oportunidades en un único componente (canonical: ${m.canonical_id}).`,
      opportunity_id: m.canonical_id,
    });
  }

  const counters: Record<string, number> = {};
  const components: ComponentRegistryItem[] = [];

  for (const cluster of clusters) {
    const layer = cluster[0].recommended_layer as RegistryLayer;
    const componentId = assignComponentId(layer, counters);
    let item = convertOpportunityToRegistryItem(cluster, componentId);

    // 3. enforceNoApproval (defensa en profundidad — ya fue forzado en convert).
    const noApp = enforceNoApproval(item);
    item = noApp.item;
    if (noApp.warning) warnings.push(noApp.warning);

    // 4. Dataset rules
    const dsRes = applyDatasetRules(item, cluster[0]);
    item = dsRes.item;
    if (dsRes.warning) warnings.push(dsRes.warning);

    // 5. Human-in-the-loop rules
    item = applyHumanReviewRules(item);

    // 6. Mutation history
    const reason = cluster.length > 1
      ? `Created from F2 opportunities ${cluster.map((o) => o.opportunity_id).join(", ")} (merged)`
      : `Created from F2 opportunity ${cluster[0].opportunity_id}`;
    item = appendMutation(item, {
      phase: "F3_registry_builder",
      action: "created",
      reason,
      new_status: item.status,
    });

    components.push(item);
  }

  registry.components = components;

  // 7. DPIA rules (recorre items, popula item.dpia_required y registry.dpia).
  registry = applyDpiaRules(registry);

  // 8. updated_at
  registry.updated_at = new Date().toISOString();

  // 9. Validación canónica
  const validation = validateComponentRegistry(registry);
  for (const issue of validation.issues) {
    warnings.push({
      code: `F3_VALIDATION_${issue.code}`,
      severity: issue.severity,
      message: issue.message,
      component_id: issue.component_id,
    });
  }

  return {
    registry,
    warnings,
    validation_issues: validation.issues,
    merged_opportunities: mergedLog,
  };
}
