/**
 * f5-deterministic-scope.ts — F5 Scope Architect deterministic pre-warm.
 *
 * Reads Step 25 component_registry, Step 26 registry_gap_audit_v1 (only via
 * Step 27 verdicts), Step 27 registry_feasibility_audit_v1, and the 3 human
 * decisions. Emits a partial `scope_architecture_v1` with components placed
 * into buckets (data_foundation / mvp / fast_follow_f2 / roadmap_f3 /
 * rejected_out_of_scope) and blockers attached.
 *
 * Hard rules (encoded here, not negotiable by the LLM):
 *
 *   • Decision 1 — Soul: COMP-D01 → data_foundation, status approved_for_scope,
 *     attach soul_capture_plan. B02/C04 must NOT have a hard Soul dependency.
 *     B03/C03 may consult Soul async / non-blocking.
 *   • Decision 2 — Benatar: any component named "Benatar" or with
 *     family === "institutional_buyer_detector" is forced to fast_follow_f2.
 *     Never MVP. Never rejected.
 *   • Decision 3 — DPIA: any component with compliance_flags
 *     (personal_data_processing, profiling, commercial_prioritization,
 *     external_data_enrichment) → status approved_with_conditions and
 *     blocker { type:"compliance", blocks_production:true, blocks_design:false }.
 *
 * Plus, F4b verdicts drive bucket assignment:
 *   • requires_compliance_review → MVP/data_foundation with compliance blocker.
 *   • requires_data_readiness → MVP with data_readiness blocker.
 *   • requires_poc → fast_follow_f2 with poc blocker.
 *   • defer → fast_follow_f2 (or roadmap_f3 if recommended_delivery_phase says so).
 *   • reject → rejected_out_of_scope.
 *   • simplify → keep in MVP, add simplify directive.
 *   • keep → MVP by default.
 *
 * Created: 2026-04-25
 */

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────

export type ScopeStatus =
  | "approved_for_scope"
  | "approved_with_conditions"
  | "deferred"
  | "rejected";

export type ScopeBucket =
  | "data_foundation"
  | "mvp"
  | "fast_follow_f2"
  | "roadmap_f3"
  | "rejected_out_of_scope";

export type SourceType = "registry_component" | "accepted_gap";

export interface ScopeBlocker {
  type: "compliance" | "data_readiness" | "poc" | "soul_capture";
  blocks_production: boolean;
  blocks_design: boolean;
  blocks_internal_testing: boolean;
  required_artifacts: string[];
  reason: string;
}

export interface ScopeDecisionLogEntry {
  source: "human_decision" | "f4b_verdict" | "deterministic_rule";
  decision_id: string;
  applied_to: string; // component_id or gap_id
  action: string;
  reason: string;
}

export interface ScopeComponent {
  scope_id: string; // SCOPE-NN
  source_type: SourceType;
  source_ref: string; // COMP-XX or GAP-XX
  name: string;
  family?: string;
  layer?: string;
  status: ScopeStatus;
  bucket: ScopeBucket;
  business_job?: string;
  priority?: string;
  blockers: ScopeBlocker[];
  required_actions: string[];
  soul_dependency?: "none" | "async" | "hard";
  compliance_flags?: string[];
  notes?: string;
}

export interface SoulCapturePlan {
  required: boolean;
  sessions: number;
  session_duration_min: number;
  weeks_window: string;
  deliverables: string[];
  hard_dependencies: string[]; // component_ids that hard-depend on Soul
  async_dependencies: string[]; // component_ids that consult async
  fallback: string;
}

export interface ComplianceBlockerEntry {
  scope_id: string;
  component_name: string;
  required_artifacts: string[];
  reason: string;
  owner: string;
  deadline_weeks: number;
  /** Replicated from internal blocker so PRD/proposal can read flags from root. */
  blocks_design: boolean;
  blocks_internal_testing: boolean;
  blocks_production: boolean;
}

export interface DatasetReadinessBlockerEntry {
  scope_id: string;
  component_id: string;
  component_name: string;
  dataset_required: string;
  current_readiness_pct: number;
  min_readiness_for_mvp: number;
  unblocking_actions: string[];
  reason: string;
}

export interface ClientDeliverables {
  mvp_demo_features: string[];
  documentation: string[];
  training_sessions: string[];
}

