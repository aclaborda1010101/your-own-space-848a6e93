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

/* ============================================================
 * Backfill determinista — Soul + Matching activo-inversor
 * ============================================================ */

function baseDesign(candidates: any[]): any {
  return clampOpportunityDesign({ opportunity_candidates: candidates });
}

Deno.test("F2 backfill: inyecta Soul cuando ≥2 oportunidades dependen del Soul", () => {
  const design = baseDesign([
    { opportunity_id: "OPP-001", name: "Asistente", soul_dependency: "consults_soul" },
    { opportunity_id: "OPP-002", name: "Revista", soul_dependency: "requires_soul_approval" },
  ]);
  const out = backfillMandatoryOpportunities(design, { briefing: {}, f0Signals: {} });
  const soul = out.opportunity_candidates.find(
    (c) => c.recommended_component_family === "soul_module" || c.recommended_layer === "D_soul",
  );
  assert(soul, "Debería haber inyectado un Soul module");
  assertEquals(soul!.recommended_component_family, "soul_module");
  assertEquals(soul!.recommended_layer, "D_soul");
  assert(/^OPP-\d{3,}$/.test(soul!.opportunity_id));
  assert(out.warnings?.some((w: any) => w.code === "F2_SOUL_BACKFILLED"));
});

Deno.test("F2 backfill: NO duplica Soul si ya existe soul_module", () => {
  const design = baseDesign([
    { opportunity_id: "OPP-001", name: "Asistente", soul_dependency: "consults_soul" },
    { opportunity_id: "OPP-002", name: "Revista", soul_dependency: "requires_soul_approval" },
    { opportunity_id: "OPP-003", name: "Soul existente", recommended_component_family: "soul_module", recommended_layer: "D_soul" },
  ]);
  const out = backfillMandatoryOpportunities(design, { briefing: {} });
  const souls = out.opportunity_candidates.filter(
    (c) => c.recommended_component_family === "soul_module",
  );
  assertEquals(souls.length, 1);
  assert(!out.warnings?.some((w: any) => w.code === "F2_SOUL_BACKFILLED"));
});

Deno.test("F2 backfill: inyecta Soul si founder_commitment_signals está poblado", () => {
  const design = baseDesign([
    { opportunity_id: "OPP-001", name: "Algo", soul_dependency: "none" },
  ]);
  const out = backfillMandatoryOpportunities(design, {
    briefing: {
      business_extraction_v2: {
        founder_commitment_signals: [{ quote: "Alejandro firma cada decisión" }],
      },
    },
  });
  assert(out.opportunity_candidates.some((c) => c.recommended_component_family === "soul_module"));
});

Deno.test("F2 backfill: usa 'Soul de Alejandro' si aparece Alejandro en el brief", () => {
  const design = baseDesign([
    { opportunity_id: "OPP-001", name: "A", soul_dependency: "consults_soul" },
    { opportunity_id: "OPP-002", name: "B", soul_dependency: "consults_soul" },
  ]);
  const out = backfillMandatoryOpportunities(design, {
    briefing: { project_summary: { founder: "Alejandro Gordo" } },
  });
  const soul = out.opportunity_candidates.find((c) => c.recommended_component_family === "soul_module");
  assertEquals(soul!.name, "Soul de Alejandro");
});

Deno.test("F2 backfill: usa 'Soul del fundador' si no aparece Alejandro", () => {
  const design = baseDesign([
    { opportunity_id: "OPP-001", name: "A", soul_dependency: "consults_soul" },
    { opportunity_id: "OPP-002", name: "B", soul_dependency: "consults_soul" },
  ]);
  const out = backfillMandatoryOpportunities(design, { briefing: {} });
  const soul = out.opportunity_candidates.find((c) => c.recommended_component_family === "soul_module");
  assertEquals(soul!.name, "Soul del fundador");
});

Deno.test("F2 backfill: inyecta Matching activo-inversor con activos + compradores", () => {
  const design = baseDesign([
    { opportunity_id: "OPP-001", name: "Otra cosa" },
  ]);
  const out = backfillMandatoryOpportunities(design, {
    briefing: {
      business_extraction_v2: {
        underutilized_data_assets: [{ description: "Catálogo de edificios y activos sin div horizontal" }],
        decision_points: [{ description: "Necesitamos saber a quién vender antes de comprar" }],
      },
    },
  });
  const m = out.opportunity_candidates.find((c) => c.recommended_component_family === "matching_engine");
  assert(m, "Debería haber inyectado matching_engine");
  assertEquals(m!.dataset_readiness_required, true);
  assertEquals(m!.human_review, "mandatory");
  assert((m!.compliance_flags || []).includes("personal_data_processing" as any));
  assert((m!.compliance_flags || []).includes("commercial_prioritization" as any));
  assert((m!.compliance_flags || []).includes("human_in_the_loop_required" as any));
  assert(/^OPP-\d{3,}$/.test(m!.opportunity_id));
  assert(out.warnings?.some((w: any) => w.code === "F2_MATCHING_BACKFILLED"));
});

Deno.test("F2 backfill: NO duplica matching si ya existe matching_engine", () => {
  const design = baseDesign([
    { opportunity_id: "OPP-001", name: "Matching ya hecho", recommended_component_family: "matching_engine", recommended_layer: "C_intelligence" },
  ]);
  const out = backfillMandatoryOpportunities(design, {
    briefing: { project_summary: "edificios fondos servicers compradores inversores benatar" },
  });
  const matches = out.opportunity_candidates.filter(
    (c) => c.recommended_component_family === "matching_engine",
  );
  assertEquals(matches.length, 1);
  assert(!out.warnings?.some((w: any) => w.code === "F2_MATCHING_BACKFILLED"));
});

Deno.test("F2 backfill: NO inyecta matching si solo hay activos pero NO compradores", () => {
  const design = baseDesign([{ opportunity_id: "OPP-001", name: "X" }]);
  const out = backfillMandatoryOpportunities(design, {
    briefing: { project_summary: "tenemos un catálogo de edificios" },
  });
  assert(!out.opportunity_candidates.some((c) => c.recommended_component_family === "matching_engine"));
});

Deno.test("F2 backfill: NO inyecta Soul si no hay señales y todas las soul_dependency son none", () => {
  const design = baseDesign([
    { opportunity_id: "OPP-001", name: "A", soul_dependency: "none" },
    { opportunity_id: "OPP-002", name: "B", soul_dependency: "none" },
  ]);
  const out = backfillMandatoryOpportunities(design, { briefing: { project_summary: "proyecto neutro de logística" }, f0Signals: {} });
  assert(!out.opportunity_candidates.some((c) => c.recommended_component_family === "soul_module"));
  assert(!out.warnings?.some((w: any) => w.code === "F2_SOUL_BACKFILLED"));
});

Deno.test("F2 backfill: IDs OPP-NNN secuenciales sin colisión", () => {
  const design = baseDesign([
    { opportunity_id: "OPP-005", name: "A", soul_dependency: "consults_soul" },
    { opportunity_id: "OPP-006", name: "B", soul_dependency: "consults_soul" },
  ]);
  const out = backfillMandatoryOpportunities(design, {
    briefing: {
      business_extraction_v2: {
        underutilized_data_assets: [{ description: "edificios" }],
        decision_points: [{ description: "compradores inversores" }],
      },
    },
  });
  const ids = out.opportunity_candidates.map((c) => c.opportunity_id);
  assertEquals(new Set(ids).size, ids.length, "no debe haber IDs duplicados");
  assert(ids.includes("OPP-007"));
  assert(ids.includes("OPP-008"));
});
