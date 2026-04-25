/**
 * f4b-feasibility-audit_test.ts — F4b orchestrator tests with mocked LLM (Pro 0.1).
 */

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runF4bFeasibilityAudit } from "./f4b-feasibility-audit.ts";

const sampleStep25 = {
  build_meta: { generated_at: "2026-04-25T11:00:00Z" },
  component_registry: {
    dpia: { required: true, status: "not_started" },
    components: [
      {
        component_id: "COMP-M01",
        name: "Matching activo-inversor",
        family: "matching_engine",
        status: "candidate_validated",
        priority: "P1_high",
        suggested_delivery_phase: "MVP",
        business_job: "Matching de activos con inversores institucionales.",
        soul_dependency: "consults_soul",
        compliance_flags: ["personal_data_processing", "commercial_prioritization"],
        dataset_readiness_required: true,
        dataset_confirmed: false,
      },
      {
        component_id: "COMP-S01",
        name: "Soul de Alejandro",
        family: "executive_cognition",
        status: "candidate_validated",
        priority: "P0_critical",
        suggested_delivery_phase: "MVP",
        business_job: "Encapsular el criterio del fundador.",
        soul_dependency: "self",
      },
      {
        component_id: "COMP-A01",
        name: "Agente comercial",
        family: "agent",
        status: "candidate_validated",
        priority: "P1_high",
        suggested_delivery_phase: "MVP",
        business_job: "Asistir al equipo comercial.",
        soul_dependency: "consults_soul",
      },
      {
        component_id: "COMP-A02",
        name: "Especialista valoración",
        family: "specialist",
        status: "candidate_validated",
        priority: "P1_high",
        suggested_delivery_phase: "MVP",
        business_job: "Valorar activos.",
        soul_dependency: "consults_soul",
      },
    ],
  },
};

const sampleStep26 = {
  audit_meta: { generated_at: "2026-04-25T11:30:00Z" },
  registry_gap_audit_v1: {
    audit_version: "1.0.0",
    gaps: [
      {
        gap_id: "GAP-001",
        title: "Detector compradores institucionales tipo Benatar",
        gap_type: "missing_component",
        severity: "high",
        suggested_action: "add_component",
        affected_registry_components: [],
        evidence: ["Benatar mencionado explícitamente"],
      },
      {
        gap_id: "GAP-002",
        title: "Pipeline de transcripción",
        gap_type: "missing_component",
        severity: "medium",
        suggested_action: "add_component",
        affected_registry_components: [],
        evidence: ["Llamadas grabadas con Plaud"],
      },
    ],
  },
};

const emptyLlm = async () => ({ text: JSON.stringify({ component_reviews: [], gap_reviews: [], top_project_risks: [] }) });

Deno.test("F4b: matching_engine with dataset_readiness_required → requires_data_readiness verdict (deterministic)", async () => {
  const out = await runF4bFeasibilityAudit(sampleStep25, sampleStep26, {}, { llmCaller: emptyLlm });
  const matchingReview = out.registry_feasibility_audit_v1.component_reviews.find(
    (r) => r.component_id === "COMP-M01" && r.feasibility_verdict === "requires_data_readiness",
  );
  assert(matchingReview, "COMP-M01 must have requires_data_readiness verdict");
  assertEquals(matchingReview!.source, "deterministic");
  assertEquals(matchingReview!.recommended_status, "blocked_pending_data");
});

Deno.test("F4b: DPIA required → matching component with personal_data flag flagged for compliance review", async () => {
  const out = await runF4bFeasibilityAudit(sampleStep25, sampleStep26, {}, { llmCaller: emptyLlm });
  const compliance = out.registry_feasibility_audit_v1.component_reviews.find(
    (r) => r.component_id === "COMP-M01" && r.feasibility_verdict === "requires_compliance_review",
  );
  assert(compliance, "COMP-M01 must trigger DPIA compliance review");
});

Deno.test("F4b: 3+ components with consults_soul → Soul capture risk emitted", async () => {
  const out = await runF4bFeasibilityAudit(sampleStep25, sampleStep26, {}, { llmCaller: emptyLlm });
  const soulRisk = out.registry_feasibility_audit_v1.top_project_risks.find(
    (r) => r.risk.toLowerCase().includes("soul"),
  );
  assert(soulRisk, "Soul capture risk should be flagged");
  assert(soulRisk!.severity === "high" || soulRisk!.severity === "critical");
});

