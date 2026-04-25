/**
 * f8-deliverables-audit.ts — Step 31 internal final-deliverables audit.
 *
 * Cross-checks Step 28 scope, Step 29 PRD and Step 30 proposal. Returns a
 * structured checklist (final_deliverables_audit_v1) for internal review.
 * NO PDF, no client-facing output, no LLM.
 *
 * Created: 2026-04-25
 */

import type { ScopeArchitectureV1 } from "./f5-deterministic-scope.ts";
import type { TechnicalPrdV1 } from "./f6-prd-builder.ts";
import type { ClientProposalV1 } from "./f7-proposal-builder.ts";
import { detectInternalJargon, renderProposalMarkdown } from "./f7-proposal-builder.ts";

export type CheckSeverity = "ok" | "warning" | "error";

export interface AuditCheck {
  id: string;
  label: string;
  severity: CheckSeverity;
  detail: string;
}

export interface FinalDeliverablesAuditV1 {
  schema_version: "1.0.0";
  generated_at: string;
  source_steps: {
    scope_step: { step_number: 28; version: number; row_id: string };
    prd_step: { step_number: 29; version: number; row_id: string };
    proposal_step: { step_number: 30; version: number; row_id: string };
  };
  summary: {
    total_checks: number;
    ok: number;
    warnings: number;
    errors: number;
    overall_status: "approved" | "approved_with_warnings" | "rejected";
  };
  checks: AuditCheck[];
}

export interface F8Input {
  scope: ScopeArchitectureV1;
  prd: TechnicalPrdV1;
  proposal: ClientProposalV1;
  source_steps: FinalDeliverablesAuditV1["source_steps"];
}

export interface F8Output {
  final_deliverables_audit_v1: FinalDeliverablesAuditV1;
}

