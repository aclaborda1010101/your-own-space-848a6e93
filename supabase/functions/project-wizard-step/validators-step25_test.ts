/**
 * validators-step25_test.ts — Step 25 semantic guard.
 *
 * Verifies validateRegistryNoApproval:
 *   1. Detects component.status === "approved_for_scope" and emits F3_APPROVED_FOR_SCOPE_FORBIDDEN.
 *   2. Does NOT emit a violation when "approved_for_scope" appears only in narrative
 *      text (e.g. mutation_history[].reason) but no component has that status.
 *
 * Also asserts the contract no longer contains "approved_for_scope" in forbiddenTerms,
 * which would cause false positives on legitimate downgrade narratives.
 */

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateRegistryNoApproval, runAllValidators } from "./validators.ts";
import { PHASE_CONTRACTS } from "./contracts.ts";

Deno.test("Step 25 contract: forbiddenTerms must NOT include approved_for_scope", () => {
  const contract = PHASE_CONTRACTS[25];
  assert(contract, "Step 25 contract must exist");
  assertEquals(
    contract.forbiddenTerms.includes("approved_for_scope"),
    false,
    "approved_for_scope must NOT be in forbiddenTerms (false-positive risk on narrative text)",
  );
  assert(
    contract.forbiddenKeys.includes("approved_for_scope"),
    "approved_for_scope must remain in forbiddenKeys",
  );
});

Deno.test("validateRegistryNoApproval: blocks component with status=approved_for_scope", () => {
  const outputData = {
    component_registry: {
      registry_version: "1.0.0",
      components: [
        { component_id: "COMP-A01", name: "RAG Calls", status: "candidate_validated" },
        { component_id: "COMP-B02", name: "Matching Engine", status: "approved_for_scope" },
      ],
    },
  };
  const result = validateRegistryNoApproval(outputData);
  assertEquals(result.valid, false);
  assertEquals(result.violations.length, 1);
  assertEquals(result.violations[0].severity, "error");
  assert(result.violations[0].detail.includes("F3_APPROVED_FOR_SCOPE_FORBIDDEN"));
  assert(result.violations[0].detail.includes("COMP-B02"));
});

Deno.test("validateRegistryNoApproval: allows narrative mention in mutation_history.reason", () => {
  const outputData = {
    component_registry: {
      registry_version: "1.0.0",
      components: [
        {
          component_id: "COMP-A01",
          name: "RAG Calls",
          status: "candidate_validated",
          mutation_history: [
            {
              phase: "F3_registry_builder",
              action: "downgraded",
              reason: "Initial status approved_for_scope was downgraded by enforceNoApproval — F3 cannot approve scope.",
            },
          ],
        },
      ],
    },
  };
  const result = validateRegistryNoApproval(outputData);
  assertEquals(result.valid, true);
  assertEquals(result.violations.length, 0);
});

Deno.test("runAllValidators(step=25): no false-positive forbidden_term on narrative approved_for_scope", () => {
  const outputData = {
    ai_opportunity_design_v1: { version: "1.0.0" },
    component_registry: {
      registry_version: "1.0.0",
      components: [
        {
          component_id: "COMP-A01",
          name: "RAG Calls",
          status: "candidate_validated",
          mutation_history: [
            { phase: "F3_registry_builder", action: "created", reason: "Created from OPP-001; was approved_for_scope, downgraded." },
          ],
        },
      ],
    },
    build_meta: { f2_ms: 1, f3_ms: 1, warnings: [] },
  };
  const { violations } = runAllValidators(25, outputData, JSON.stringify(outputData));
  const forbiddenTermViolations = violations.filter(
    (v) => v.type === "forbidden_term" && v.detail.toLowerCase().includes("approved_for_scope"),
  );
  assertEquals(
    forbiddenTermViolations.length,
    0,
    "No forbidden_term violation should fire for narrative approved_for_scope mentions",
  );
  const approvalViolations = violations.filter((v) => v.detail.includes("F3_APPROVED_FOR_SCOPE_FORBIDDEN"));
  assertEquals(approvalViolations.length, 0, "No semantic violation: no component has the forbidden status");
});

Deno.test("runAllValidators(step=25): semantic guard fires when component status is approved_for_scope", () => {
  const outputData = {
    ai_opportunity_design_v1: { version: "1.0.0" },
    component_registry: {
      registry_version: "1.0.0",
      components: [
        { component_id: "COMP-X99", name: "Bad Component", status: "approved_for_scope" },
      ],
    },
    build_meta: { f2_ms: 1, f3_ms: 1, warnings: [] },
  };
  const { violations } = runAllValidators(25, outputData, JSON.stringify(outputData));
  const approvalViolations = violations.filter((v) => v.detail.includes("F3_APPROVED_FOR_SCOPE_FORBIDDEN"));
  assertEquals(approvalViolations.length, 1);
  assertEquals(approvalViolations[0].severity, "error");
});
