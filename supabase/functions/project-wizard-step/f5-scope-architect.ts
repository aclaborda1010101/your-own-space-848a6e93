/**
 * f5-scope-architect.ts — F5 orchestrator (Step 28).
 *
 * Reads Step 25 component_registry, Step 26 registry_gap_audit_v1, and Step 27
 * registry_feasibility_audit_v1. Runs deterministic pre-warm (applying the 3
 * human decisions + F4b verdicts as hard rules), then asks Gemini Pro @ 0.1 to
 * confirm/enrich required_actions and notes — but the LLM CANNOT invent
 * components, change buckets to introduce non-traceable items, or use
 * "approved_for_scope" outside the allowed structural fields.
 *
 * F5 is the first phase that may set status === "approved_for_scope".
 *
 * Created: 2026-04-25
 */

import { callGatewayRetry } from "./llm-helpers.ts";
import {
  PreWarmResult,
  ScopeArchitectureV1,
  ScopeComponent,
  TraceabilityViolation,
  runDeterministicPreWarm,
  validateScopeTraceability,
} from "./f5-deterministic-scope.ts";

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────

export interface F5ProjectContext {
  projectName?: string;
  companyName?: string;
}

export interface SourceStepRef {
  step_number: number;
  version: number;
  row_id: string;
}

export interface F5ScopeMeta {
  generated_at: string;
  f5_ms: number;
  llm_added_actions: number;
  llm_rejected_changes: number;
  traceability_violations_count: number;
  llm_error?: string;
  source_steps: {
    registry_step: SourceStepRef;
    gap_audit_step: SourceStepRef;
    feasibility_audit_step: SourceStepRef;
  };
  counts: {
    data_foundation: number;
    mvp: number;
    fast_follow_f2: number;
    roadmap_f3: number;
    rejected_out_of_scope: number;
    compliance_blockers: number;
    data_readiness_blockers: number;
    soul_hard_dependencies: number;
    soul_async_dependencies: number;
  };
}

export interface F5Output {
  scope_architecture_v1: ScopeArchitectureV1;
  scope_meta: F5ScopeMeta;
}

export type LlmCaller = (system: string, user: string) => Promise<{ text: string }>;

export interface RunF5Options {
  llmCaller?: LlmCaller;
  /** Skip LLM altogether (deterministic-only mode for tests). */
  skipLlm?: boolean;
}

// ───────────────────────────────────────────────────────────────────────────────
// LLM prompt
// ───────────────────────────────────────────────────────────────────────────────

const F5_SYSTEM_PROMPT = `Eres un Senior Scope Architect. Tu única tarea es ENRIQUECER (no inventar) un scope ya pre-construido por reglas deterministas. Devuelves SOLO JSON válido.

REGLAS DURAS — NO NEGOCIABLES:

1. NO inventes componentes nuevos. Trabaja exclusivamente sobre los scope_id que recibes.
2. NO muevas componentes entre buckets (data_foundation, mvp, fast_follow_f2, roadmap_f3, rejected_out_of_scope). El bucket es decisión determinista basada en F4b + decisiones humanas.
3. NO cambies status. Status también es determinista.
4. NO emitas "component_registry", "registry_gap_audit_v1" ni "registry_feasibility_audit_v1".
5. NO uses la palabra "mutation_history". F5 no muta el registry — registra decisiones en scope_decision_log.
6. SOLO puedes añadir entradas a "required_actions" y a "notes" por scope_id. Y proponer entradas adicionales en "scope_decision_log" con source="deterministic_rule" si justificas claramente.

CRITERIOS DE APROBACIÓN (referencia, no para que cambies status):

- approved_for_scope → keep, sin bloqueos.
- approved_with_conditions → simplify | requires_compliance_review | requires_data_readiness | requires_poc.
- deferred → defer, gap accept_but_defer.
- rejected → reject.

FORMATO DE SALIDA (estricto):
{
  "enrichments": [
    {
      "scope_id": "SCOPE-001",
      "additional_required_actions": ["string", ...],
      "notes": "string"
    }
  ],
  "additional_decision_log_entries": [
    {
      "decision_id": "string",
      "applied_to": "SCOPE-XXX | COMP-XX | GAP-XXX",
      "action": "string",
      "reason": "string"
    }
  ]
}`;

