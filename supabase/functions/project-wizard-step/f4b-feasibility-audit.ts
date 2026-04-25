/**
 * f4b-feasibility-audit.ts — F4b orchestrator (the brake).
 *
 * Reads Step 25 v3 component_registry + Step 26 registry_gap_audit_v1.
 * Runs deterministic feasibility/anti-inflation rules as pre-warm, then asks
 * the LLM (Gemini Pro @ 0.1) to confirm/expand/reject component verdicts and
 * gap dispositions. Emits `registry_feasibility_audit_v1` for Step 27 persistence.
 *
 * F4b NEVER mutates the registry. Only audits and recommends.
 *
 * Created: 2026-04-25
 */

import { callGatewayRetry } from "./llm-helpers.ts";
import {
  PreComponentVerdict,
  PreProjectRisk,
  FeasibilityVerdict,
  RiskSeverity,
  runAllRules,
} from "./f4b-deterministic-rules.ts";

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────

export type GapDispositionVerdict =
  | "accept_as_new_component"
  | "accept_but_defer"
  | "merge_into_existing"
  | "reject"
  | "needs_human_decision";

export type RecommendedNextStep =
  | "proceed_to_scope_architect"
  | "revise_registry"
  | "human_review_required";

export interface ComponentReview {
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
  source: "deterministic" | "llm";
  rule?: string;
}

export interface GapReview {
  gap_id: string;
  verdict: GapDispositionVerdict;
  target_component_id?: string;
  reason: string;
  source: "deterministic" | "llm";
}

export interface ProjectRisk {
  risk: string;
  severity: RiskSeverity;
  mitigation: string;
  source: "deterministic" | "llm";
  rule?: string;
}

export interface RegistryFeasibilityAuditV1 {
  audit_version: "1.0.0";
  registry_version_reviewed: string | null;
  gap_audit_reviewed_at: string | null;
  component_reviews: ComponentReview[];
  gap_reviews: GapReview[];
  top_project_risks: ProjectRisk[];
  recommended_next_step: RecommendedNextStep;
  recommended_next_step_reason: string;
}

export interface F4bOutput {
  registry_feasibility_audit_v1: RegistryFeasibilityAuditV1;
  audit_meta: {
    generated_at: string;
    f4b_ms: number;
    deterministic_pre_verdicts: number;
    deterministic_pre_risks: number;
    llm_added_reviews: number;
    llm_rejected_pre_verdicts: number;
    llm_added_risks: number;
    llm_error?: string;
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Validators
// ───────────────────────────────────────────────────────────────────────────────

const VALID_VERDICTS = new Set<FeasibilityVerdict>([
  "keep", "simplify", "defer", "requires_poc",
  "requires_data_readiness", "requires_compliance_review", "reject",
]);
const VALID_GAP_VERDICTS = new Set<GapDispositionVerdict>([
  "accept_as_new_component", "accept_but_defer", "merge_into_existing",
  "reject", "needs_human_decision",
]);
const VALID_SEVERITIES = new Set<RiskSeverity>(["low", "medium", "high", "critical"]);
const VALID_NEXT_STEPS = new Set<RecommendedNextStep>([
  "proceed_to_scope_architect", "revise_registry", "human_review_required",
]);

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────────

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

function clampString(s: unknown, max = 500): string {
  if (typeof s !== "string") return "";
  return s.length > max ? s.substring(0, max) : s;
}

function clampStringArray(arr: unknown, maxItems = 10, maxLen = 300): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, maxItems).map((s) => clampString(s, maxLen)).filter((s) => s.length > 0);
}

function fromPreVerdict(v: PreComponentVerdict): ComponentReview {
  return {
    component_id: v.component_id,
    current_status: v.current_status,
    current_priority: v.current_priority,
    current_phase: v.current_phase,
    feasibility_verdict: v.feasibility_verdict,
    recommended_status: v.recommended_status,
    recommended_priority: v.recommended_priority,
    recommended_delivery_phase: v.recommended_delivery_phase,
    reason: v.reason,
    required_actions: v.required_actions,
    source: "deterministic",
    rule: v.rule,
  };
}