export interface ScopeArchitectureV1 {
  schema_version: "1.0.0";
  data_foundation: ScopeComponent[];
  mvp: ScopeComponent[];
  fast_follow_f2: ScopeComponent[];
  roadmap_f3: ScopeComponent[];
  rejected_out_of_scope: ScopeComponent[];
  compliance_blockers: ComplianceBlockerEntry[];
  data_readiness_blockers: DatasetReadinessBlockerEntry[];
  human_decisions_applied: Array<{
    decision_id: string;
    label: string;
    applied_to: string[];
  }>;
  soul_capture_plan: SoulCapturePlan;
  client_deliverables: ClientDeliverables;
  scope_decision_log: ScopeDecisionLogEntry[];
}

export interface PreWarmResult {
  scope: ScopeArchitectureV1;
  /** component_ids actually consumed from registry */
  consumed_component_ids: Set<string>;
  /** gap_ids accepted by F4b (accept_as_new_component or accept_but_defer) */
  acceptable_gap_ids: Set<string>;
}

// ───────────────────────────────────────────────────────────────────────────────
// Hard rule helpers
// ───────────────────────────────────────────────────────────────────────────────

const COMPLIANCE_FLAG_TRIGGERS = new Set([
  "personal_data_processing",
  "profiling",
  "commercial_prioritization",
  "external_data_enrichment",
]);

const DPIA_REQUIRED_ARTIFACTS = ["DPIA", "legal_basis", "retention_policy", "HITL_protocol"];

function isBenatar(c: any): boolean {
  const name = String(c?.name ?? "").toLowerCase();
  const family = String(c?.family ?? "").toLowerCase();
  return (
    family === "institutional_buyer_detector" ||
    name.includes("benatar") ||
    (name.includes("compradores institucionales") && !name.includes("fallecimien"))
  );
}

function isSoul(c: any): boolean {
  const id = String(c?.component_id ?? "").toUpperCase();
  const name = String(c?.name ?? "").toLowerCase();
  return id === "COMP-D01" || name.includes("soul de alejandro") || name === "soul";
}

function hasComplianceTriggers(c: any): boolean {
  if (c?.dpia_required === true) return true;
  const flags = Array.isArray(c?.compliance_flags) ? c.compliance_flags : [];
  return flags.some((f: string) => COMPLIANCE_FLAG_TRIGGERS.has(String(f)));
}

// ───────────────────────────────────────────────────────────────────────────────
// Bucket inference from F4b verdict
// ───────────────────────────────────────────────────────────────────────────────

interface VerdictHint {
  verdict?: string;
  recommended_status?: string;
  recommended_priority?: string;
  recommended_delivery_phase?: string;
  reason?: string;
  required_actions?: string[];
}

/**
 * Normalise a free-text phase to one of: "MVP", "F2", "F3", or "" (unknown).
 *
 * Critical: registry components carry `phase: "F3_registry_builder"` which is
 * the *pipeline* step name, NOT a delivery phase. Accept only delivery phase
 * tokens (MVP / FAST_FOLLOW / ROADMAP / F1 / F2 / F3 with delivery context).
 */
function normalizeDeliveryPhase(raw: string): "MVP" | "F2" | "F3" | "" {
  const s = String(raw ?? "").toUpperCase().trim();
  if (!s) return "";
  // Reject pipeline step names (registry/audit/feasibility builders).
  if (/REGISTRY_BUILDER|AUDIT|FEASIBILITY|EXTRACTION|ARCHITECT/.test(s)) return "";
  if (/MVP|F1\b|FOUNDATION/.test(s)) return "MVP";
  if (/FAST.?FOLLOW|F2\b/.test(s)) return "F2";
  if (/ROADMAP|F3\b/.test(s)) return "F3";
  return "";
}

function bucketFromVerdict(c: any, hint: VerdictHint | undefined): ScopeBucket {
  const phase = normalizeDeliveryPhase(
    hint?.recommended_delivery_phase ?? c?.suggested_delivery_phase ?? c?.phase ?? "",
  );
  const v = hint?.verdict;

  if (v === "reject") return "rejected_out_of_scope";
  if (v === "defer") {
    if (phase === "F3") return "roadmap_f3";
    return "fast_follow_f2";
  }
  if (v === "requires_poc") return "fast_follow_f2";
  // keep / simplify / requires_data_readiness / requires_compliance_review → MVP by default,
  // unless component is explicitly tagged as F2/F3 by F3 builder.
  if (phase === "F3") return "roadmap_f3";
  if (phase === "F2" && v !== "requires_data_readiness" && v !== "requires_compliance_review") {
    return "fast_follow_f2";
  }
  return "mvp";
}

