/**
 * f4b-deterministic-rules.ts — Pure feasibility/anti-inflation rules for F4b.
 *
 * Each rule consumes the Step 25 component_registry and Step 26 gap audit
 * and emits PreVerdict objects (per-component) or PreRisk objects.
 * The F4b orchestrator runs these BEFORE the LLM call so the LLM is forced to
 * confirm/reject deterministic verdicts rather than starting from a blank page.
 *
 * Created: 2026-04-25
 */

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────

export type FeasibilityVerdict =
  | "keep"
  | "simplify"
  | "defer"
  | "requires_poc"
  | "requires_data_readiness"
  | "requires_compliance_review"
  | "reject";

export interface PreComponentVerdict {
  component_id: string;
  current_status: string;
  current_priority: string;
  current_phase: string;
  feasibility_verdict: FeasibilityVerdict;
  recommended_status?: string;
  recommended_priority?: string;
  recommended_delivery_phase?: string;
  reason: string;
  required_actions: string[];
  rule: string;
}

export type RiskSeverity = "low" | "medium" | "high" | "critical";

export interface PreProjectRisk {
  risk: string;
  severity: RiskSeverity;
  mitigation: string;
  rule: string;
}

interface RegistryComponent {
  component_id?: string;
  id?: string;
  name?: string;
  family?: string;
  layer?: string;
  business_job?: string;
  status?: string;
  priority?: string;
  suggested_delivery_phase?: string;
  delivery_phase?: string;
  soul_dependency?: string;
  compliance_flags?: string[];
  dataset_readiness_required?: boolean;
  dataset_confirmed?: boolean;
  external_sources?: string[];
}

interface ComponentRegistry {
  components?: RegistryComponent[];
  legacy_components?: RegistryComponent[];
  dpia?: { required?: boolean; status?: string };
}

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────────

function compId(c: RegistryComponent): string {
  return c.component_id || c.id || "<unknown>";
}

function getPhase(c: RegistryComponent): string {
  return c.suggested_delivery_phase || c.delivery_phase || "unknown";
}

function isMvp(c: RegistryComponent): boolean {
  return /^mvp/i.test(getPhase(c));
}

function components(registry: ComponentRegistry | null | undefined): RegistryComponent[] {
  if (!registry) return [];
  const a = Array.isArray(registry.components) ? registry.components : [];
  const b = Array.isArray(registry.legacy_components) ? registry.legacy_components : [];
  return [...a, ...b];
}

function basePreVerdict(c: RegistryComponent): Omit<PreComponentVerdict, "feasibility_verdict" | "reason" | "required_actions" | "rule"> {
  return {
    component_id: compId(c),
    current_status: c.status ?? "unknown",
    current_priority: c.priority ?? "unknown",
    current_phase: getPhase(c),
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Rules
// ───────────────────────────────────────────────────────────────────────────────

/**
 * R1 — Components with `dataset_readiness_required: true` and no confirmed
 * dataset must wait. Verdict: requires_data_readiness.
 */
export function forceRequiresDataReadiness(registry: ComponentRegistry | null | undefined): PreComponentVerdict[] {
  const out: PreComponentVerdict[] = [];
  for (const c of components(registry)) {
    if (!c.dataset_readiness_required) continue;
    if (c.dataset_confirmed === true) continue;
    out.push({
      ...basePreVerdict(c),
      feasibility_verdict: "requires_data_readiness",
      recommended_status: "blocked_pending_data",
      reason: "Componente requiere readiness de dataset y no hay dataset confirmado.",
      required_actions: [
        "Definir minimum_dataset_needed y validarlo con el cliente.",
        "Mantener human_review obligatorio hasta validar el dataset.",
      ],
      rule: "R1_requires_data_readiness",
    });
  }
  return out;
}

/**
 * R2 — If DPIA is required, every component with `personal_data_processing` or
 * `commercial_prioritization` flags must pass compliance review.
 */
export function forceComplianceReviewIfDpia(registry: ComponentRegistry | null | undefined): PreComponentVerdict[] {
  if (!registry?.dpia?.required) return [];
  const out: PreComponentVerdict[] = [];
  const sensitive = new Set(["personal_data_processing", "commercial_prioritization", "human_in_the_loop_required"]);
  for (const c of components(registry)) {
    const flags = Array.isArray(c.compliance_flags) ? c.compliance_flags : [];
    const triggered = flags.some((f) => sensitive.has(f));
    if (!triggered) continue;
    out.push({
      ...basePreVerdict(c),
      feasibility_verdict: "requires_compliance_review",
      reason: "DPIA required y el componente procesa datos personales o prioriza comercialmente.",
      required_actions: [
        "Adjuntar componente al alcance de la DPIA.",
        "Documentar finalidad, base legal y minimización.",
        "Garantizar revisión humana sobre las salidas.",
      ],
      rule: "R2_dpia_compliance_review",
    });
  }
  return out;
}

/**
 * R3 — Soul capture risk: 3+ components depend on Soul.
 */
export function detectSoulCaptureRisk(registry: ComponentRegistry | null | undefined): PreProjectRisk[] {
  const dependents = components(registry).filter((c) => {
    const dep = (c.soul_dependency ?? "none").toLowerCase();
    return dep === "consults_soul" || dep === "requires_soul_approval";
  });
  if (dependents.length < 3) return [];
  const severity: RiskSeverity = dependents.length >= 5 ? "critical" : "high";
  return [{
    risk: `Captura del Soul: ${dependents.length} componentes dependen del criterio del fundador.`,
    severity,
    mitigation: "Documentar reglas explícitas, definir owner sustituto del Soul, y limitar dependencias hard a las P0/P1.",
    rule: "R3_soul_capture_risk",
  }];
}

/**
 * R4 — Phase inflation: MVP holds too many AI components.
 * Heuristic: >6 AI components in MVP → defer the lowest-priority extras.
 */
export function detectInflationByPhase(registry: ComponentRegistry | null | undefined): {
  verdicts: PreComponentVerdict[];
  risks: PreProjectRisk[];
} {
  const mvp = components(registry).filter(isMvp);
  if (mvp.length <= 6) return { verdicts: [], risks: [] };

  // Sort by priority ascending: P3 < P2 < P1 < P0. Defer the lowest.
  const priorityRank = (p: string | undefined): number => {
    if (!p) return 99;
    const m = p.match(/p(\d)/i);
    return m ? Number(m[1]) : 99;
  };
  const sorted = [...mvp].sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));
  const toDefer = sorted.slice(0, mvp.length - 6);

  return {
    verdicts: toDefer.map((c) => ({
      ...basePreVerdict(c),
      feasibility_verdict: "defer",
      recommended_delivery_phase: "F2",
      reason: `MVP inflado (${mvp.length} componentes IA). Este componente es de menor prioridad y debería diferirse.`,
      required_actions: ["Mover a F2 o roadmap.", "Confirmar con stakeholders."],
      rule: "R4_inflation_by_phase",
    })),
    risks: [{
      risk: `MVP contiene ${mvp.length} componentes IA — riesgo alto de no entregar a tiempo.`,
      severity: "high" as RiskSeverity,
      mitigation: `Diferir ${toDefer.length} componentes de menor prioridad a F2.`,
      rule: "R4_inflation_by_phase",
    }],
  };
}