Deno.test("F4b: properly deferred component (correct phase) is NOT promoted by deterministic rules", async () => {
  const correctlyDeferred = {
    build_meta: { generated_at: "2026-04-25T11:00:00Z" },
    component_registry: {
      components: [
        {
          component_id: "COMP-X01",
          name: "Predictor LTV",
          family: "specialist",
          status: "candidate_proposed",
          priority: "P3_low",
          suggested_delivery_phase: "F2",
          business_job: "Predecir LTV con modelo ML.",
        },
      ],
    },
  };
  const out = await runF4bFeasibilityAudit(correctlyDeferred, sampleStep26, {}, { llmCaller: emptyLlm });
  const promotion = out.registry_feasibility_audit_v1.component_reviews.find(
    (r) => r.component_id === "COMP-X01" && r.feasibility_verdict === "keep",
  );
  assertEquals(promotion, undefined, "Deterministic rules must not auto-emit a 'keep' verdict for properly deferred components");
});

Deno.test("F4b: gap reviews come from LLM (Benatar accept_but_defer)", async () => {
  const llm = async () => ({
    text: JSON.stringify({
      component_reviews: [],
      gap_reviews: [
        { gap_id: "GAP-001", verdict: "accept_but_defer", reason: "Benatar es válido pero no MVP." },
        { gap_id: "GAP-002", verdict: "accept_as_new_component", reason: "Pipeline crítico para datos comerciales." },
      ],
      top_project_risks: [],
    }),
  });
  const out = await runF4bFeasibilityAudit(sampleStep25, sampleStep26, {}, { llmCaller: llm });
  const benatar = out.registry_feasibility_audit_v1.gap_reviews.find((g) => g.gap_id === "GAP-001");
  assert(benatar, "Benatar gap review must be present");
  assertEquals(benatar!.verdict, "accept_but_defer");
  assertEquals(benatar!.source, "llm");
});

Deno.test("F4b: LLM-rejected pre_verdict by key → it disappears", async () => {
  const llm = async () => ({
    text: JSON.stringify({
      component_reviews: [],
      gap_reviews: [],
      top_project_risks: [],
      rejected_pre_verdict_keys: ["COMP-M01__R1_requires_data_readiness"],
      rejection_reasons: { "COMP-M01__R1_requires_data_readiness": "Cliente confirmó dataset disponible offline." },
    }),
  });
  const out = await runF4bFeasibilityAudit(sampleStep25, sampleStep26, {}, { llmCaller: llm });
  const stillThere = out.registry_feasibility_audit_v1.component_reviews.find(
    (r) => r.component_id === "COMP-M01" && r.feasibility_verdict === "requires_data_readiness",
  );
  assertEquals(stillThere, undefined, "rejected pre_verdict must be removed from output");
  assertEquals(out.audit_meta.llm_rejected_pre_verdicts, 1);
});

Deno.test("F4b: empty LLM → next step decided deterministically (human_review_required if critical risks)", async () => {
  // Force critical: 5 components with consults_soul
  const inflatedSoul = {
    build_meta: { generated_at: "2026-04-25T11:00:00Z" },
    component_registry: {
      components: Array.from({ length: 5 }, (_, i) => ({
        component_id: `COMP-Z0${i}`,
        name: `Specialist ${i}`,
        family: "specialist",
        status: "candidate_validated",
        priority: "P1_high",
        suggested_delivery_phase: "MVP",
        business_job: "Diagnosticar.",
        soul_dependency: "consults_soul",
      })),
    },
  };
  const out = await runF4bFeasibilityAudit(inflatedSoul, sampleStep26, {}, { llmCaller: emptyLlm });
  assertEquals(out.registry_feasibility_audit_v1.recommended_next_step, "human_review_required");
});

Deno.test("F4b: invalid LLM verdict is filtered out", async () => {
  const llm = async () => ({
    text: JSON.stringify({
      component_reviews: [
        { component_id: "COMP-A01", feasibility_verdict: "magic_unicorn", reason: "x" },
      ],
      gap_reviews: [],
      top_project_risks: [],
    }),
  });
  const out = await runF4bFeasibilityAudit(sampleStep25, sampleStep26, {}, { llmCaller: llm });
  assertEquals(out.audit_meta.llm_added_reviews, 0);
});

Deno.test("F4b: LLM error → empty audit with human_review_required", async () => {
  const llm = async () => { throw new Error("upstream timeout"); };
  const out = await runF4bFeasibilityAudit(sampleStep25, sampleStep26, {}, { llmCaller: llm });
  assert(out.audit_meta.llm_error, "llm_error should be recorded");
  // Deterministic verdicts still survive
  assert(out.registry_feasibility_audit_v1.component_reviews.length > 0);
});

Deno.test("F4b: empty registry → emptyAudit with human_review_required", async () => {
  const out = await runF4bFeasibilityAudit(null, sampleStep26, {}, { llmCaller: emptyLlm });
  assertEquals(out.registry_feasibility_audit_v1.recommended_next_step, "human_review_required");
  assertEquals(out.audit_meta.llm_error, "empty_step25");
});