function statusFromVerdict(v: VerdictHint | undefined): ScopeStatus {
  const verdict = v?.verdict;
  if (verdict === "reject") return "rejected";
  if (verdict === "defer") return "deferred";
  if (
    verdict === "requires_compliance_review" ||
    verdict === "requires_data_readiness" ||
    verdict === "requires_poc" ||
    verdict === "simplify"
  ) {
    return "approved_with_conditions";
  }
  return "approved_for_scope";
}

function blockersFromVerdictAndComponent(
  c: any,
  hint: VerdictHint | undefined,
): { blockers: ScopeBlocker[]; status: ScopeStatus } {
  const blockers: ScopeBlocker[] = [];
  let status = statusFromVerdict(hint);
  const verdict = hint?.verdict;

  // Compliance blocker (F4b verdict OR DPIA flags from registry).
  if (verdict === "requires_compliance_review" || hasComplianceTriggers(c)) {
    blockers.push({
      type: "compliance",
      blocks_production: true,
      blocks_design: false,
      blocks_internal_testing: false,
      required_artifacts: DPIA_REQUIRED_ARTIFACTS,
      reason: hint?.reason ?? "Componente con flags DPIA — requiere revisión legal antes de producción.",
    });
    if (status === "approved_for_scope") status = "approved_with_conditions";
  }

  if (verdict === "requires_data_readiness") {
    blockers.push({
      type: "data_readiness",
      blocks_production: true,
      blocks_design: false,
      blocks_internal_testing: true,
      required_artifacts: ["dataset_audit", "data_quality_report", "data_volume_baseline"],
      reason: hint?.reason ?? "Pendiente de validar dataset antes de comprometer alcance.",
    });
    if (status === "approved_for_scope") status = "approved_with_conditions";
  }

  if (verdict === "requires_poc") {
    blockers.push({
      type: "poc",
      blocks_production: true,
      blocks_design: false,
      blocks_internal_testing: false,
      required_artifacts: ["proof_of_concept", "feasibility_report"],
      reason: hint?.reason ?? "Requiere PoC antes de comprometer scope productivo.",
    });
    if (status === "approved_for_scope") status = "approved_with_conditions";
  }

  return { blockers, status };
}

// ───────────────────────────────────────────────────────────────────────────────
// Soul dependency resolution (Decision 1)
// ───────────────────────────────────────────────────────────────────────────────

const SOUL_HARD_ALLOWED = new Set(["COMP-D01"]);
const SOUL_FORBIDDEN_HARD = new Set(["COMP-B02", "COMP-C04"]);
const SOUL_ASYNC_PREFERRED = new Set(["COMP-B03", "COMP-C03"]);

function resolveSoulDependency(c: any): "none" | "async" | "hard" {
  const id = String(c?.component_id ?? "").toUpperCase();
  const declared = String(c?.soul_dependency ?? "none").toLowerCase();

  if (SOUL_HARD_ALLOWED.has(id)) return "hard";
  if (SOUL_FORBIDDEN_HARD.has(id)) return declared === "none" ? "none" : "async";
  if (SOUL_ASYNC_PREFERRED.has(id)) return "async";

  // For everything else, downgrade hard → async per Decision 1.
  if (declared === "hard") return "async";
  if (declared === "async" || declared === "none") return declared as "async" | "none";
  return "none";
}

// ───────────────────────────────────────────────────────────────────────────────
// Public: pre-warm
// ───────────────────────────────────────────────────────────────────────────────

export function buildSoulCapturePlan(consumed: ScopeComponent[]): SoulCapturePlan {
  const hardDeps = consumed
    .filter((c) => c.soul_dependency === "hard")
    .map((c) => c.source_ref);
  const asyncDeps = consumed
    .filter((c) => c.soul_dependency === "async")
    .map((c) => c.source_ref);

  return {
    required: true,
    sessions: 4,
    session_duration_min: 45,
    weeks_window: "weeks_1_to_2",
    deliverables: [
      "criterio_estrategico_documentado",
      "logica_priorizacion",
      "guiones_negociacion",
      "patrones_propietario",
      "manejo_objeciones",
      "copy_emocional",
    ],
    hard_dependencies: hardDeps,
    async_dependencies: asyncDeps,
    fallback:
      "Si Alejandro no entrega el corpus a tiempo se usan reglas heurísticas documentadas y un proxy operativo, salvo COMP-D01 que sí depende del Soul.",
  };
}