/**
 * R5 — CRUD misclassified as AI: business_job describes plain CRUD operations
 * without any AI primitives.
 */
export function detectCrudMisclassifiedAsAi(registry: ComponentRegistry | null | undefined): PreComponentVerdict[] {
  const crudVerbs = ["alta", "baja", "edición", "edicion", "listado", "crud", "registrar", "actualizar"];
  const aiPrimitives = ["modelo", "clasificador", "clasifica", "embedding", "rag", "llm", "agente", "matching", "recomend", "predic", "scoring", "score"];
  const out: PreComponentVerdict[] = [];
  for (const c of components(registry)) {
    const fam = (c.family ?? "").toLowerCase();
    if (fam === "form" || fam === "crud") continue; // already correctly classified
    const job = (c.business_job ?? "").toLowerCase();
    if (!job) continue;
    const crudHits = crudVerbs.filter((v) => job.includes(v)).length;
    const aiHits = aiPrimitives.filter((v) => job.includes(v)).length;
    if (crudHits >= 1 && aiHits === 0) {
      out.push({
        ...basePreVerdict(c),
        feasibility_verdict: "simplify",
        recommended_status: "candidate_validated",
        reason: "business_job describe operaciones CRUD sin primitivas de IA. Posible mal clasificación.",
        required_actions: [
          "Reclasificar como form/crud si procede.",
          "O añadir primitiva de IA real (modelo, embedding, scoring) que justifique la clasificación actual.",
        ],
        rule: "R5_crud_misclassified",
      });
    }
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────────────
// Aggregator
// ───────────────────────────────────────────────────────────────────────────────

export function runAllRules(registry: ComponentRegistry | null | undefined): {
  verdicts: PreComponentVerdict[];
  risks: PreProjectRisk[];
} {
  const inflation = detectInflationByPhase(registry);
  const verdicts: PreComponentVerdict[] = [
    ...forceRequiresDataReadiness(registry),
    ...forceComplianceReviewIfDpia(registry),
    ...inflation.verdicts,
    ...detectCrudMisclassifiedAsAi(registry),
  ];
  const risks: PreProjectRisk[] = [
    ...detectSoulCaptureRisk(registry),
    ...inflation.risks,
  ];

  // Dedupe verdicts by component_id+rule (last write wins is fine here, but
  // typically each rule emits distinct components).
  const seen = new Map<string, PreComponentVerdict>();
  for (const v of verdicts) {
    seen.set(`${v.component_id}__${v.rule}`, v);
  }

  return { verdicts: [...seen.values()], risks };
}