function fromPreRisk(r: PreProjectRisk): ProjectRisk {
  return {
    risk: r.risk,
    severity: r.severity,
    mitigation: r.mitigation,
    source: "deterministic",
    rule: r.rule,
  };
}

function fromLlmReview(raw: any): ComponentReview | null {
  if (!raw || typeof raw !== "object") return null;
  const component_id = clampString(raw.component_id, 80);
  const verdict = raw.feasibility_verdict;
  if (!component_id || !VALID_VERDICTS.has(verdict)) return null;
  return {
    component_id,
    current_status: clampString(raw.current_status, 60) || "unknown",
    current_priority: clampString(raw.current_priority, 40) || "unknown",
    current_phase: clampString(raw.current_phase, 40) || "unknown",
    feasibility_verdict: verdict,
    recommended_status: raw.recommended_status ? clampString(raw.recommended_status, 60) : undefined,
    recommended_priority: raw.recommended_priority ? clampString(raw.recommended_priority, 40) : undefined,
    recommended_delivery_phase: raw.recommended_delivery_phase ? clampString(raw.recommended_delivery_phase, 40) : undefined,
    reason: clampString(raw.reason, 800) || "Sin razón explícita.",
    required_actions: clampStringArray(raw.required_actions, 10, 400),
    source: "llm",
  };
}

function fromLlmGapReview(raw: any): GapReview | null {
  if (!raw || typeof raw !== "object") return null;
  const gap_id = clampString(raw.gap_id, 40);
  const verdict = raw.verdict;
  if (!gap_id || !VALID_GAP_VERDICTS.has(verdict)) return null;
  return {
    gap_id,
    verdict,
    target_component_id: raw.target_component_id ? clampString(raw.target_component_id, 80) : undefined,
    reason: clampString(raw.reason, 600) || "Sin razón explícita.",
    source: "llm",
  };
}

function fromLlmRisk(raw: any): ProjectRisk | null {
  if (!raw || typeof raw !== "object") return null;
  const severity = raw.severity;
  if (!VALID_SEVERITIES.has(severity)) return null;
  const risk = clampString(raw.risk, 400);
  if (!risk) return null;
  return {
    risk,
    severity,
    mitigation: clampString(raw.mitigation, 600) || "Sin mitigación propuesta.",
    source: "llm",
  };
}

function emptyAudit(stepVer: string | null, errMsg?: string): F4bOutput {
  return {
    registry_feasibility_audit_v1: {
      audit_version: "1.0.0",
      registry_version_reviewed: stepVer,
      gap_audit_reviewed_at: null,
      component_reviews: [],
      gap_reviews: [],
      top_project_risks: [],
      recommended_next_step: "human_review_required",
      recommended_next_step_reason: errMsg || "Auditoría no pudo completarse.",
    },
    audit_meta: {
      generated_at: new Date().toISOString(),
      f4b_ms: 0,
      deterministic_pre_verdicts: 0,
      deterministic_pre_risks: 0,
      llm_added_reviews: 0,
      llm_rejected_pre_verdicts: 0,
      llm_added_risks: 0,
      ...(errMsg ? { llm_error: errMsg } : {}),
    },
  };
}

