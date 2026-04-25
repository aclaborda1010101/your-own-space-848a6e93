/**
 * f4a-registry-gap-audit_test.ts — Orchestrator tests with mocked LLM.
 */

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runF4aGapAudit } from "./f4a-registry-gap-audit.ts";

const sampleBrief = {
  brief_version: "v3.2",
  business_extraction_v2: { economic_pains: [{ id: "P1", title: "Llamadas grabadas sin transcribir" }] },
  _f0_signals: { raw: "Benatar BORME esquelas propietarios inversores" },
  project_summary: "Llamadas grabadas con Plaud. Benatar. BORME, CNAE, esquelas. Propietarios e inversores. Alejandro founder.",
};

const sampleStep25 = {
  build_meta: { generated_at: "2026-04-25T10:00:00Z" },
  component_registry: {
    components: [
      { component_id: "COMP-A01", name: "RAG general", family: "rag", soul_dependency: "consults_soul" },
      { component_id: "COMP-A02", name: "Agente comercial", family: "agent", soul_dependency: "consults_soul" },
      { component_id: "COMP-A03", name: "Especialista valoración", family: "specialist", soul_dependency: "consults_soul" },
    ],
  },
};

Deno.test("F4a: mock LLM returns []  → deterministic pre-detected gaps still surface", async () => {
  const out = await runF4aGapAudit(sampleBrief, sampleStep25, {}, {
    llmCaller: async () => ({ text: JSON.stringify({ gaps: [] }) }),
  });
  assert(out.registry_gap_audit_v1.gaps.length > 0, "deterministic gaps must survive empty LLM output");
  assert(out.audit_meta.deterministic_pre_detections > 0);
  assertEquals(out.audit_meta.llm_added_gaps, 0);
  assertEquals(out.audit_meta.llm_rejected_pre_detections, 0);
});

Deno.test("F4a: LLM adds a new gap → it appears with sequential id and source=llm", async () => {
  const out = await runF4aGapAudit(sampleBrief, sampleStep25, {}, {
    llmCaller: async () => ({
      text: JSON.stringify({
        gaps: [{
          title: "Falta logging de decisiones",
          gap_type: "missing_compliance_control",
          severity: "medium",
          evidence: ["DPIA requiere trazabilidad"],
          affected_registry_components: [],
          suggested_action: "add_component",
          suggested_component_candidate: {
            name: "Decision logger",
            family: "audit_log",
            layer: "B_action",
            priority: "P1_high",
            suggested_delivery_phase: "MVP",
            business_job: "Loggear decisiones del sistema.",
            business_justification: "Compliance.",
          },
          reason: "DPIA exige trazabilidad.",
        }],
      }),
    }),
  });
  const llmGap = out.registry_gap_audit_v1.gaps.find((g) => g.source === "llm");
  assert(llmGap, "should include LLM-added gap");
  assert(/^GAP-\d{3}$/.test(llmGap!.gap_id), "should have sequential GAP-NNN id");
  assertEquals(llmGap!.suggested_component_candidate?.name, "Decision logger");
});

Deno.test("F4a: LLM rejects a pre-detected gap by dedupe_key → it disappears", async () => {
  // First, find a known dedupe_key that will be present.
  const fullOut = await runF4aGapAudit(sampleBrief, sampleStep25, {}, {
    llmCaller: async () => ({ text: JSON.stringify({ gaps: [] }) }),
  });
  const someKey = "missing_call_data_pipeline";
  // Verify it exists baseline.
  assert(
    fullOut.registry_gap_audit_v1.gaps.some(
      (g) => g.title.toLowerCase().includes("transcripción"),
    ),
    "baseline: call pipeline gap should exist",
  );

  const rejectedOut = await runF4aGapAudit(sampleBrief, sampleStep25, {}, {
    llmCaller: async () => ({
      text: JSON.stringify({
        gaps: [],
        rejected_pre_detected_dedupe_keys: [someKey],
        rejection_reasons: { [someKey]: "Ya cubierto por otro componente fuera del registry compactado." },
      }),
    }),
  });
  const stillThere = rejectedOut.registry_gap_audit_v1.gaps.some(
    (g) => g.title.toLowerCase().includes("transcripción"),
  );
  assertEquals(stillThere, false, "rejected pre-detected gap should disappear");
  assertEquals(rejectedOut.audit_meta.llm_rejected_pre_detections, 1);
});

Deno.test("F4a: LLM returns invalid JSON → deterministic gaps still survive, no crash", async () => {
  const out = await runF4aGapAudit(sampleBrief, sampleStep25, {}, {
    llmCaller: async () => ({ text: "not json at all" }),
  });
  assert(out.registry_gap_audit_v1.gaps.length > 0, "should still emit deterministic gaps");
  assertEquals(out.audit_meta.llm_added_gaps, 0);
});

Deno.test("F4a: LLM throws → llm_error captured, deterministic gaps preserved", async () => {
  const out = await runF4aGapAudit(sampleBrief, sampleStep25, {}, {
    llmCaller: async () => { throw new Error("network down"); },
  });
  assert(out.audit_meta.llm_error?.includes("network down"));
  assert(out.registry_gap_audit_v1.gaps.length > 0);
});

Deno.test("F4a: LLM gap without evidence → discarded", async () => {
  const out = await runF4aGapAudit(sampleBrief, sampleStep25, {}, {
    llmCaller: async () => ({
      text: JSON.stringify({
        gaps: [{
          title: "Gap inventado",
          gap_type: "missing_component",
          severity: "low",
          evidence: [], // ← invalid
          affected_registry_components: [],
          suggested_action: "no_action",
          reason: "—",
        }],
      }),
    }),
  });
  assertEquals(out.audit_meta.llm_added_gaps, 0);
});

Deno.test("F4a: empty briefing → empty audit, no crash", async () => {
  const out = await runF4aGapAudit(null as any, sampleStep25, {}, {
    llmCaller: async () => ({ text: "{}" }),
  });
  assertEquals(out.registry_gap_audit_v1.gaps.length, 0);
  assertEquals(out.audit_meta.llm_error, "empty_briefing");
});

Deno.test("F4a: registry_version + brief_version persisted in audit", async () => {
  const out = await runF4aGapAudit(sampleBrief, sampleStep25, {}, {
    llmCaller: async () => ({ text: "{}" }),
  });
  assertEquals(out.registry_gap_audit_v1.brief_version_reviewed, "v3.2");
  assertEquals(out.registry_gap_audit_v1.registry_version_reviewed, "2026-04-25T10:00:00Z");
});