export function runDeterministicPreWarm(
  registry: any,
  feasibilityAudit: any,
  gapAudit: any,
): PreWarmResult {
  const components: any[] = Array.isArray(registry?.components) ? registry.components : [];
  const reviews: any[] = Array.isArray(feasibilityAudit?.component_reviews)
    ? feasibilityAudit.component_reviews
    : [];
  const gapReviews: any[] = Array.isArray(feasibilityAudit?.gap_reviews)
    ? feasibilityAudit.gap_reviews
    : [];
  const gaps: any[] = Array.isArray(gapAudit?.gaps) ? gapAudit.gaps : [];

// A component may receive MULTIPLE reviews (e.g. one deterministic DPIA review +
// one LLM verdict). We MUST merge them so the deterministic compliance signal is
// not lost when the LLM also weighs in.
const reviewsByCompId = new Map<string, VerdictHint[]>();
for (const r of reviews) {
  if (!r?.component_id) continue;
  const id = String(r.component_id);
  const hint: VerdictHint = {
    verdict: r.feasibility_verdict,
    recommended_status: r.recommended_status,
    recommended_priority: r.recommended_priority,
    recommended_delivery_phase: r.recommended_delivery_phase,
    reason: r.reason,
    required_actions: Array.isArray(r.required_actions) ? r.required_actions : [],
  };
  const list = reviewsByCompId.get(id) ?? [];
  list.push(hint);
  reviewsByCompId.set(id, list);
}

// Bucket precedence when multiple verdicts disagree (highest precedence wins,
// EXCEPT compliance, which only attaches a blocker and never demotes the bucket).
const BUCKET_RANK: Record<ScopeBucket, number> = {
  rejected_out_of_scope: 5,
  roadmap_f3: 4,
  fast_follow_f2: 3,
  data_foundation: 2,
  mvp: 1,
};
function pickWorstBucket(a: ScopeBucket, b: ScopeBucket): ScopeBucket {
  return BUCKET_RANK[a] >= BUCKET_RANK[b] ? a : b;
}

function mergeHints(c: any, hints: VerdictHint[]): {
  primaryHint: VerdictHint | undefined;
  bucket: ScopeBucket;
  blockers: ScopeBlocker[];
  status: ScopeStatus;
  required_actions: string[];
} {
  if (hints.length === 0) {
    const bucket = bucketFromVerdict(c, undefined);
    const { blockers, status } = blockersFromVerdictAndComponent(c, undefined);
    return { primaryHint: undefined, bucket, blockers, status, required_actions: [] };
  }
  // Compliance-aware merge: compliance attaches blocker, others drive bucket.
  let bucket: ScopeBucket | null = null;
  let status: ScopeStatus = "approved_for_scope";
  const blockerKeys = new Set<string>();
  const blockers: ScopeBlocker[] = [];
  const actions = new Set<string>();
  let primary: VerdictHint | undefined;
  // Order: process non-compliance first (drives bucket), then compliance.
  const nonCompliance = hints.filter((h) => h.verdict !== "requires_compliance_review");
  const complianceOnly = hints.filter((h) => h.verdict === "requires_compliance_review");
  for (const h of [...nonCompliance, ...complianceOnly]) {
    const b = bucketFromVerdict(c, h);
    bucket = bucket === null ? b : pickWorstBucket(bucket, b);
    const { blockers: bl, status: st } = blockersFromVerdictAndComponent(c, h);
    for (const blk of bl) {
      const key = `${blk.type}:${blk.reason.slice(0, 40)}`;
      if (!blockerKeys.has(key)) { blockerKeys.add(key); blockers.push(blk); }
    }
    if (st === "rejected") status = "rejected";
    else if (st === "deferred" && status !== "rejected") status = "deferred";
    else if (st === "approved_with_conditions" && status === "approved_for_scope") {
      status = "approved_with_conditions";
    }
    for (const a of h.required_actions ?? []) actions.add(a);
    if (!primary || h.verdict !== "requires_compliance_review") primary = h;
  }
  return {
    primaryHint: primary,
    bucket: bucket ?? "mvp",
    blockers,
    status,
    required_actions: Array.from(actions),
  };
}

  const decisionLog: ScopeDecisionLogEntry[] = [];
  const buckets: Record<ScopeBucket, ScopeComponent[]> = {
    data_foundation: [],
    mvp: [],
    fast_follow_f2: [],
    roadmap_f3: [],
    rejected_out_of_scope: [],
  };
  const consumedIds = new Set<string>();

  let scopeCounter = 1;
  const nextId = () => `SCOPE-${String(scopeCounter++).padStart(3, "0")}`;

  // ── 1. Walk registry components ──────────────────────────────────────────
  for (const c of components) {
    const compId = String(c?.component_id ?? c?.id ?? "").trim();
    if (!compId) continue;
    consumedIds.add(compId);

    const hints = reviewsByCompId.get(compId) ?? [];
    const merged = mergeHints(c, hints);
    let bucket = merged.bucket;
    let { blockers, status } = { blockers: merged.blockers, status: merged.status };
    const requiredActionsBase = merged.required_actions;
    const hint = merged.primaryHint;
    const soulDep = resolveSoulDependency(c);

    // ── Decision 2 — Benatar forced to F2 ──────────────────────────────────
    if (isBenatar(c)) {
      bucket = "fast_follow_f2";
      if (status === "rejected") status = "deferred";
      decisionLog.push({
        source: "human_decision",
        decision_id: "benatar_defer_f2",
        applied_to: compId,
        action: "forced_phase_f2",
        reason: "MVP focus; Benatar remains strategic fast-follow.",
      });
    }

    // ── Decision 1 — Soul → data_foundation ────────────────────────────────
    if (isSoul(c)) {
      bucket = "data_foundation";
      status = "approved_for_scope";
      blockers.push({
        type: "soul_capture",
        blocks_production: false,
        blocks_design: false,
        blocks_internal_testing: false,
        required_artifacts: ["soul_capture_sessions_x4", "soul_corpus_v1"],
        reason: "Captura estructurada del Soul de Alejandro en semanas 1-2.",
      });
      decisionLog.push({
        source: "human_decision",
        decision_id: "soul_capture_plan_v1",
        applied_to: compId,
        action: "data_foundation_with_capture_plan",
        reason: "COMP-D01 entra como componente fundacional con plan de captura.",
      });
    } else if (SOUL_FORBIDDEN_HARD.has(compId) && c?.soul_dependency === "hard") {
      decisionLog.push({
        source: "human_decision",
        decision_id: "soul_no_hard_block_b02_c04",
        applied_to: compId,
        action: "downgraded_soul_dependency_to_async",
        reason: "B02/C04 no deben tener bloqueo hard por Soul.",
      });
    }

    // ── Decision 3 — DPIA blocker logged ───────────────────────────────────
    if (hasComplianceTriggers(c)) {
      decisionLog.push({
        source: "human_decision",
        decision_id: "dpia_parallel_track",
        applied_to: compId,
        action: "approved_with_conditions_compliance",
        reason: "DPIA en paralelo: bloquea producción, no diseño.",
      });
    }

    // F4b verdict trace (logs each verdict applied to this component).
    for (const h of hints) {
      if (!h.verdict) continue;
      decisionLog.push({
        source: "f4b_verdict",
        decision_id: `f4b_${h.verdict}`,
        applied_to: compId,
        action: `assigned_to_${bucket}`,
        reason: h.reason ?? "F4b verdict applied.",
      });
    }

    const scopeComp: ScopeComponent = {
      scope_id: nextId(),
      source_type: "registry_component",
      source_ref: compId,
      name: String(c?.name ?? compId),
      family: c?.family,
      layer: c?.layer,
      status,
      bucket,
      business_job: c?.business_job,
      priority: hint?.recommended_priority ?? c?.priority,
      blockers,
      required_actions: requiredActionsBase,
      soul_dependency: soulDep,
      compliance_flags: Array.isArray(c?.compliance_flags) ? c.compliance_flags : undefined,
    };

    buckets[bucket].push(scopeComp);
  }

  // ── 2. Walk accepted gaps from F4b ───────────────────────────────────────
  const acceptableGapIds = new Set<string>();
  const gapById = new Map<string, any>();
  for (const g of gaps) {
    if (g?.gap_id) gapById.set(String(g.gap_id), g);
  }

  for (const gr of gapReviews) {
    const gapId = String(gr?.gap_id ?? "");
    const verdict = gr?.verdict;
    if (!gapId) continue;
    if (verdict !== "accept_as_new_component" && verdict !== "accept_but_defer") continue;
    acceptableGapIds.add(gapId);

    const g = gapById.get(gapId) ?? {};
    const cand = g?.suggested_component_candidate ?? {};
    const candName = String(cand?.name ?? g?.title ?? gapId);

    let bucket: ScopeBucket = verdict === "accept_but_defer" ? "fast_follow_f2" : "mvp";
    let status: ScopeStatus = verdict === "accept_but_defer" ? "deferred" : "approved_for_scope";

    // Decision 2 — Benatar gap also forced to F2
    if (isBenatar({ name: candName, family: cand?.family })) {
      bucket = "fast_follow_f2";
      status = "deferred";
      decisionLog.push({
        source: "human_decision",
        decision_id: "benatar_defer_f2",
        applied_to: gapId,
        action: "gap_forced_to_f2",
        reason: "Benatar gap clasificado como fast-follow.",
      });
    }

    // Apply DPIA blocker to gap candidate if relevant
    const blockers: ScopeBlocker[] = [];
    if (hasComplianceTriggers(cand)) {
      blockers.push({
        type: "compliance",
        blocks_production: true,
        blocks_design: false,
        blocks_internal_testing: false,
        required_artifacts: DPIA_REQUIRED_ARTIFACTS,
        reason: "Gap candidate con flags DPIA.",
      });
      if (status === "approved_for_scope") status = "approved_with_conditions";
    }

    decisionLog.push({
      source: "f4b_verdict",
      decision_id: `f4b_gap_${verdict}`,
      applied_to: gapId,
      action: `gap_${verdict}_to_${bucket}`,
      reason: gr?.reason ?? "F4b accepted the gap.",
    });

    buckets[bucket].push({
      scope_id: nextId(),
      source_type: "accepted_gap",
      source_ref: gapId,
      name: candName,
      family: cand?.family,
      layer: cand?.layer,
      status,
      bucket,
      business_job: cand?.business_job,
      priority: cand?.priority,
      blockers,
      required_actions: [],
      soul_dependency: "none",
      compliance_flags: Array.isArray(cand?.compliance_flags) ? cand.compliance_flags : undefined,
    });
  }

  // ── 3. Hard post-rules (Step 28 v2 human decisions) ─────────────────────
  // Decision 1 v2 — COMP-C01 (Detector de fallecimientos/herencias) MUST be MVP,
  // not roadmap_f3, with compliance blocker (DPIA + external_source_policy).
  for (const phase of ["roadmap_f3", "fast_follow_f2"] as ScopeBucket[]) {
    const idx = buckets[phase].findIndex((c) => c.source_ref === "COMP-C01");
    if (idx !== -1) {
      const moved = buckets[phase].splice(idx, 1)[0];
      moved.bucket = "mvp";
      if (moved.status !== "rejected") moved.status = "approved_with_conditions";
      const hasCompliance = moved.blockers.some((b) => b.type === "compliance");
      if (!hasCompliance) {
        moved.blockers.push({
          type: "compliance",
          blocks_production: true,
          blocks_design: false,
          blocks_internal_testing: false,
          required_artifacts: [...DPIA_REQUIRED_ARTIFACTS, "external_source_policy"],
          reason:
            "Catalizador #1 del negocio. Solo uso interno/controlado hasta validación DPO/DPIA. No automatizar contacto ni priorización productiva sin revisión humana.",
        });
      } else {
        // Ensure external_source_policy is in artifacts
        for (const b of moved.blockers) {
          if (b.type === "compliance" && !b.required_artifacts.includes("external_source_policy")) {
            b.required_artifacts = [...b.required_artifacts, "external_source_policy"];
          }
        }
      }
      buckets.mvp.push(moved);
      decisionLog.push({
        source: "human_decision",
        decision_id: "c01_force_mvp_with_dpia_v2",
        applied_to: "COMP-C01",
        action: `moved_from_${phase}_to_mvp`,
        reason:
          "Detector de fallecimientos/herencias es el catalizador #1 del negocio AFFLUX. Entra en MVP con condiciones DPIA + HITL.",
      });
    }
  }

  // Decision 2 v2 — COMP-C03 (Matching activo-inversor) MUST have data_readiness blocker.
  for (const phase of ["mvp", "fast_follow_f2", "data_foundation"] as ScopeBucket[]) {
    const c = buckets[phase].find((c) => c.source_ref === "COMP-C03");
    if (c) {
      const hasDataReadiness = c.blockers.some((b) => b.type === "data_readiness");
      if (!hasDataReadiness) {
        c.blockers.push({
          type: "data_readiness",
          blocks_production: true,
          blocks_design: false,
          blocks_internal_testing: true,
          required_artifacts: ["dataset_audit", "data_quality_report", "data_volume_baseline"],
          reason:
            "El matching activo-inversor no puede producir recomendaciones fiables sin histórico mínimo y reglas de abstención.",
        });
        if (c.status === "approved_for_scope") c.status = "approved_with_conditions";
        decisionLog.push({
          source: "human_decision",
          decision_id: "c03_data_readiness_required_v2",
          applied_to: "COMP-C03",
          action: "added_data_readiness_blocker",
          reason: "Matching no puede recomendar sin dataset histórico mínimo.",
        });
      }
    }
  }

  // ── 4. Compute aggregated blocker lists ──────────────────────────────────
  const allConsumed = [
    ...buckets.data_foundation,
    ...buckets.mvp,
    ...buckets.fast_follow_f2,
    ...buckets.roadmap_f3,
  ];

  const compliance_blockers: ComplianceBlockerEntry[] = allConsumed.flatMap((c) =>
    c.blockers
      .filter((b) => b.type === "compliance")
      .map((b) => ({
        scope_id: c.scope_id,
        component_name: c.name,
        required_artifacts: b.required_artifacts,
        reason: b.reason,
        owner: "DPO / Responsable legal del cliente",
        deadline_weeks: 4,
        blocks_design: b.blocks_design ?? false,
        blocks_internal_testing: b.blocks_internal_testing ?? false,
        blocks_production: b.blocks_production ?? true,
      })),
  );

  // C03-specific dataset description for richer readiness entry
  const C03_DATASET = {
    dataset_required:
      "Histórico de activos, inversores/compradores, visitas, ofertas, cierres, feedback comercial y preferencias de inversión.",
    unblocking_actions: [
      "Inventariar base de compradores/inversores",
      "Normalizar histórico de activos y oportunidades",
      "Etiquetar visitas/ofertas/cierres históricos",
      "Capturar preferencias de inversión por comprador",
      "Definir umbral de abstención cuando no haya evidencia suficiente",
    ],
  };

  const data_readiness_blockers: DatasetReadinessBlockerEntry[] = allConsumed.flatMap((c) =>
    c.blockers
      .filter((b) => b.type === "data_readiness")
      .map((b) => {
        const isC03 = c.source_ref === "COMP-C03";
        return {
          scope_id: c.scope_id,
          component_id: c.source_ref,
          component_name: c.name,
          dataset_required: isC03 ? C03_DATASET.dataset_required : "Pendiente de auditoría de dataset.",
          current_readiness_pct: 0,
          min_readiness_for_mvp: 50,
          unblocking_actions: isC03
            ? C03_DATASET.unblocking_actions
            : ["Realizar auditoría de dataset", "Reportar calidad y volumen", "Definir baseline de volumen mínimo"],
          reason: b.reason,
        };
      }),
  );

  const human_decisions_applied = [
    {
      decision_id: "soul_capture_plan_v1",
      label: "Plan de captura del Soul (4 sesiones x 45min, semanas 1-2)",
      applied_to: allConsumed
        .filter((c) => c.soul_dependency === "hard" || c.soul_dependency === "async")
        .map((c) => c.source_ref),
    },
    {
      decision_id: "benatar_defer_f2",
      label: "Benatar / detector institucional → fast_follow_f2",
      applied_to: allConsumed
        .filter((c) => isBenatar({ name: c.name, family: c.family }))
        .map((c) => c.source_ref),
    },
    {
      decision_id: "dpia_parallel_track",
      label: "DPIA en paralelo desde día 1 — bloquea producción, no diseño",
      applied_to: allConsumed
        .filter((c) => c.blockers.some((b) => b.type === "compliance"))
        .map((c) => c.source_ref),
    },
    {
      decision_id: "c01_force_mvp_with_dpia_v2",
      label: "COMP-C01 (fallecimientos/herencias) forzado a MVP con condiciones DPIA + HITL",
      applied_to: allConsumed.filter((c) => c.source_ref === "COMP-C01").map((c) => c.source_ref),
    },
    {
      decision_id: "c03_data_readiness_required_v2",
      label: "COMP-C03 (matching activo-inversor) requiere dataset_readiness blocker",
      applied_to: allConsumed.filter((c) => c.source_ref === "COMP-C03").map((c) => c.source_ref),
    },
  ];

  const client_deliverables = buildDefaultClientDeliverables(allConsumed);

  const scope: ScopeArchitectureV1 = {
    schema_version: "1.0.0",
    data_foundation: buckets.data_foundation,
    mvp: buckets.mvp,
    fast_follow_f2: buckets.fast_follow_f2,
    roadmap_f3: buckets.roadmap_f3,
    rejected_out_of_scope: buckets.rejected_out_of_scope,
    compliance_blockers,
    data_readiness_blockers,
    human_decisions_applied,
    soul_capture_plan: buildSoulCapturePlan(allConsumed),
    client_deliverables,
    scope_decision_log: decisionLog,
  };

  return { scope, consumed_component_ids: consumedIds, acceptable_gap_ids: acceptableGapIds };
}

