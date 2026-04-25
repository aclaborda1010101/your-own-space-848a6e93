/**
 * f5-deterministic-scope_test.ts — Hard rules for F5 Scope Architect pre-warm.
 */
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  runDeterministicPreWarm,
  validateScopeTraceability,
} from "./f5-deterministic-scope.ts";

const REGISTRY = {
  components: [
    {
      component_id: "COMP-C01",
      name: "Detector de fallecimientos y herencias",
      family: "pattern_module",
      layer: "C_intelligence",
      priority: "P0_critical",
      status: "candidate_validated",
      dpia_required: true,
      compliance_flags: ["personal_data_processing", "external_data_enrichment"],
      soul_dependency: "none",
    },
    {
      component_id: "COMP-D01",
      name: "Soul de Alejandro",
      family: "executive_cognition_module",
      layer: "D_executive",
      priority: "P0_critical",
      status: "candidate_validated",
      soul_dependency: "hard",
    },
    {
      component_id: "COMP-B02",
      name: "Asistente comercial",
      family: "action_module",
      layer: "B_action",
      priority: "P1_high",
      status: "candidate_validated",
      soul_dependency: "hard", // must be downgraded
    },
    {
      component_id: "COMP-C03",
      name: "Matching activo-inversor",
      family: "pattern_module",
      layer: "C_intelligence",
      priority: "P1_high",
      status: "candidate_validated",
      soul_dependency: "hard",
    },
    {
      component_id: "COMP-C04",
      name: "Detector de compradores institucionales (Benatar)",
      family: "institutional_buyer_detector",
      layer: "C_intelligence",
      priority: "P1_high",
      status: "candidate_validated",
      suggested_delivery_phase: "F2",
    },
  ],
};

const FEASIBILITY = {
  component_reviews: [
    { component_id: "COMP-C01", feasibility_verdict: "requires_compliance_review", reason: "DPIA pendiente" },
    { component_id: "COMP-D01", feasibility_verdict: "keep" },
    { component_id: "COMP-B02", feasibility_verdict: "simplify", reason: "Reducir alcance" },
    { component_id: "COMP-C03", feasibility_verdict: "requires_data_readiness", reason: "Dataset insuficiente" },
    { component_id: "COMP-C04", feasibility_verdict: "defer", recommended_delivery_phase: "F2" },
  ],
  gap_reviews: [
    { gap_id: "GAP-001", verdict: "accept_but_defer", reason: "Benatar gap" },
    { gap_id: "GAP-002", verdict: "merge_into_existing", target_component_id: "COMP-C01", reason: "Cubierto" },
    { gap_id: "GAP-003", verdict: "reject", reason: "No real" },
  ],
};

const GAPS = {
  gaps: [
    {
      gap_id: "GAP-001",
      title: "Detector institucional",
      severity: "high",
      suggested_component_candidate: { name: "Detector de compradores institucionales (Benatar)", family: "institutional_buyer_detector" },
    },
    { gap_id: "GAP-002", title: "Otra cosa" },
    { gap_id: "GAP-003", title: "Cosa rechazada" },
  ],
};

Deno.test("F5 pre-warm: COMP-D01 lands in data_foundation with approved_for_scope", () => {
  const { scope } = runDeterministicPreWarm(REGISTRY, FEASIBILITY, GAPS);
  const soul = scope.data_foundation.find((c) => c.source_ref === "COMP-D01");
  assert(soul, "COMP-D01 must be in data_foundation");
  assertEquals(soul!.status, "approved_for_scope");
  assertEquals(soul!.soul_dependency, "hard");
  assert(soul!.blockers.some((b) => b.type === "soul_capture"));
});

Deno.test("F5 pre-warm: Benatar (COMP-C04) forced to fast_follow_f2, never MVP, never rejected", () => {
  const { scope } = runDeterministicPreWarm(REGISTRY, FEASIBILITY, GAPS);
  const inMvp = scope.mvp.find((c) => c.source_ref === "COMP-C04");
  const inFf = scope.fast_follow_f2.find((c) => c.source_ref === "COMP-C04");
  const inRej = scope.rejected_out_of_scope.find((c) => c.source_ref === "COMP-C04");
  assertEquals(inMvp, undefined);
  assertEquals(inRej, undefined);
  assert(inFf, "COMP-C04 must be in fast_follow_f2");
});

Deno.test("F5 pre-warm: COMP-B02 hard Soul dependency downgraded to async", () => {
  const { scope } = runDeterministicPreWarm(REGISTRY, FEASIBILITY, GAPS);
  const all = [...scope.mvp, ...scope.fast_follow_f2, ...scope.data_foundation];
  const b02 = all.find((c) => c.source_ref === "COMP-B02");
  assert(b02);
  assert(b02!.soul_dependency !== "hard", "B02 must not keep hard soul dependency");
});

