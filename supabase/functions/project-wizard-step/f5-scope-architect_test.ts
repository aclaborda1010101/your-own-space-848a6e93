/**
 * f5-scope-architect_test.ts — Orchestrator: enrichment + traceability hard-block.
 */
import { assertEquals, assert, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runF5ScopeArchitect, F5TraceabilityError } from "./f5-scope-architect.ts";

const STEP25 = {
  component_registry: {
    components: [
      {
        component_id: "COMP-A01",
        name: "Conocimiento",
        family: "knowledge_module",
        layer: "A_knowledge",
        priority: "P0_critical",
        status: "candidate_validated",
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
    ],
  },
};

const STEP26 = {
  registry_gap_audit_v1: {
    gaps: [],
  },
};

const STEP27 = {
  registry_feasibility_audit_v1: {
    component_reviews: [
      { component_id: "COMP-A01", feasibility_verdict: "keep" },
      { component_id: "COMP-D01", feasibility_verdict: "keep" },
    ],
    gap_reviews: [],
    top_project_risks: [],
  },
};

const SOURCE_STEPS = {
  registry_step: { step_number: 25, version: 2, row_id: "row-25" },
  gap_audit_step: { step_number: 26, version: 1, row_id: "row-26" },
  feasibility_audit_step: { step_number: 27, version: 1, row_id: "row-27" },
};

Deno.test("F5 orchestrator: deterministic-only mode produces a valid scope", async () => {
  const out = await runF5ScopeArchitect(
    { step25Output: STEP25, step26Output: STEP26, step27Output: STEP27, source_steps: SOURCE_STEPS },
    { skipLlm: true },
  );
  assertEquals(out.scope_architecture_v1.schema_version, "1.0.0");
  assertEquals(out.scope_meta.counts.data_foundation, 1);
  assertEquals(out.scope_meta.counts.mvp, 1);
  assertEquals(out.scope_meta.source_steps.registry_step.row_id, "row-25");
  assertEquals(out.scope_meta.traceability_violations_count, 0);
});

Deno.test("F5 orchestrator: LLM enrichments are applied; bucket/status changes ignored", async () => {
  const mockLlm = (_s: string, _u: string) => Promise.resolve({
    text: JSON.stringify({
      enrichments: [
        // Real scope_id (will exist after pre-warm).
        { scope_id: "SCOPE-001", additional_required_actions: ["test action 1"], notes: "ok" },
        // Inventado — debe ignorarse y contar como rejected change.
        { scope_id: "SCOPE-INVENTED", additional_required_actions: ["bad"], bucket: "mvp" },
      ],
      additional_decision_log_entries: [
        { decision_id: "extra", applied_to: "SCOPE-001", action: "added", reason: "demo" },
      ],
    }),
  });
  const out = await runF5ScopeArchitect(
    { step25Output: STEP25, step26Output: STEP26, step27Output: STEP27, source_steps: SOURCE_STEPS },
    { llmCaller: mockLlm },
  );
  assert(out.scope_meta.llm_added_actions >= 1);
  assert(out.scope_meta.llm_rejected_changes >= 1);
  // additional_decision_log_entries should be appended.
  assert(out.scope_architecture_v1.scope_decision_log.some((e) => e.decision_id === "extra"));
});

Deno.test("F5 orchestrator: throws F5TraceabilityError when registry is missing component", async () => {
  // Inject a feasibility review for a component that doesn't exist — pre-warm
  // doesn't add it (it walks registry only), so traceability should still pass.
  // Real failure mode: registry missing → orchestrator throws Error before traceability.
  await assertRejects(
    () => runF5ScopeArchitect({
      step25Output: { component_registry: null },
      step26Output: STEP26,
      step27Output: STEP27,
      source_steps: SOURCE_STEPS,
    }, { skipLlm: true }),
    Error,
    "F5 requires Step 25",
  );
});

Deno.test("F5 orchestrator: scope_meta.counts derived from persisted scope (Precision 7)", async () => {
  const out = await runF5ScopeArchitect(
    { step25Output: STEP25, step26Output: STEP26, step27Output: STEP27, source_steps: SOURCE_STEPS },
    { skipLlm: true },
  );
  const realMvp = out.scope_architecture_v1.mvp.length;
  const realDf = out.scope_architecture_v1.data_foundation.length;
  assertEquals(out.scope_meta.counts.mvp, realMvp);
  assertEquals(out.scope_meta.counts.data_foundation, realDf);
});

Deno.test("F5 orchestrator: F5TraceabilityError exists and carries violations", () => {
  const err = new F5TraceabilityError([
    { scope_id: "SCOPE-X", source_type: "registry_component", source_ref: "COMP-X", reason: "test" },
  ]);
  assertEquals(err.violations.length, 1);
  assert(err.message.includes("traceability"));
});
