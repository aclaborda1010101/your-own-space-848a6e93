/**
 * f4b-deterministic-rules_test.ts
 */

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  forceRequiresDataReadiness,
  forceComplianceReviewIfDpia,
  detectSoulCaptureRisk,
  detectInflationByPhase,
  detectCrudMisclassifiedAsAi,
  runAllRules,
} from "./f4b-deterministic-rules.ts";

// ── R1 ────────────────────────────────────────────────────────────────────────

Deno.test("R1: matching_engine with dataset_readiness_required and no confirmed → requires_data_readiness", () => {
  const registry = {
    components: [{
      component_id: "COMP-C03",
      name: "Matching activo-inversor",
      family: "matching_engine",
      dataset_readiness_required: true,
      dataset_confirmed: false,
      status: "candidate_validated",
      priority: "P1_high",
    }],
  };
  const v = forceRequiresDataReadiness(registry);
  assertEquals(v.length, 1);
  assertEquals(v[0].feasibility_verdict, "requires_data_readiness");
  assertEquals(v[0].recommended_status, "blocked_pending_data");
});

Deno.test("R1: dataset_confirmed=true → no verdict", () => {
  const registry = {
    components: [{ component_id: "C1", dataset_readiness_required: true, dataset_confirmed: true }],
  };
  assertEquals(forceRequiresDataReadiness(registry).length, 0);
});

// ── R2 ────────────────────────────────────────────────────────────────────────

Deno.test("R2: DPIA required + personal_data_processing → requires_compliance_review", () => {
  const registry = {
    dpia: { required: true, status: "not_started" },
    components: [{
      component_id: "COMP-C03",
      compliance_flags: ["personal_data_processing", "human_in_the_loop_required"],
    }],
  };
  const v = forceComplianceReviewIfDpia(registry);
  assertEquals(v.length, 1);
  assertEquals(v[0].feasibility_verdict, "requires_compliance_review");
});

Deno.test("R2: DPIA not required → no verdicts", () => {
  const registry = {
    dpia: { required: false },
    components: [{ component_id: "C1", compliance_flags: ["personal_data_processing"] }],
  };
  assertEquals(forceComplianceReviewIfDpia(registry).length, 0);
});

// ── R3 ────────────────────────────────────────────────────────────────────────

Deno.test("R3: 4 components consult_soul → high risk", () => {
  const registry = {
    components: [
      { component_id: "C1", soul_dependency: "consults_soul" },
      { component_id: "C2", soul_dependency: "consults_soul" },
      { component_id: "C3", soul_dependency: "consults_soul" },
      { component_id: "C4", soul_dependency: "requires_soul_approval" },
    ],
  };
  const r = detectSoulCaptureRisk(registry);
  assertEquals(r.length, 1);
  assertEquals(r[0].severity, "high");
});

Deno.test("R3: 5+ components consult_soul → critical risk", () => {
  const registry = {
    components: Array.from({ length: 5 }, (_, i) => ({
      component_id: `C${i}`,
      soul_dependency: "consults_soul",
    })),
  };
  const r = detectSoulCaptureRisk(registry);
  assertEquals(r[0].severity, "critical");
});

Deno.test("R3: 2 dependents → no risk", () => {
  const registry = {
    components: [
      { component_id: "C1", soul_dependency: "consults_soul" },
      { component_id: "C2", soul_dependency: "consults_soul" },
    ],
  };
  assertEquals(detectSoulCaptureRisk(registry).length, 0);
});

// ── R4 ────────────────────────────────────────────────────────────────────────