interface F5UserPromptInput {
  scope: ScopeArchitectureV1;
  ctx: F5ProjectContext;
}

function buildUserPrompt({ scope, ctx }: F5UserPromptInput): string {
  const compactComp = (c: ScopeComponent) => ({
    scope_id: c.scope_id,
    source_ref: c.source_ref,
    name: c.name,
    bucket: c.bucket,
    status: c.status,
    blockers: c.blockers.map((b) => ({ type: b.type, blocks_production: b.blocks_production })),
    soul_dependency: c.soul_dependency,
    required_actions: c.required_actions,
  });
  const summary = {
    data_foundation: scope.data_foundation.map(compactComp),
    mvp: scope.mvp.map(compactComp),
    fast_follow_f2: scope.fast_follow_f2.map(compactComp),
    roadmap_f3: scope.roadmap_f3.map(compactComp),
    rejected_out_of_scope: scope.rejected_out_of_scope.map(compactComp),
    soul_capture_plan: scope.soul_capture_plan,
    human_decisions_applied: scope.human_decisions_applied,
  };
  return `Proyecto: ${ctx.projectName ?? "?"} | Cliente: ${ctx.companyName ?? "?"}

SCOPE PRE-CONSTRUIDO (no muevas componentes ni cambies status; solo enriquece required_actions y notes):
${JSON.stringify(summary).substring(0, 38_000)}

Devuelve SOLO el JSON descrito.`;
}

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

function clampStringArray(arr: unknown, maxItems = 8, maxLen = 300): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, maxItems).map((s) => clampString(s, maxLen)).filter((s) => s.length > 0);
}

function applyEnrichments(scope: ScopeArchitectureV1, enrichments: any[]): number {
  if (!Array.isArray(enrichments)) return 0;
  const byScopeId = new Map<string, ScopeComponent>();
  const all: ScopeComponent[] = [
    ...scope.data_foundation,
    ...scope.mvp,
    ...scope.fast_follow_f2,
    ...scope.roadmap_f3,
    ...scope.rejected_out_of_scope,
  ];
  for (const c of all) byScopeId.set(c.scope_id, c);

  let added = 0;
  for (const e of enrichments) {
    const id = clampString(e?.scope_id, 40);
    const target = byScopeId.get(id);
    if (!target) continue;
    const extra = clampStringArray(e?.additional_required_actions, 8, 400);
    const before = target.required_actions.length;
    const seen = new Set(target.required_actions);
    for (const action of extra) {
      if (!seen.has(action)) {
        target.required_actions.push(action);
        seen.add(action);
      }
    }
    if (target.required_actions.length > before) added += target.required_actions.length - before;
    const note = clampString(e?.notes, 600);
    if (note) target.notes = target.notes ? `${target.notes}\n${note}` : note;
  }
  return added;
}

function appendDecisionLog(scope: ScopeArchitectureV1, entries: any[]): number {
  if (!Array.isArray(entries)) return 0;
  let count = 0;
  for (const e of entries) {
    const decision_id = clampString(e?.decision_id, 80);
    const applied_to = clampString(e?.applied_to, 80);
    const action = clampString(e?.action, 200);
    const reason = clampString(e?.reason, 600);
    if (!decision_id || !applied_to || !action) continue;
    scope.scope_decision_log.push({
      source: "deterministic_rule",
      decision_id,
      applied_to,
      action,
      reason: reason || "Enrichment from F5.",
    });
    count++;
  }
  return count;
}

