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
  clampOpportunityDesign,
  emptyOpportunityDesign,
  validateOpportunityDesign,
} from "./f2-ai-opportunity-designer.ts";

Deno.test("F2: emptyOpportunityDesign devuelve shape válido sin candidatos", () => {
  const empty = emptyOpportunityDesign("test_reason");
  assertEquals(empty.version, "1.0.0");
  assertEquals(empty.opportunity_candidates.length, 0);
  assert(empty.warnings.some((w) => w.code === "F2_EMPTY"));
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
  assert(c.origin !== "INVENTADO");
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
  assert(issues.some((i) => i.code === "DUPLICATE_OPPORTUNITY_ID"));
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