Deno.test("R4: MVP with 8 AI components → defer 2 lowest priority", () => {
  const registry = {
    components: [
      { component_id: "C1", suggested_delivery_phase: "MVP", priority: "P0_critical" },
      { component_id: "C2", suggested_delivery_phase: "MVP", priority: "P0_critical" },
      { component_id: "C3", suggested_delivery_phase: "MVP", priority: "P1_high" },
      { component_id: "C4", suggested_delivery_phase: "MVP", priority: "P1_high" },
      { component_id: "C5", suggested_delivery_phase: "MVP", priority: "P1_high" },
      { component_id: "C6", suggested_delivery_phase: "MVP", priority: "P2_medium" },
      { component_id: "C7", suggested_delivery_phase: "MVP", priority: "P3_low" },
      { component_id: "C8", suggested_delivery_phase: "MVP", priority: "P3_low" },
    ],
  };
  const { verdicts, risks } = detectInflationByPhase(registry);
  assertEquals(verdicts.length, 2);
  assert(verdicts.every((v) => v.feasibility_verdict === "defer"));
  assertEquals(risks.length, 1);
  assertEquals(risks[0].severity, "high");
  // Deferred should be the lowest priority (P3).
  const deferredIds = verdicts.map((v) => v.component_id);
  assert(deferredIds.includes("C7") && deferredIds.includes("C8"));
});

Deno.test("R4: MVP with ≤6 components → no inflation", () => {
  const registry = {
    components: Array.from({ length: 6 }, (_, i) => ({
      component_id: `C${i}`,
      suggested_delivery_phase: "MVP",
      priority: "P1_high",
    })),
  };
  const { verdicts, risks } = detectInflationByPhase(registry);
  assertEquals(verdicts.length, 0);
  assertEquals(risks.length, 0);
});

// ── R5 ────────────────────────────────────────────────────────────────────────

Deno.test("R5: CRUD-style business_job without AI primitives → simplify", () => {
  const registry = {
    components: [{
      component_id: "C1",
      family: "agent",
      business_job: "Alta, baja y edición de fichas de inversor",
    }],
  };
  const v = detectCrudMisclassifiedAsAi(registry);
  assertEquals(v.length, 1);
  assertEquals(v[0].feasibility_verdict, "simplify");
});

Deno.test("R5: business_job with AI primitive → no verdict", () => {
  const registry = {
    components: [{
      component_id: "C1",
      family: "agent",
      business_job: "Alta de fichas con scoring de matching automatizado",
    }],
  };
  assertEquals(detectCrudMisclassifiedAsAi(registry).length, 0);
});

Deno.test("R5: family=form → ignored (already correctly classified)", () => {
  const registry = {
    components: [{ component_id: "F1", family: "form", business_job: "Alta de propietarios" }],
  };
  assertEquals(detectCrudMisclassifiedAsAi(registry).length, 0);
});

// ── runAllRules ───────────────────────────────────────────────────────────────

Deno.test("runAllRules: AFFLUX-like registry produces expected verdicts and risks", () => {
  const registry = {
    dpia: { required: true, status: "not_started" },
    components: [
      {
        component_id: "COMP-C03",
        name: "Matching activo-inversor",
        family: "matching_engine",
        suggested_delivery_phase: "F2",
        priority: "P1_high",
        dataset_readiness_required: true,
        compliance_flags: ["personal_data_processing", "commercial_prioritization", "human_in_the_loop_required"],
      },
      { component_id: "COMP-A01", soul_dependency: "consults_soul" },
      { component_id: "COMP-A02", soul_dependency: "consults_soul" },
      { component_id: "COMP-A03", soul_dependency: "consults_soul" },
      { component_id: "COMP-D01", family: "soul_module", layer: "D_soul" },
      { component_id: "COMP-G01", name: "Gobernanza RGPD" },
    ],
  };
  const { verdicts, risks } = runAllRules(registry);
  assert(verdicts.some((v) => v.component_id === "COMP-C03" && v.feasibility_verdict === "requires_data_readiness"));
  assert(verdicts.some((v) => v.component_id === "COMP-C03" && v.feasibility_verdict === "requires_compliance_review"));
  assert(risks.some((r) => r.rule === "R3_soul_capture_risk"));
});