function decideNextStep(
  reviews: ComponentReview[],
  risks: ProjectRisk[],
  gapReviews: GapReview[],
): { step: RecommendedNextStep; reason: string } {
  const criticalRisks = risks.filter((r) => r.severity === "critical").length;
  const rejects = reviews.filter((r) => r.feasibility_verdict === "reject").length;
  const blockers = reviews.filter((r) =>
    r.feasibility_verdict === "requires_data_readiness" ||
    r.feasibility_verdict === "requires_compliance_review"
  ).length;
  const needsHuman = gapReviews.filter((g) => g.verdict === "needs_human_decision").length;

  if (criticalRisks > 0 || needsHuman > 0) {
    return {
      step: "human_review_required",
      reason: `${criticalRisks} riesgo(s) crítico(s) y ${needsHuman} gap(s) requieren decisión humana.`,
    };
  }
  if (rejects > 0) {
    return {
      step: "revise_registry",
      reason: `${rejects} componente(s) rechazado(s) por F4b — revisar registry antes de scope.`,
    };
  }
  return {
    step: "proceed_to_scope_architect",
    reason: blockers > 0
      ? `${blockers} componente(s) en bloqueo blando (datos/compliance) pero el resto puede avanzar a scope.`
      : "Sin bloqueos detectados — registry listo para scope architect.",
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Prompt
// ───────────────────────────────────────────────────────────────────────────────

const F4B_SYSTEM_PROMPT = `Eres un Senior AI Solutions Auditor especializado en feasibility y anti-inflación de scope. Tu tarea es revisar el component_registry de Step 25 y el gap audit de Step 26, y emitir un veredicto por componente y por gap, en formato JSON estricto.

REGLAS DURAS:

1. NUNCA propongas mutar el registry. Solo audita y recomienda.
2. NUNCA emitas \`component_registry\` ni \`ai_opportunity_design_v1\` en tu output.
3. NUNCA uses status "approved_for_scope" — está prohibido en F4b.
4. Devuelve SOLO JSON válido con la estructura exacta descrita abajo. Sin texto adicional, sin markdown.

CRITERIOS DE FEASIBILITY:

- "keep" → componente válido tal como está.
- "simplify" → reducir alcance/complejidad antes de implementar.
- "defer" → mover a fase posterior (F2, roadmap).
- "requires_poc" → necesita prototipo antes de comprometer scope.
- "requires_data_readiness" → bloqueado hasta validar dataset.
- "requires_compliance_review" → bloqueado hasta DPIA / revisión legal.
- "reject" → no debería estar en el registry.

CRITERIOS DE GAP DISPOSITION:

- "accept_as_new_component" → el gap es válido y debe convertirse en componente.
- "accept_but_defer" → válido pero no en MVP.
- "merge_into_existing" → ya está cubierto por un componente existente (especificar target_component_id).
- "reject" → no es un gap real.
- "needs_human_decision" → ambiguo, requiere stakeholder.

RIESGOS DE PROYECTO:

Identifica riesgos que afecten la viabilidad: captura del Soul, dependencias externas frágiles, MVP inflado, dataset insuficiente, compliance no resuelto, latencia/coste.

PRE_VERDICTS / PRE_RISKS:

Recibirás veredictos y riesgos pre-detectados por reglas deterministas. Para cada uno DEBES:
- Confirmarlo (incluyéndolo, pudiendo enriquecer reason o required_actions).
- Rechazarlo explícitamente añadiéndolo a "rejected_pre_verdict_keys" con justificación en "rejection_reasons".
NO los ignores en silencio.

FORMATO DE SALIDA (estricto):
{
  "component_reviews": [
    {
      "component_id": "COMP-XXX",
      "current_status": "string",
      "current_priority": "string",
      "current_phase": "string",
      "feasibility_verdict": "keep | simplify | defer | requires_poc | requires_data_readiness | requires_compliance_review | reject",
      "recommended_status": "string (optional)",
      "recommended_priority": "string (optional)",
      "recommended_delivery_phase": "string (optional)",
      "reason": "string",
      "required_actions": ["string", ...]
    }
  ],
  "gap_reviews": [
    {
      "gap_id": "GAP-NNN",
      "verdict": "accept_as_new_component | accept_but_defer | merge_into_existing | reject | needs_human_decision",
      "target_component_id": "COMP-XXX (optional, requerido si verdict=merge_into_existing)",
      "reason": "string"
    }
  ],
  "top_project_risks": [
    {
      "risk": "string",
      "severity": "low | medium | high | critical",
      "mitigation": "string"
    }
  ],
  "rejected_pre_verdict_keys": ["component_id__rule", ...],
  "rejection_reasons": { "<key>": "razón" }
}`;

interface F4bUserPromptInput {
  registry: any;
  gapAudit: any;
  preVerdicts: PreComponentVerdict[];
  preRisks: PreProjectRisk[];
  ctx: F4bProjectContext;
}

function buildUserPrompt({ registry, gapAudit, preVerdicts, preRisks, ctx }: F4bUserPromptInput): string {
  const compact = (Array.isArray(registry?.components) ? registry.components : []).map((c: any) => ({
    id: c.component_id || c.id,
    name: c.name,
    family: c.family,
    layer: c.layer,
    status: c.status,
    priority: c.priority,
    suggested_delivery_phase: c.suggested_delivery_phase ?? c.delivery_phase,
    business_job: c.business_job,
    soul_dependency: c.soul_dependency,
    compliance_flags: c.compliance_flags,
    dataset_readiness_required: c.dataset_readiness_required,
    dataset_confirmed: c.dataset_confirmed,
    external_sources: c.external_sources,
  }));
  const compactStr = JSON.stringify(compact).substring(0, 40_000);

  const gapsCompact = Array.isArray(gapAudit?.gaps)
    ? gapAudit.gaps.map((g: any) => ({
        gap_id: g.gap_id,
        title: g.title,
        gap_type: g.gap_type,
        severity: g.severity,
        suggested_action: g.suggested_action,
        affected_registry_components: g.affected_registry_components,
        suggested_component_candidate: g.suggested_component_candidate?.name,
      }))
    : [];
  const gapsStr = JSON.stringify(gapsCompact).substring(0, 25_000);

  const dpia = registry?.dpia ? JSON.stringify(registry.dpia) : "(sin DPIA declarada)";

  return `Proyecto: ${ctx.projectName ?? "?"} | Cliente: ${ctx.companyName ?? "?"}

REGISTRY (compactado):
${compactStr}

DPIA: ${dpia}

GAPS de F4a (Step 26):
${gapsStr}

PRE_VERDICTS (reglas deterministas — confirma o rechaza explícitamente cada uno):
${JSON.stringify(preVerdicts).substring(0, 15_000)}

PRE_RISKS (reglas deterministas):
${JSON.stringify(preRisks).substring(0, 8_000)}

Audita y devuelve SOLO el JSON descrito.`;
}

// ───────────────────────────────────────────────────────────────────────────────
// Orchestrator
// ───────────────────────────────────────────────────────────────────────────────

export interface F4bProjectContext {
  projectName?: string;
  companyName?: string;
}

export type LlmCaller = (system: string, user: string) => Promise<{ text: string }>;

export interface RunF4bOptions {
  /** Inject a mock LLM caller for tests. Defaults to Gemini Pro @ 0.1. */
  llmCaller?: LlmCaller;
}

export async function runF4bFeasibilityAudit(
  step25Output: any,
  step26GapAudit: any,
  ctx: F4bProjectContext = {},
  opts: RunF4bOptions = {},
): Promise<F4bOutput> {
  const t0 = Date.now();
  const stepVer = step25Output?.build_meta?.generated_at ? String(step25Output.build_meta.generated_at) : null;
  const gapAuditVer = step26GapAudit?.audit_meta?.generated_at ? String(step26GapAudit.audit_meta.generated_at) : null;

  if (!step25Output || typeof step25Output !== "object") {
    return emptyAudit(stepVer, "empty_step25");
  }

  const registry = step25Output.component_registry ?? null;
  const gapAudit = step26GapAudit?.registry_gap_audit_v1 ?? step26GapAudit ?? null;

  // 1. Pre-warm with deterministic rules.
  const { verdicts: preVerdicts, risks: preRisks } = runAllRules(registry);

  // 2. LLM call (Gemini Pro @ 0.1).
  const userPrompt = buildUserPrompt({ registry, gapAudit, preVerdicts, preRisks, ctx });
  const llm = opts.llmCaller ?? ((s, u) => callGatewayRetry(s, u, "pro"));

  let llmResult: { text: string };
  let llmError: string | undefined;
  try {
    llmResult = await llm(F4B_SYSTEM_PROMPT, userPrompt);
  } catch (err) {
    llmError = err instanceof Error ? err.message : String(err);
    console.warn(`[F4b] LLM error: ${llmError}`);
    llmResult = { text: "" };
  }

  const parsed = parseJsonLoose(llmResult.text) || {};
  const llmReviewsRaw = Array.isArray(parsed.component_reviews) ? parsed.component_reviews : [];
  const llmGapReviewsRaw = Array.isArray(parsed.gap_reviews) ? parsed.gap_reviews : [];
  const llmRisksRaw = Array.isArray(parsed.top_project_risks) ? parsed.top_project_risks : [];
  const rejectedKeys = new Set<string>(
    Array.isArray(parsed.rejected_pre_verdict_keys)
      ? parsed.rejected_pre_verdict_keys.filter((k: any) => typeof k === "string")
      : [],
  );

  // 3. Merge component_reviews: deterministic verdicts survive unless explicitly rejected.
  // Key for rejection match: component_id__rule.
  const componentReviews: ComponentReview[] = [];
  const seenComponentVerdicts = new Set<string>();

  for (const pre of preVerdicts) {
    const key = `${pre.component_id}__${pre.rule}`;
    if (rejectedKeys.has(key)) continue;
    componentReviews.push(fromPreVerdict(pre));
    seenComponentVerdicts.add(`${pre.component_id}__${pre.feasibility_verdict}`);
  }

  let llmAddedReviews = 0;
  for (const raw of llmReviewsRaw) {
    const rev = fromLlmReview(raw);
    if (!rev) continue;
    const dupKey = `${rev.component_id}__${rev.feasibility_verdict}`;
    if (seenComponentVerdicts.has(dupKey)) continue;
    componentReviews.push(rev);
    seenComponentVerdicts.add(dupKey);
    llmAddedReviews++;
  }

  // 4. Gap reviews — purely from LLM (gaps come from F4a). Validate + dedupe.
  const seenGapIds = new Set<string>();
  const gapReviews: GapReview[] = [];
  for (const raw of llmGapReviewsRaw) {
    const gr = fromLlmGapReview(raw);
    if (!gr) continue;
    if (seenGapIds.has(gr.gap_id)) continue;
    seenGapIds.add(gr.gap_id);
    gapReviews.push(gr);
  }

  // 5. Risks — deterministic + LLM (dedupe by risk text lowercased).
  const projectRisks: ProjectRisk[] = [];
  const seenRisks = new Set<string>();
  for (const r of preRisks) {
    const key = r.risk.toLowerCase().trim();
    if (seenRisks.has(key)) continue;
    seenRisks.add(key);
    projectRisks.push(fromPreRisk(r));
  }
  let llmAddedRisks = 0;
  for (const raw of llmRisksRaw) {
    const r = fromLlmRisk(raw);
    if (!r) continue;
    const key = r.risk.toLowerCase().trim();
    if (seenRisks.has(key)) continue;
    seenRisks.add(key);
    projectRisks.push(r);
    llmAddedRisks++;
  }

  // 6. Decide next step (LLM hint allowed, but our deterministic decision wins).
  const llmNextStep = parsed.recommended_next_step;
  const decision = decideNextStep(componentReviews, projectRisks, gapReviews);
  const finalNextStep: RecommendedNextStep = VALID_NEXT_STEPS.has(llmNextStep) && llmNextStep === decision.step
    ? llmNextStep
    : decision.step;

  return {
    registry_feasibility_audit_v1: {
      audit_version: "1.0.0",
      registry_version_reviewed: stepVer,
      gap_audit_reviewed_at: gapAuditVer,
      component_reviews: componentReviews,
      gap_reviews: gapReviews,
      top_project_risks: projectRisks,
      recommended_next_step: finalNextStep,
      recommended_next_step_reason: decision.reason,
    },
    audit_meta: {
      generated_at: new Date().toISOString(),
      f4b_ms: Date.now() - t0,
      deterministic_pre_verdicts: preVerdicts.length,
      deterministic_pre_risks: preRisks.length,
      llm_added_reviews: llmAddedReviews,
      llm_rejected_pre_verdicts: rejectedKeys.size,
      llm_added_risks: llmAddedRisks,
      ...(llmError ? { llm_error: llmError } : {}),
    },
  };
}
