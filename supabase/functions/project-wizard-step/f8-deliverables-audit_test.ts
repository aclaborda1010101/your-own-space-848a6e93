/**
 * f8-deliverables-audit_test.ts
 */
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildTechnicalPrd } from "./f6-prd-builder.ts";
import { buildClientProposal } from "./f7-proposal-builder.ts";
import { runFinalDeliverablesAudit } from "./f8-deliverables-audit.ts";
import type { ScopeArchitectureV1 } from "./f5-deterministic-scope.ts";

function scope(): ScopeArchitectureV1 {
  return {
    schema_version: "1.0.0",
    data_foundation: [{
      scope_id: "SCOPE-001", source_type: "registry_component", source_ref: "COMP-A01",
      name: "Base", bucket: "data_foundation", status: "approved_for_scope",
      blockers: [], required_actions: [], soul_dependency: "none",
    }],
    mvp: [{
      scope_id: "SCOPE-002", source_type: "registry_component", source_ref: "COMP-C01",
      name: "Detector", bucket: "mvp", status: "approved_with_conditions",
      blockers: [], required_actions: [], soul_dependency: "none",
    }],
    fast_follow_f2: [{
      scope_id: "SCOPE-003", source_type: "registry_component", source_ref: "COMP-C04",
      name: "Benatar", bucket: "fast_follow_f2", status: "deferred",
      blockers: [], required_actions: [], soul_dependency: "none",
    }],
    roadmap_f3: [],
    rejected_out_of_scope: [],
    compliance_blockers: [{
      scope_id: "SCOPE-002", component_name: "Detector",
      required_artifacts: ["DPIA"], reason: "Datos personales.",
      owner: "DPO", deadline_weeks: 4,
      blocks_design: false, blocks_internal_testing: false, blocks_production: true,
    }],
    data_readiness_blockers: [],
    human_decisions_applied: [],
    soul_capture_plan: {
      required: true, sessions: 4, session_duration_min: 45, weeks_window: "weeks_1_to_2",
      deliverables: [], hard_dependencies: [], async_dependencies: [], fallback: "ok",
    },
    client_deliverables: { mvp_demo_features: [], documentation: [], training_sessions: [] },
    scope_decision_log: [],
  };
}

Deno.test("F8: passes audit when PRD and proposal are coherent with scope", () => {
  const s = scope();
  const prd = buildTechnicalPrd({
    scope: s, source_step: { step_number: 28, version: 1, row_id: "r28" },
    projectName: "X", clientName: "Y",
  }).technical_prd_v1;
  const proposal = buildClientProposal({
    scope: s, source_step: { step_number: 28, version: 1, row_id: "r28" },
    projectName: "X", clientName: "Y",
    commercialTerms: { pricing_model: "fixed_project", setup_fee: 1000, currency: "EUR" },
  }).client_proposal_v1;
  const audit = runFinalDeliverablesAudit({
    scope: s, prd, proposal,
    source_steps: {
      scope_step: { step_number: 28, version: 1, row_id: "r28" },
      prd_step: { step_number: 29, version: 1, row_id: "r29" },
      proposal_step: { step_number: 30, version: 1, row_id: "r30" },
    },
  }).final_deliverables_audit_v1;
  assertEquals(audit.summary.errors, 0);
  assert(audit.summary.overall_status === "approved" || audit.summary.overall_status === "approved_with_warnings");
});

Deno.test("F8: detects Benatar promised as MVP (error)", () => {
  const s = scope();
  const prd = buildTechnicalPrd({
    scope: s, source_step: { step_number: 28, version: 1, row_id: "r28" },
    projectName: "X", clientName: "Y",
  }).technical_prd_v1;
  const proposal = buildClientProposal({
    scope: s, source_step: { step_number: 28, version: 1, row_id: "r28" },
    projectName: "X", clientName: "Y",
    commercialTerms: { pricing_model: "fixed_project", setup_fee: 1000, currency: "EUR" },
  }).client_proposal_v1;
  // Inject Benatar into MVP of proposal artificially.
  proposal.mvp_scope.push({ title: "Compradores institucionales (Benatar)", description: "x" });
  const audit = runFinalDeliverablesAudit({
    scope: s, prd, proposal,
    source_steps: {
      scope_step: { step_number: 28, version: 1, row_id: "r28" },
      prd_step: { step_number: 29, version: 1, row_id: "r29" },
      proposal_step: { step_number: 30, version: 1, row_id: "r30" },
    },
  }).final_deliverables_audit_v1;
  const benatarCheck = audit.checks.find((c) => c.id === "proposal_benatar_not_in_mvp");
  assertEquals(benatarCheck?.severity, "error");
  assert(audit.summary.errors >= 1);
  assertEquals(audit.summary.overall_status, "rejected");
});

Deno.test("F8: detects missing budget", () => {
  const s = scope();
  const prd = buildTechnicalPrd({
    scope: s, source_step: { step_number: 28, version: 1, row_id: "r28" },
    projectName: "X", clientName: "Y",
  }).technical_prd_v1;
  // Build a valid proposal first (F7 now rejects empty budgets), then strip
  // the budget amounts to simulate the legacy condition F8 must catch.
  const proposal = buildClientProposal({
    scope: s, source_step: { step_number: 28, version: 1, row_id: "r28" },
    projectName: "X", clientName: "Y",
    commercialTerms: { pricing_model: "fixed_project", setup_fee: 1, currency: "EUR" } as any,
  }).client_proposal_v1;
  proposal.budget.setup_fee = undefined;
  proposal.budget.monthly_retainer = undefined;
  proposal.budget.phase_prices = undefined;
  const audit = runFinalDeliverablesAudit({
    scope: s, prd, proposal,
    source_steps: {
      scope_step: { step_number: 28, version: 1, row_id: "r28" },
      prd_step: { step_number: 29, version: 1, row_id: "r29" },
      proposal_step: { step_number: 30, version: 1, row_id: "r30" },
    },
  }).final_deliverables_audit_v1;
  const budgetCheck = audit.checks.find((c) => c.id === "proposal_has_budget");
  assertEquals(budgetCheck?.severity, "error");
});