// ───────────────────────────────────────────────────────────────────────────────
// Default client_deliverables builder
// ───────────────────────────────────────────────────────────────────────────────

export function buildDefaultClientDeliverables(consumed: ScopeComponent[]): ClientDeliverables {
  const mvpFeatures = consumed
    .filter((c) => c.bucket === "mvp" || c.bucket === "data_foundation")
    .map((c) => c.name);
  // de-dup preserving order
  const seen = new Set<string>();
  const mvp_demo_features = mvpFeatures.filter((n) => (seen.has(n) ? false : (seen.add(n), true)));

  return {
    mvp_demo_features: mvp_demo_features.length > 0
      ? mvp_demo_features
      : ["Dashboard inicial de oportunidades y componentes aprobados"],
    documentation: [
      "PRD técnico para construcción",
      "Documento de alcance y propuesta cliente",
      "Mapa de datos e integraciones",
      "Plan de DPIA y compliance",
      "Plan de captura del Soul",
      "Criterios de aceptación MVP",
    ],
    training_sessions: [
      "Sesión de kickoff y acceso a datos",
      "Sesión de captura del Soul 1",
      "Sesión de captura del Soul 2",
      "Sesión de validación de roles y flujos comerciales",
      "Sesión de entrega MVP y formación operativa",
    ],
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Traceability validator (used by the orchestrator before persisting)
// ───────────────────────────────────────────────────────────────────────────────

export interface TraceabilityViolation {
  scope_id: string;
  source_type: SourceType;
  source_ref: string;
  reason: string;
}

export function validateScopeTraceability(
  scope: ScopeArchitectureV1,
  registryComponentIds: Set<string>,
  acceptableGapIds: Set<string>,
): TraceabilityViolation[] {
  const violations: TraceabilityViolation[] = [];
  const all: ScopeComponent[] = [
    ...scope.data_foundation,
    ...scope.mvp,
    ...scope.fast_follow_f2,
    ...scope.roadmap_f3,
    ...scope.rejected_out_of_scope,
  ];

  const seen = new Set<string>();
  for (const c of all) {
    if (seen.has(c.scope_id)) {
      violations.push({
        scope_id: c.scope_id,
        source_type: c.source_type,
        source_ref: c.source_ref,
        reason: `Duplicate scope_id ${c.scope_id}.`,
      });
    }
    seen.add(c.scope_id);

    if (c.source_type === "registry_component") {
      if (!registryComponentIds.has(c.source_ref)) {
        violations.push({
          scope_id: c.scope_id,
          source_type: c.source_type,
          source_ref: c.source_ref,
          reason: `source_ref ${c.source_ref} is not a known component_id in Step 25.`,
        });
      }
    } else if (c.source_type === "accepted_gap") {
      if (!acceptableGapIds.has(c.source_ref)) {
        violations.push({
          scope_id: c.scope_id,
          source_type: c.source_type,
          source_ref: c.source_ref,
          reason: `source_ref ${c.source_ref} is not a gap accepted by F4b (accept_as_new_component or accept_but_defer).`,
        });
      }
    } else {
      violations.push({
        scope_id: c.scope_id,
        source_type: c.source_type,
        source_ref: c.source_ref,
        reason: `Unknown source_type "${c.source_type}". Only registry_component or accepted_gap allowed.`,
      });
    }
  }
  return violations;
}