function buildCounts(scope: ScopeArchitectureV1): F5ScopeMeta["counts"] {
  const all = [
    ...scope.data_foundation,
    ...scope.mvp,
    ...scope.fast_follow_f2,
    ...scope.roadmap_f3,
  ];
  return {
    data_foundation: scope.data_foundation.length,
    mvp: scope.mvp.length,
    fast_follow_f2: scope.fast_follow_f2.length,
    roadmap_f3: scope.roadmap_f3.length,
    rejected_out_of_scope: scope.rejected_out_of_scope.length,
    compliance_blockers: scope.compliance_blockers.length,
    data_readiness_blockers: scope.data_readiness_blockers.length,
    soul_hard_dependencies: all.filter((c) => c.soul_dependency === "hard").length,
    soul_async_dependencies: all.filter((c) => c.soul_dependency === "async").length,
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Public orchestrator
// ───────────────────────────────────────────────────────────────────────────────

export interface F5RunInput {
  step25Output: any;
  step26Output: any;
  step27Output: any;
  source_steps: F5ScopeMeta["source_steps"];
  ctx?: F5ProjectContext;
}

export class F5TraceabilityError extends Error {
  violations: TraceabilityViolation[];
  constructor(violations: TraceabilityViolation[]) {
    super(`F5 traceability validation failed: ${violations.length} violation(s).`);
    this.name = "F5TraceabilityError";
    this.violations = violations;
  }
}

export async function runF5ScopeArchitect(
  input: F5RunInput,
  opts: RunF5Options = {},
): Promise<F5Output> {
  const t0 = Date.now();

  const registry = input.step25Output?.component_registry ?? null;
  const feasibility = input.step27Output?.registry_feasibility_audit_v1 ?? null;
  const gapAudit = input.step26Output?.registry_gap_audit_v1 ?? null;

  if (!registry || !feasibility) {
    throw new Error("F5 requires Step 25 component_registry and Step 27 feasibility audit.");
  }

  // 1. Deterministic pre-warm — applies the 3 human decisions as hard rules.
  const pre: PreWarmResult = runDeterministicPreWarm(registry, feasibility, gapAudit);

  // 2. Optional LLM enrichment (Gemini Pro @ 0.1) — may only add actions/notes.
  let llmAddedActions = 0;
  let llmRejectedChanges = 0;
  let llmError: string | undefined;
  if (!opts.skipLlm) {
    const userPrompt = buildUserPrompt({ scope: pre.scope, ctx: input.ctx ?? {} });
    const llm = opts.llmCaller ?? ((s, u) => callGatewayRetry(s, u, "pro"));
    let text = "";
    try {
      const result = await llm(F5_SYSTEM_PROMPT, userPrompt);
      text = result.text;
    } catch (err) {
      llmError = err instanceof Error ? err.message : String(err);
      console.warn(`[F5] LLM error: ${llmError}`);
    }
    const parsed = parseJsonLoose(text) || {};
    llmAddedActions = applyEnrichments(pre.scope, parsed.enrichments);
    appendDecisionLog(pre.scope, parsed.additional_decision_log_entries);

    // Detect (and reject) any attempt to introduce new scope_ids or change buckets/status.
    const enrichments = Array.isArray(parsed.enrichments) ? parsed.enrichments : [];
    const knownIds = new Set<string>([
      ...pre.scope.data_foundation,
      ...pre.scope.mvp,
      ...pre.scope.fast_follow_f2,
      ...pre.scope.roadmap_f3,
      ...pre.scope.rejected_out_of_scope,
    ].map((c) => c.scope_id));
    for (const e of enrichments) {
      if (typeof e?.scope_id !== "string" || !knownIds.has(e.scope_id)) {
        llmRejectedChanges++;
      }
      if (e?.bucket || e?.status) llmRejectedChanges++;
    }
  }

  // 3. Hard traceability validation — refuses to persist if any violation.
  const violations = validateScopeTraceability(
    pre.scope,
    pre.consumed_component_ids,
    pre.acceptable_gap_ids,
  );
  if (violations.length > 0) {
    throw new F5TraceabilityError(violations);
  }

  // 4. Counts computed FROM the persisted scope (Precision 7).
  const counts = buildCounts(pre.scope);

  return {
    scope_architecture_v1: pre.scope,
    scope_meta: {
      generated_at: new Date().toISOString(),
      f5_ms: Date.now() - t0,
      llm_added_actions: llmAddedActions,
      llm_rejected_changes: llmRejectedChanges,
      traceability_violations_count: 0,
      ...(llmError ? { llm_error: llmError } : {}),
      source_steps: input.source_steps,
      counts,
    },
  };
}
