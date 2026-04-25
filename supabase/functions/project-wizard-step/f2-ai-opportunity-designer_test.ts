/**
 * f2-ai-opportunity-designer_test.ts — Tests sin LLM para F2.
 *
 * Cubre helpers puros:
 *   - clampOpportunityDesign: fuerza version, IDs OPP-XXX, enums válidos,
 *     trunca arrays, elimina claves prohibidas (component_id, COMP-XXX).
 *   - validateOpportunityDesign: detecta IDs duplicados, IDs con prefijo
 *     COMP-, claves de F3 filtradas, etc.
 *   - emptyOpportunityDesign: shape vacío válido.
 */

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  backfillMandatoryOpportunities,
  clampOpportunityDesign,
  emptyOpportunityDesign,
  validateOpportunityDesign,
} from "./f2-ai-opportunity-designer.ts";

Deno.test("F2: emptyOpportunityDesign devuelve shape válido sin candidatos", () => {
  const empty = emptyOpportunityDesign("test_reason");
  assertEquals(empty.version, "1.0.0");
  assertEquals(empty.opportunity_candidates.length, 0);
  assertEquals(empty._meta?.generated, false);
  assertEquals(empty._meta?.error, "test_reason");
});

Deno.test("F2: clampOpportunityDesign fuerza version 1.0.0 aunque venga otra", () => {
  const out = clampOpportunityDesign({
    version: "9.9.9",
    opportunity_candidates: [],
  });
  assertEquals(out.version, "1.0.0");
});

Deno.test("F2: clampOpportunityDesign reasigna IDs si vienen como COMP-XXX", () => {
  const out = clampOpportunityDesign({
    opportunity_candidates: [
      { opportunity_id: "COMP-001", name: "Mal id" }, // ← prohibido
      { opportunity_id: "OPP-007", name: "Bien" },
      { name: "Sin id" },                              // ← falta
    ],
  });
  for (const c of out.opportunity_candidates) {
    assert(/^OPP-\d{3,}$/.test(c.opportunity_id), `ID inválido: ${c.opportunity_id}`);
    assert(!c.opportunity_id.startsWith("COMP-"), "Nunca debe empezar por COMP-");
  }
});

Deno.test("F2: clampOpportunityDesign mapea enums inválidos a fallback razonable", () => {
  const out = clampOpportunityDesign({
    opportunity_candidates: [{
      opportunity_id: "OPP-001",
      name: "x",
      origin: "INVENTADO",
      recommended_component_family: "nope",
      recommended_layer: "Z_unknown",
      priority: "URGENTE",
      build_complexity: "imposible",
      business_impact: "épico",
      soul_dependency: "wat",
      human_review: "todo",
      suggested_delivery_phase: "ya",
      suggested_phase: "phase_x",
      evidence_strength: "extreme",
    }],
  });
  const c = out.opportunity_candidates[0];
  // Todos los enums deben quedar en valores conocidos (no los inventados).
  assert((c.origin as string) !== "INVENTADO");
  assert(c.recommended_component_family !== "nope" as any);
  assert(c.recommended_layer !== "Z_unknown" as any);
  assert(c.priority !== "URGENTE" as any);
  assert(c.build_complexity !== "imposible" as any);
  assert(c.business_impact !== "épico" as any);
  assert(c.evidence_strength !== "extreme" as any);
});

Deno.test("F2: clampOpportunityDesign limita compliance_flags a valores conocidos", () => {
  const out = clampOpportunityDesign({
    opportunity_candidates: [{
      opportunity_id: "OPP-001",
      name: "x",
      compliance_flags: ["personal_data_processing", "INVENTADA", "gdpr_article_22_risk"],
    }],
  });
  const flags = out.opportunity_candidates[0].compliance_flags ?? [];
  assert(flags.includes("personal_data_processing"));
  assert(flags.includes("gdpr_article_22_risk"));
  assert(!flags.includes("INVENTADA" as any));
});

Deno.test("F2: validateOpportunityDesign detecta IDs duplicados", () => {
  const issues = validateOpportunityDesign({
    version: "1.0.0",
    sector_context: {},
    opportunity_candidates: [
      // Construimos a mano evitando clamp para forzar duplicado.
      { opportunity_id: "OPP-001", name: "a" } as any,
      { opportunity_id: "OPP-001", name: "b" } as any,
    ],
    coverage_analysis: {
      catalysts_without_opportunity: [],
      data_assets_without_opportunity: [],
      pains_without_opportunity: [],
      decision_points_without_opportunity: [],
    },
    warnings: [],
  });
  assert(issues.some((i) => i.code === "F2_DUPLICATE_OPPORTUNITY_ID"));
});

Deno.test("F2: clampOpportunityDesign trunca strings largos", () => {
  const longName = "X".repeat(5000);
  const out = clampOpportunityDesign({
    opportunity_candidates: [{
      opportunity_id: "OPP-001",
      name: longName,
      description: longName,
    }],
  });
  const c = out.opportunity_candidates[0];
  assert(c.name.length < 5000, "name debe truncarse");
  assert(c.description.length < 5000, "description debe truncarse");
});

// ── Hardening F2: name derivation + confidence normalization ─────────

import {
  deriveOpportunityName,
  normalizeConfidence,
} from "./f2-ai-opportunity-designer.ts";