export function runFinalDeliverablesAudit(input: F8Input): F8Output {
  const { scope, prd, proposal } = input;
  const checks: AuditCheck[] = [];

  // 1. PRD components must equal scope components.
  const scopeIds = new Set<string>();
  for (const k of ["data_foundation", "mvp", "fast_follow_f2", "roadmap_f3", "rejected_out_of_scope"] as const) {
    for (const c of scope[k] ?? []) scopeIds.add(c.scope_id);
  }
  const prdIds = new Set<string>();
  for (const b of prd.buckets) for (const c of b.components) prdIds.add(c.scope_id);
  for (const c of prd.out_of_scope) prdIds.add(c.scope_id);

  const missingInPrd = [...scopeIds].filter((id) => !prdIds.has(id));
  const extraInPrd = [...prdIds].filter((id) => !scopeIds.has(id));
  checks.push({
    id: "prd_traceability",
    label: "PRD incluye exactamente los componentes del alcance aprobado",
    severity: missingInPrd.length === 0 && extraInPrd.length === 0 ? "ok" : "error",
    detail:
      missingInPrd.length === 0 && extraInPrd.length === 0
        ? "PRD y alcance coinciden 1:1."
        : `Falta(n) en PRD: [${missingInPrd.join(", ")}] · Extra(s) en PRD: [${extraInPrd.join(", ")}]`,
  });

  // 2. Bucket counts match between scope and PRD.
  const bucketCheck = (key: "data_foundation" | "mvp" | "fast_follow_f2" | "roadmap_f3") => {
    const scopeN = (scope[key] ?? []).length;
    const prdN = (prd.buckets.find((b) => b.bucket === key)?.components ?? []).length;
    return { scopeN, prdN, ok: scopeN === prdN };
  };
  const bDF = bucketCheck("data_foundation");
  const bMVP = bucketCheck("mvp");
  const bF2 = bucketCheck("fast_follow_f2");
  const bF3 = bucketCheck("roadmap_f3");
  const bucketsOk = bDF.ok && bMVP.ok && bF2.ok && bF3.ok;
  checks.push({
    id: "prd_bucket_counts",
    label: "Counts por bucket coinciden entre alcance y PRD",
    severity: bucketsOk ? "ok" : "error",
    detail: bucketsOk
      ? "Counts iguales en data_foundation, mvp, fast_follow, roadmap."
      : `data_foundation ${bDF.scopeN}/${bDF.prdN} · mvp ${bMVP.scopeN}/${bMVP.prdN} · F2 ${bF2.scopeN}/${bF2.prdN} · F3 ${bF3.scopeN}/${bF3.prdN}`,
  });

  // 3. Proposal MVP count must equal scope (data_foundation + mvp).
  const proposalMvpExpected = (scope.data_foundation?.length ?? 0) + (scope.mvp?.length ?? 0);
  const proposalMvpActual = proposal.mvp_scope.length;
  checks.push({
    id: "proposal_mvp_count",
    label: "Propuesta refleja el MVP del alcance (data_foundation + mvp)",
    severity: proposalMvpExpected === proposalMvpActual ? "ok" : "error",
    detail: `esperado ${proposalMvpExpected}, propuesta ${proposalMvpActual}`,
  });

  // 4. Proposal must NOT promise rejected components.
  const rejectedNames = new Set(
    (scope.rejected_out_of_scope ?? []).map((c) => c.name.toLowerCase()),
  );
  const promisesRejected = proposal.mvp_scope
    .concat(proposal.later_phases.fast_follow)
    .concat(proposal.later_phases.roadmap)
    .map((it) => it.title.toLowerCase())
    .filter((t) => rejectedNames.has(t));
  checks.push({
    id: "proposal_no_rejected_promises",
    label: "Propuesta no incluye componentes rechazados",
    severity: promisesRejected.length === 0 ? "ok" : "error",
    detail:
      promisesRejected.length === 0
        ? "Sin componentes rechazados promocionados."
        : `Encontrados: ${promisesRejected.join(", ")}`,
  });

  // 5. Benatar (institutional buyer) must NOT appear in proposal MVP.
  const benatarInMvp = proposal.mvp_scope.some((it) =>
    /benatar|compradores institucionales/i.test(it.title + " " + it.description),
  );
  checks.push({
    id: "proposal_benatar_not_in_mvp",
    label: "Propuesta no promete Benatar / compradores institucionales como MVP",
    severity: benatarInMvp ? "error" : "ok",
    detail: benatarInMvp ? "Benatar aparece en MVP de la propuesta." : "OK.",
  });

  // 6. Conditions must surface compliance + dataset readiness when present.
  const hasCompliance = (scope.compliance_blockers?.length ?? 0) > 0;
  const hasDataReadiness = (scope.data_readiness_blockers?.length ?? 0) > 0;
  const conditionsText = proposal.conditions.join(" ").toLowerCase();
  const mentionsCompliance = /cumplimiento|dpia|legal|hitl|retenci/i.test(conditionsText);
  const mentionsData = /dataset|datos|preparaci/i.test(conditionsText);
  checks.push({
    id: "proposal_conditions_surface_blockers",
    label: "Propuesta incluye condiciones para compliance y dataset readiness",
    severity:
      (!hasCompliance || mentionsCompliance) && (!hasDataReadiness || mentionsData)
        ? "ok"
        : "warning",
    detail:
      `compliance ${hasCompliance ? "presente" : "n/a"} → ${mentionsCompliance ? "mencionado" : "FALTA"}; ` +
      `data_readiness ${hasDataReadiness ? "presente" : "n/a"} → ${mentionsData ? "mencionado" : "FALTA"}`,
  });

  // 7. Soul sessions count consistent.
  if (scope.soul_capture_plan?.required) {
    const expected = scope.soul_capture_plan.sessions;
    const inProposal = proposal.implementation_plan.soul_sessions_count;
    checks.push({
      id: "soul_sessions_match",
      label: "Sesiones Soul coherentes entre alcance y propuesta",
      severity: expected === inProposal ? "ok" : "error",
      detail: `alcance ${expected}, propuesta ${inProposal}`,
    });
  }

  // 8. Budget present.
  const hasBudget =
    proposal.budget.setup_fee !== undefined ||
    proposal.budget.monthly_retainer !== undefined ||
    (proposal.budget.phase_prices && proposal.budget.phase_prices.length > 0);
  checks.push({
    id: "proposal_has_budget",
    label: "Propuesta incluye presupuesto",
    severity: hasBudget ? "ok" : "error",
    detail: hasBudget ? "Presupuesto presente." : "Sin precios definidos.",
  });

  // 9. Timeline / payment terms present.
  checks.push({
    id: "proposal_has_payment_terms",
    label: "Propuesta incluye condiciones de pago",
    severity: proposal.payment_terms?.trim() ? "ok" : "error",
    detail: proposal.payment_terms?.trim() ? "OK." : "FALTA.",
  });

  // 10. No internal jargon in client proposal markdown.
  const md = renderProposalMarkdown(proposal);
  const jargon = detectInternalJargon(md);
  checks.push({
    id: "proposal_no_internal_jargon",
    label: "Propuesta cliente sin terminología interna",
    severity: jargon.length === 0 ? "ok" : "warning",
    detail: jargon.length === 0 ? "Sin jerga interna detectada." : `Detectado: ${jargon.join(", ")}`,
  });

  // ── Roll-up
  const ok = checks.filter((c) => c.severity === "ok").length;
  const warnings = checks.filter((c) => c.severity === "warning").length;
  const errors = checks.filter((c) => c.severity === "error").length;
  const overall =
    errors > 0 ? "rejected" : warnings > 0 ? "approved_with_warnings" : "approved";

  return {
    final_deliverables_audit_v1: {
      schema_version: "1.0.0",
      generated_at: new Date().toISOString(),
      source_steps: input.source_steps,
      summary: {
        total_checks: checks.length,
        ok,
        warnings,
        errors,
        overall_status: overall,
      },
      checks,
    },
  };
}
