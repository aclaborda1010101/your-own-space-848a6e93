/**
 * f7-proposal-builder_test.ts
 */
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildClientProposal, renderProposalMarkdown, detectInternalJargon } from "./f7-proposal-builder.ts";
import type { ScopeArchitectureV1 } from "./f5-deterministic-scope.ts";

function fakeScope(): ScopeArchitectureV1 {
  return {
    schema_version: "1.0.0",
    data_foundation: [{
      scope_id: "SCOPE-001", source_type: "registry_component", source_ref: "COMP-A01",
      name: "Conocimiento base", bucket: "data_foundation", status: "approved_for_scope",
      blockers: [], required_actions: [], soul_dependency: "none",
      business_job: "Mantener la fuente de verdad de la operativa.",
    }],
    mvp: [{
      scope_id: "SCOPE-002", source_type: "registry_component", source_ref: "COMP-C01",
      name: "Detector de oportunidades", bucket: "mvp", status: "approved_with_conditions",
      blockers: [], required_actions: [], soul_dependency: "none",
      business_job: "Detectar oportunidades comerciales en el flujo entrante.",
    }],
    fast_follow_f2: [{
      scope_id: "SCOPE-003", source_type: "registry_component", source_ref: "COMP-C04",
      name: "Compradores institucionales (Benatar)", bucket: "fast_follow_f2",
      status: "deferred", blockers: [], required_actions: [], soul_dependency: "none",
    }],
    roadmap_f3: [],
    rejected_out_of_scope: [],
    compliance_blockers: [{
      scope_id: "SCOPE-002", component_name: "Detector de oportunidades",
      required_artifacts: ["DPIA"], reason: "Datos personales.",
      owner: "DPO / Responsable legal del cliente", deadline_weeks: 4,
      blocks_design: false, blocks_internal_testing: false, blocks_production: true,
    }],
    data_readiness_blockers: [],
    human_decisions_applied: [],
    soul_capture_plan: {
      required: true, sessions: 4, session_duration_min: 45, weeks_window: "weeks_1_to_2",
      deliverables: ["criterio"], hard_dependencies: ["COMP-D01"], async_dependencies: [],
      fallback: "Heurísticas.",
    },
    client_deliverables: { mvp_demo_features: [], documentation: [], training_sessions: [] },
    scope_decision_log: [],
  };
}

Deno.test("F7: produces a single proposal with budget and conditions", () => {
  const out = buildClientProposal({
    scope: fakeScope(),
    source_step: { step_number: 28, version: 3, row_id: "row-28" },
    projectName: "AFFLUX", clientName: "Cliente X",
    commercialTerms: {
      pricing_model: "setup_plus_monthly",
      setup_fee: 25000,
      monthly_retainer: 4500,
      currency: "EUR",
      payment_terms: "50% al inicio, 50% contra entrega.",
      validity_days: 30,
    },
  });
  const p = out.client_proposal_v1;
  assertEquals(p.mvp_scope.length, 2); // data_foundation + mvp
  assertEquals(p.later_phases.fast_follow.length, 1);
  assertEquals(p.later_phases.roadmap.length, 0);
  assertEquals(p.budget.setup_fee, 25000);
  assertEquals(p.budget.monthly_retainer, 4500);
  assert(p.conditions.some((c) => /cumplimiento/i.test(c)));
  assert(p.conditions.some((c) => /sesiones/i.test(c)));
  assert(p.implementation_plan.soul_sessions_required);
  assertEquals(p.implementation_plan.soul_sessions_count, 4);
});

Deno.test("F7: proposal markdown does NOT leak internal jargon", () => {
  const out = buildClientProposal({
    scope: fakeScope(),
    source_step: { step_number: 28, version: 3, row_id: "row-28" },
    projectName: "AFFLUX", clientName: "Cliente X",
    commercialTerms: { pricing_model: "fixed_project", setup_fee: 50000, currency: "EUR" },
  });
  const md = renderProposalMarkdown(out.client_proposal_v1);
  const jargon = detectInternalJargon(md);
  assertEquals(jargon, []);
  assert(md.includes("# Propuesta — AFFLUX"));
  assert(md.includes("## 11. Presupuesto"));
});

Deno.test("F7: requires pricing_model — meta counts coherent", () => {
  const out = buildClientProposal({
    scope: fakeScope(),
    source_step: { step_number: 28, version: 3, row_id: "row-28" },
    projectName: "AFFLUX", clientName: "Cliente X",
    commercialTerms: { pricing_model: "phased", phase_prices: [{ phase: "F1", price: 10000 }], currency: "EUR" },
  });
  assertEquals(out.proposal_meta.mvp_count, 2);
  assertEquals(out.proposal_meta.fast_follow_count, 1);
  assert(out.proposal_meta.has_compliance_blockers);
  assert(out.proposal_meta.soul_required);
});

Deno.test("F7: detectInternalJargon catches banned phrases", () => {
  const found = detectInternalJargon("This mentions Step 28 and F4b and registry_gap_audit_v1.");
  assert(found.length >= 3);
});
