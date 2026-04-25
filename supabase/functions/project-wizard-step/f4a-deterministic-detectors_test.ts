/**
 * f4a-deterministic-detectors_test.ts
 * Pure unit tests for F4a detectors. No LLM, no network.
 */

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  detectMissingDataPipelineFromCallSignals,
  detectInstitutionalBuyerDetectorGap,
  detectExternalSourceGaps,
  detectMissingForms,
  detectMoERoutingGap,
  detectSoulCoverageGap,
  detectOverloadedComponentSplit,
  runAllDetectors,
} from "./f4a-deterministic-detectors.ts";

// ── D1 ────────────────────────────────────────────────────────────────────────

Deno.test("D1: brief with calls and no data_pipeline → 1 gap", () => {
  const brief = { project_summary: "Procesamos llamadas grabadas con Plaud para extraer señales." };
  const registry = { components: [{ component_id: "C1", name: "RAG", family: "rag" }] };
  const gaps = detectMissingDataPipelineFromCallSignals(brief, registry);
  assertEquals(gaps.length, 1);
  assertEquals(gaps[0].gap_type, "missing_component");
  assertEquals(gaps[0].severity, "high");
  assert(gaps[0].evidence.length > 0);
});

Deno.test("D1: brief with calls AND a transcription_pipeline → 0 gaps", () => {
  const brief = { project_summary: "Llamadas grabadas con Plaud." };
  const registry = { components: [{ component_id: "C1", name: "Transcripción", family: "transcription_pipeline" }] };
  assertEquals(detectMissingDataPipelineFromCallSignals(brief, registry).length, 0);
});

Deno.test("D1: brief without call signals → 0 gaps", () => {
  const brief = { project_summary: "Solo análisis de texto" };
  assertEquals(detectMissingDataPipelineFromCallSignals(brief, { components: [] }).length, 0);
});

// ── D2 ────────────────────────────────────────────────────────────────────────

Deno.test("D2: brief mentions Benatar and registry only has fallecimientos detector → 1 gap", () => {
  const brief = { project_summary: "Estrategia tipo Benatar para compradores institucionales." };
  const registry = {
    components: [
      { component_id: "C1", name: "Detector de fallecimientos", family: "deceased_owner_detector", business_job: "Detectar fallecimientos" },
    ],
  };
  const gaps = detectInstitutionalBuyerDetectorGap(brief, registry);
  assertEquals(gaps.length, 1);
  assertEquals(gaps[0].severity, "high");
  assert(gaps[0].affected_registry_components.includes("C1"), "should call out the deceased detector as affected");
  assert(gaps[0].evidence.some((e) => e.toLowerCase().includes("benatar")), "should cite benatar evidence");
});

Deno.test("D2: brief mentions Benatar and registry has institutional_buyer_detector → 0 gaps", () => {
  const brief = { project_summary: "Benatar inspiration." };
  const registry = { components: [{ component_id: "C2", name: "Detector compradores", family: "institutional_buyer_detector" }] };
  assertEquals(detectInstitutionalBuyerDetectorGap(brief, registry).length, 0);
});

// ── D3 ────────────────────────────────────────────────────────────────────────

Deno.test("D3: brief with BORME, CNAE, esquelas → 3 missing_data_source gaps", () => {
  const brief = { project_summary: "Usamos BORME, CNAE y esquelas como fuentes externas." };
  const registry = { components: [{ component_id: "C1", name: "RAG", family: "rag", external_sources: [] }] };
  const gaps = detectExternalSourceGaps(brief, registry);
  assertEquals(gaps.length, 3);
  assert(gaps.every((g) => g.gap_type === "missing_data_source"));
});

Deno.test("D3: source declared in component.external_sources → no gap for it", () => {
  const brief = { project_summary: "Usamos BORME y CNAE." };
  const registry = {
    components: [
      { component_id: "C1", name: "Pipeline", family: "data_pipeline", external_sources: ["BORME"] },
    ],
  };
  const gaps = detectExternalSourceGaps(brief, registry);
  // BORME declared → only CNAE gap remains.
  assertEquals(gaps.length, 1);
  assert(gaps[0].title.includes("CNAE"));
});

// ── D4 ────────────────────────────────────────────────────────────────────────

Deno.test("D4: brief mentions propietarios + inversores + activos → 3 form gaps", () => {
  const brief = { project_summary: "Gestionamos propietarios, inversores y activos." };
  const registry = { components: [] };
  const gaps = detectMissingForms(brief, registry);
  assert(gaps.length >= 3);
  assert(gaps.every((g) => g.gap_type === "missing_form"));
});

Deno.test("D4: form already exists in registry → no duplicate gap", () => {
  const brief = { project_summary: "Propietarios" };
  const registry = {
    components: [{ component_id: "F1", name: "Ficha de propietario", family: "form", business_job: "Registrar propietarios" }],
  };
  assertEquals(detectMissingForms(brief, registry).length, 0);
});