Deno.test("F5 pre-warm: COMP-C01 → approved_with_conditions + compliance blocker (DPIA)", () => {
  const { scope } = runDeterministicPreWarm(REGISTRY, FEASIBILITY, GAPS);
  const c01 = scope.mvp.find((c) => c.source_ref === "COMP-C01");
  assert(c01);
  assertEquals(c01!.status, "approved_with_conditions");
  const compliance = c01!.blockers.find((b) => b.type === "compliance");
  assert(compliance);
  assertEquals(compliance!.blocks_production, true);
  assertEquals(compliance!.blocks_design, false);
  assert(compliance!.required_artifacts.includes("DPIA"));
});

Deno.test("F5 pre-warm: COMP-C03 → data_readiness blocker", () => {
  const { scope } = runDeterministicPreWarm(REGISTRY, FEASIBILITY, GAPS);
  const c03 = scope.mvp.find((c) => c.source_ref === "COMP-C03");
  assert(c03);
  assert(c03!.blockers.some((b) => b.type === "data_readiness"));
});

Deno.test("F5 pre-warm: only accepted gaps materialize as scope components", () => {
  const { scope, acceptable_gap_ids } = runDeterministicPreWarm(REGISTRY, FEASIBILITY, GAPS);
  const all = [
    ...scope.data_foundation, ...scope.mvp,
    ...scope.fast_follow_f2, ...scope.roadmap_f3, ...scope.rejected_out_of_scope,
  ];
  const fromGap002 = all.find((c) => c.source_type === "accepted_gap" && c.source_ref === "GAP-002");
  const fromGap003 = all.find((c) => c.source_type === "accepted_gap" && c.source_ref === "GAP-003");
  const fromGap001 = all.find((c) => c.source_type === "accepted_gap" && c.source_ref === "GAP-001");
  assertEquals(fromGap002, undefined, "merge_into_existing must NOT create a scope component");
  assertEquals(fromGap003, undefined, "rejected gap must NOT create a scope component");
  assert(fromGap001, "accept_but_defer gap must create a deferred scope component");
  assert(acceptable_gap_ids.has("GAP-001"));
});

Deno.test("F5 pre-warm: human_decisions_applied lists all 3 decisions", () => {
  const { scope } = runDeterministicPreWarm(REGISTRY, FEASIBILITY, GAPS);
  const ids = scope.human_decisions_applied.map((d) => d.decision_id);
  assert(ids.includes("soul_capture_plan_v1"));
  assert(ids.includes("benatar_defer_f2"));
  assert(ids.includes("dpia_parallel_track"));
});

Deno.test("F5 pre-warm: scope_decision_log has no entry called mutation_history", () => {
  const { scope } = runDeterministicPreWarm(REGISTRY, FEASIBILITY, GAPS);
  const text = JSON.stringify(scope);
  assert(!text.includes("mutation_history"), "F5 must NEVER use the term mutation_history");
  assert(scope.scope_decision_log.length > 0);
});

Deno.test("F5 pre-warm: soul_capture_plan classifies COMP-D01 as hard, others as async", () => {
  const { scope } = runDeterministicPreWarm(REGISTRY, FEASIBILITY, GAPS);
  assertEquals(scope.soul_capture_plan.required, true);
  assert(scope.soul_capture_plan.hard_dependencies.includes("COMP-D01"));
  assert(!scope.soul_capture_plan.hard_dependencies.includes("COMP-B02"));
});

Deno.test("F5 traceability validator: catches invented components", () => {
  const { scope, consumed_component_ids, acceptable_gap_ids } =
    runDeterministicPreWarm(REGISTRY, FEASIBILITY, GAPS);
  // Tamper: add a fake registry component
  scope.mvp.push({
    scope_id: "SCOPE-999",
    source_type: "registry_component",
    source_ref: "COMP-FAKE",
    name: "Inventado",
    status: "approved_for_scope",
    bucket: "mvp",
    blockers: [],
    required_actions: [],
  });
  const violations = validateScopeTraceability(scope, consumed_component_ids, acceptable_gap_ids);
  assertEquals(violations.length, 1);
  assertEquals(violations[0].source_ref, "COMP-FAKE");
});

Deno.test("F5 traceability validator: catches non-accepted gap references", () => {
  const { scope, consumed_component_ids, acceptable_gap_ids } =
    runDeterministicPreWarm(REGISTRY, FEASIBILITY, GAPS);
  scope.mvp.push({
    scope_id: "SCOPE-998",
    source_type: "accepted_gap",
    source_ref: "GAP-003", // F4b rejected
    name: "Gap rechazado",
    status: "approved_for_scope",
    bucket: "mvp",
    blockers: [],
    required_actions: [],
  });
  const violations = validateScopeTraceability(scope, consumed_component_ids, acceptable_gap_ids);
  assert(violations.some((v) => v.source_ref === "GAP-003"));
});
