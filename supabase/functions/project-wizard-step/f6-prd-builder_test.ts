/**
 * f6-prd-builder_test.ts
 */
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildTechnicalPrd, renderPrdMarkdown } from "./f6-prd-builder.ts";
import type { ScopeArchitectureV1 } from "./f5-deterministic-scope.ts";

function fakeScope(): ScopeArchitectureV1 {
  return {
    schema_version: "1.0.0",
    data_foundation: [{
      scope_id: "SCOPE-001", source_type: "registry_component", source_ref: "COMP-A01",
      name: "Conocimiento", bucket: "data_foundation", status: "approved_for_scope",
      blockers: [], required_actions: ["Validar esquema"], soul_dependency: "none",
    }],
    mvp: [{
      scope_id: "SCOPE-002", source_type: "registry_component", source_ref: "COMP-C03",
      name: "Matching", bucket: "mvp", status: "approved_with_conditions",
      blockers: [{
        type: "data_readiness", blocks_production: true, blocks_design: false,
        blocks_internal_testing: true, required_artifacts: ["dataset_audit"],
        reason: "Falta dataset.",
      }],
      required_actions: ["Auditar dataset"], soul_dependency: "async",
    }],
    fast_follow_f2: [{
      scope_id: "SCOPE-003", source_type: "registry_component", source_ref: "COMP-C04",
      name: "Benatar", bucket: "fast_follow_f2", status: "deferred",
      blockers: [], required_actions: [], soul_dependency: "none",
    }],
    roadmap_f3: [],
    rejected_out_of_scope: [],
    compliance_blockers: [{
      scope_id: "SCOPE-002", component_name: "Matching",
      required_artifacts: ["DPIA", "legal_basis"], reason: "Trata datos personales.",
      owner: "DPO / Responsable legal del cliente", deadline_weeks: 4,
      blocks_design: false, blocks_internal_testing: false, blocks_production: true,
    }],
    data_readiness_blockers: [{
      scope_id: "SCOPE-002", component_id: "COMP-C03", component_name: "Matching",
      dataset_required: "leads_historicos", current_readiness_pct: 30, min_readiness_for_mvp: 50,
      unblocking_actions: ["Limpiar duplicados", "Etiquetar 500 registros"],
      reason: "Por debajo del umbral.",
    }],
    human_decisions_applied: [{ decision_id: "benatar_defer_f2", label: "Benatar a F2", applied_to: ["COMP-C04"] }],
    soul_capture_plan: {
      required: true, sessions: 4, session_duration_min: 45, weeks_window: "weeks_1_to_2",
      deliverables: ["criterio_estrategico"], hard_dependencies: ["COMP-D01"],
      async_dependencies: ["COMP-C03"], fallback: "Heurísticas.",
    },
    client_deliverables: { mvp_demo_features: ["a"], documentation: ["PRD"], training_sessions: ["onboarding"] },
    scope_decision_log: [{
      source: "human_decision", decision_id: "soul_data_foundation", applied_to: "COMP-D01",
      action: "promote_to_data_foundation", reason: "Soul es base.",
    }],
  };
}

Deno.test("F6: builds PRD with traceable buckets and blockers", () => {
  const out = buildTechnicalPrd({
    scope: fakeScope(),
    source_step: { step_number: 28, version: 3, row_id: "row-28" },
    projectName: "AFFLUX", clientName: "Cliente X",
  });
  const prd = out.technical_prd_v1;
  assertEquals(prd.executive_summary.counts.data_foundation, 1);
  assertEquals(prd.executive_summary.counts.mvp, 1);
  assertEquals(prd.executive_summary.counts.fast_follow_f2, 1);
  assertEquals(prd.compliance_blockers.length, 1);
  assertEquals(prd.compliance_blockers[0].blocks_production, true);
  assertEquals(prd.compliance_blockers[0].blocks_design, false);
  assertEquals(prd.data_readiness_blockers.length, 1);
  // bucket order = DF → MVP → F2 → F3
  assertEquals(prd.buckets.map((b) => b.bucket), ["data_foundation", "mvp", "fast_follow_f2", "roadmap_f3"]);
  // acceptance criteria injected for compliance blocker
  const matching = prd.buckets[1].components[0];
  assert(matching.acceptance_criteria.some((c) => /Dataset/.test(c) || /readiness/i.test(c)));
});

Deno.test("F6: markdown renderer covers all major sections", () => {
  const out = buildTechnicalPrd({
    scope: fakeScope(),
    source_step: { step_number: 28, version: 3, row_id: "row-28" },
    projectName: "AFFLUX", clientName: "Cliente X",
  });
  const md = renderPrdMarkdown(out.technical_prd_v1);
  assert(md.includes("# PRD Técnico — AFFLUX"));
  assert(md.includes("## Data Foundation"));
  assert(md.includes("## MVP"));
  assert(md.includes("## Compliance blockers"));
  assert(md.includes("## Data readiness blockers"));
  assert(md.includes("## Soul capture plan"));
});

Deno.test("F6: meta counts match persisted scope", () => {
  const out = buildTechnicalPrd({
    scope: fakeScope(),
    source_step: { step_number: 28, version: 3, row_id: "row-28" },
    projectName: "AFFLUX", clientName: "Cliente X",
  });
  assertEquals(out.prd_meta.components_total, 3);
  assertEquals(out.prd_meta.components_by_bucket.mvp, 1);
});