// ── D5 ────────────────────────────────────────────────────────────────────────

Deno.test("D5: 4 specialists without router → 1 moe gap", () => {
  const registry = {
    components: [
      { component_id: "A1", family: "agent" },
      { component_id: "A2", family: "rag" },
      { component_id: "A3", family: "specialist" },
      { component_id: "A4", family: "classifier" },
    ],
  };
  const gaps = detectMoERoutingGap(registry);
  assertEquals(gaps.length, 1);
  assertEquals(gaps[0].gap_type, "missing_moe_route");
});

Deno.test("D5: with router present → 0 gaps", () => {
  const registry = {
    components: [
      { component_id: "A1", family: "agent" },
      { component_id: "A2", family: "rag" },
      { component_id: "A3", family: "specialist" },
      { component_id: "R", family: "moe_router" },
    ],
  };
  assertEquals(detectMoERoutingGap(registry).length, 0);
});

// ── D6 ────────────────────────────────────────────────────────────────────────

Deno.test("D6: 3 components with consults_soul, no D_soul → 1 critical gap", () => {
  const registry = {
    components: [
      { component_id: "C1", soul_dependency: "consults_soul" },
      { component_id: "C2", soul_dependency: "requires_soul_approval" },
      { component_id: "C3", soul_dependency: "consults_soul" },
    ],
  };
  const gaps = detectSoulCoverageGap({}, registry);
  assertEquals(gaps.length, 1);
  assertEquals(gaps[0].severity, "critical");
});

Deno.test("D6: D_soul present → 0 gaps", () => {
  const registry = {
    components: [
      { component_id: "S", family: "soul_module", layer: "D_soul" },
      { component_id: "C1", soul_dependency: "consults_soul" },
      { component_id: "C2", soul_dependency: "consults_soul" },
      { component_id: "C3", soul_dependency: "consults_soul" },
    ],
  };
  assertEquals(detectSoulCoverageGap({}, registry).length, 0);
});

// ── D7 ────────────────────────────────────────────────────────────────────────

Deno.test("D7: business_job with 5 verbs → split gap", () => {
  const registry = {
    components: [{
      component_id: "X1",
      name: "Mega componente",
      business_job: "Captura, transcribe, analiza, clasifica y notifica todo a la vez",
    }],
  };
  const gaps = detectOverloadedComponentSplit(registry);
  assertEquals(gaps.length, 1);
  assertEquals(gaps[0].gap_type, "component_should_be_split");
});

Deno.test("D7: focused component → 0 gaps", () => {
  const registry = {
    components: [{ component_id: "X1", name: "Transcriptor", business_job: "Transcribe llamadas." }],
  };
  assertEquals(detectOverloadedComponentSplit(registry).length, 0);
});

// ── Aggregator ────────────────────────────────────────────────────────────────

Deno.test("runAllDetectors: idempotent — same input twice → same gaps (dedupe by key)", () => {
  const brief = { project_summary: "Llamadas grabadas, Benatar, BORME, propietarios." };
  const registry = { components: [] };
  const a = runAllDetectors(brief, registry);
  const b = runAllDetectors(brief, registry);
  assertEquals(a.length, b.length);
  const aKeys = new Set(a.map((g) => g.dedupe_key));
  const bKeys = new Set(b.map((g) => g.dedupe_key));
  assertEquals([...aKeys].sort(), [...bKeys].sort());
});

Deno.test("runAllDetectors: AFFLUX-like brief → covers all critical gaps", () => {
  const brief = {
    project_summary: "Procesamos llamadas grabadas con Plaud. Inspiración Benatar para compradores institucionales. BORME, CNAE, esquelas. Propietarios e inversores. Criterio de Alejandro como founder.",
  };
  const registry = {
    components: [
      { component_id: "C1", family: "rag", soul_dependency: "consults_soul" },
      { component_id: "C2", family: "agent", soul_dependency: "consults_soul" },
      { component_id: "C3", family: "specialist", soul_dependency: "consults_soul" },
    ],
  };
  const gaps = runAllDetectors(brief, registry);
  const types = new Set(gaps.map((g) => g.dedupe_key));
  assert(types.has("missing_call_data_pipeline"), "should detect call pipeline gap");
  assert(types.has("missing_institutional_buyer_detector"), "should detect Benatar gap");
  assert(types.has("missing_soul_module"), "should detect Soul gap");
  assert(types.has("missing_moe_router"), "should detect MoE gap");
  assert([...types].some((k) => k.startsWith("missing_external_source__")), "should detect at least one external source gap");
  assert([...types].some((k) => k.startsWith("missing_form__")), "should detect at least one form gap");
});