Deno.test("F2 hardening: deriveOpportunityName usa raw.name si es válido", () => {
  const out = deriveOpportunityName({ name: "Pipeline de transcripción de llamadas" }, 0);
  assertEquals(out, "Pipeline de transcripción de llamadas");
});

Deno.test("F2 hardening: deriveOpportunityName rechaza name con prefijo COMP-", () => {
  const out = deriveOpportunityName(
    { name: "COMP-A01", description: "Sistema RAG sobre llamadas grabadas" },
    0,
  );
  assert(!out.startsWith("COMP-"), `Nunca debe empezar por COMP-: ${out}`);
  assert(out.length > 0);
});

Deno.test("F2 hardening: deriveOpportunityName cae a business_job si name vacío", () => {
  const out = deriveOpportunityName(
    { name: "", business_job: "Detectar fallecimientos en BOE y esquelas para alertar al equipo." },
    3,
  );
  assert(out.toLowerCase().includes("detectar"), `Debe usar business_job: ${out}`);
  assert(out.split(/\s+/).length <= 10);
  assert(out.length <= 90);
});

Deno.test("F2 hardening: deriveOpportunityName cae a description si no hay name ni business_job", () => {
  const out = deriveOpportunityName(
    { description: "Motor de matching activo-inversor que cruza catálogo y compradores potenciales." },
    1,
  );
  assert(out.toLowerCase().includes("motor"), `Debe usar description: ${out}`);
});

Deno.test("F2 hardening: deriveOpportunityName cae a fallback por family", () => {
  const out = deriveOpportunityName({ recommended_component_family: "soul_module" }, 0);
  assertEquals(out, "Soul del fundador");
});

Deno.test("F2 hardening: deriveOpportunityName último fallback es 'Oportunidad N'", () => {
  const out = deriveOpportunityName({}, 4);
  assertEquals(out, "Oportunidad 5");
});

Deno.test("F2 hardening: clampOpportunityDesign nunca deja name vacío", () => {
  const out = clampOpportunityDesign({
    opportunity_candidates: [
      { opportunity_id: "OPP-001", name: "", description: "RAG sobre llamadas grabadas." },
      { opportunity_id: "OPP-002", description: "Motor de scoring de propietarios." },
      { opportunity_id: "OPP-003", recommended_component_family: "soul_module" },
    ],
  });
  for (const c of out.opportunity_candidates) {
    assert(c.name.length > 0, `name vacío en ${c.opportunity_id}`);
    assert(!c.name.startsWith("COMP-"), `name no debe ser COMP-: ${c.name}`);
  }
});

Deno.test("F2 hardening: clampOpportunityDesign emite warning F2_NAME_DERIVED cuando deriva", () => {
  const out = clampOpportunityDesign({
    opportunity_candidates: [
      { opportunity_id: "OPP-001", name: "Buen nombre" },
      { opportunity_id: "OPP-002", description: "Sin name." },
    ],
  });
  const derivedWarnings = out.warnings.filter((w) => w.code === "F2_NAME_DERIVED");
  assertEquals(derivedWarnings.length, 1);
  assertEquals((derivedWarnings[0] as any).opportunity_id, "OPP-002");
});

Deno.test("F2 hardening: normalizeConfidence acepta number 0..1", () => {
  assertEquals(normalizeConfidence(0.7), 0.7);
  assertEquals(normalizeConfidence(0), 0);
  assertEquals(normalizeConfidence(1), 1);
});

Deno.test("F2 hardening: normalizeConfidence parsea string numérico", () => {
  assertEquals(normalizeConfidence("0.5"), 0.5);
  assertEquals(normalizeConfidence("0.85"), 0.85);
});

Deno.test("F2 hardening: normalizeConfidence ancla por evidence_strength cuando falta", () => {
  assertEquals(normalizeConfidence(undefined, "high"), 0.85);
  assertEquals(normalizeConfidence(undefined, "medium"), 0.65);
  assertEquals(normalizeConfidence(undefined, "low"), 0.4);
  assertEquals(normalizeConfidence(null), 0.6);
});

Deno.test("F2 hardening: normalizeConfidence clampa fuera de rango", () => {
  assertEquals(normalizeConfidence(1.5), 1);
  assertEquals(normalizeConfidence(-0.3), 0);
});

Deno.test("F2 hardening: clampOpportunityDesign emite confidence como number siempre", () => {
  const out = clampOpportunityDesign({
    opportunity_candidates: [
      { opportunity_id: "OPP-001", name: "A", confidence: "0.5", evidence_strength: "medium" },
      { opportunity_id: "OPP-002", name: "B", confidence: "abc", evidence_strength: "high" },
      { opportunity_id: "OPP-003", name: "C", evidence_strength: "low" },
    ],
  });
  for (const c of out.opportunity_candidates) {
    assertEquals(typeof c.confidence, "number", `${c.opportunity_id} confidence no es number`);
    assert(c.confidence >= 0 && c.confidence <= 1);
  }
  assertEquals(out.opportunity_candidates[0].confidence, 0.5);
  assertEquals(out.opportunity_candidates[1].confidence, 0.85); // string inválido → ancla high
  assertEquals(out.opportunity_candidates[2].confidence, 0.4);  // anclado low
});
