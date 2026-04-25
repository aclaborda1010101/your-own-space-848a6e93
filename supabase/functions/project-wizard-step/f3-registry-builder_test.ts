/**
 * f3-registry-builder_test.ts — Tests deterministas (sin LLM) para F3.
 *
 * Cubre:
 *   1. Conversión opportunity → registry item.
 *   2. Deduplicación (Jaccard sobre nombre + misma family).
 *   3. Dataset readiness fuerza requires_human_review.
 *   4. DPIA trigger se propaga a item.dpia_required y registry.dpia.required.
 *   5. enforceNoApproval: approved_for_scope se baja a candidate_validated.
 *   6. Naming collision se reporta como warning (no bloquea).
 */

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  applyDatasetRules,
  applyDpiaRules,
  applyHumanReviewRules,
  buildRegistryFromDesign,
  dedupeOpportunities,
  enforceNoApproval,
} from "./f3-registry-builder.ts";
import type {
  AiOpportunityDesignV1,
  OpportunityCandidate,
} from "./f2-ai-opportunity-designer.ts";
import type {
  ComponentRegistryItem,
} from "../_shared/component-registry-contract.ts";

// ── Helpers de fixtures ─────────────────────────────────────────────

function makeOpp(
  partial: Partial<OpportunityCandidate> & { opportunity_id: string; name: string },
): OpportunityCandidate {
  return {
    opportunity_id: partial.opportunity_id,
    name: partial.name,
    description: partial.description ?? `Descripción de ${partial.name}`,
    origin: partial.origin ?? "inferred_need",
    evidence_strength: partial.evidence_strength ?? "medium",
    source_quotes: partial.source_quotes ?? [],
    recommended_component_family: partial.recommended_component_family ?? "agent",
    recommended_layer: partial.recommended_layer ?? "B_action",
    business_job: partial.business_job ?? "Resolver una tarea de negocio.",
    business_justification: partial.business_justification ?? "Reduce trabajo manual repetitivo.",
    business_catalysts_covered: partial.business_catalysts_covered ?? [],
    data_assets_activated: partial.data_assets_activated ?? [],
    economic_pains_addressed: partial.economic_pains_addressed ?? [],
    required_data: partial.required_data ?? [],
    suggested_rags: partial.suggested_rags ?? [],
    suggested_agents: partial.suggested_agents ?? [],
    suggested_forms: partial.suggested_forms ?? [],
    suggested_external_sources: partial.suggested_external_sources ?? [],
    suggested_moe_route: partial.suggested_moe_route,
    soul_dependency: partial.soul_dependency ?? "none",
    human_review: partial.human_review ?? "optional",
    compliance_flags: partial.compliance_flags ?? [],
    dataset_readiness_required: partial.dataset_readiness_required,
    dataset_readiness_reason: partial.dataset_readiness_reason,
    minimum_dataset_needed: partial.minimum_dataset_needed,
    suggested_phase: partial.suggested_phase ?? "F3_registry_builder",
    suggested_delivery_phase: partial.suggested_delivery_phase ?? "MVP",
    priority: partial.priority ?? "P2_medium",
    build_complexity: partial.build_complexity ?? "medium",
    business_impact: partial.business_impact ?? "medium",
    confidence: partial.confidence ?? 0.7,
  };
}

function makeDesign(opps: OpportunityCandidate[]): AiOpportunityDesignV1 {
  return {
    version: "1.0.0",
    sector_context: { primary_sector: "test" },
    opportunity_candidates: opps,
    coverage_analysis: {
      catalysts_without_opportunity: [],
      data_assets_without_opportunity: [],
      pains_without_opportunity: [],
      decision_points_without_opportunity: [],
    },
    warnings: [],
  };
}

// ── 1. Conversión opportunity → registry item ───────────────────────

Deno.test("F3: convierte una oportunidad simple en un ComponentRegistryItem válido", () => {
  const design = makeDesign([
    makeOpp({
      opportunity_id: "OPP-001",
      name: "Catalogador de roles de propietario",
      recommended_component_family: "agent",
      recommended_layer: "B_action",
      evidence_strength: "high",
      source_quotes: [{ quote: "Tenemos 7 roles distintos de propietario." }],
    }),
  ]);

  const res = buildRegistryFromDesign(design, {
    clientCompanyName: "AFFLUX",
    productName: "AFFLUX Platform",
    projectId: "test-project",
  });

  assertEquals(res.registry.components.length, 1);
  const c = res.registry.components[0];
  assert(c.component_id.startsWith("COMP-B"), "ID debe ir en capa B (COMP-Bxx)");
  assertEquals(c.family, "agent");
  assertEquals(c.layer, "B_action");
  assert(c.status !== "approved_for_scope", "F3 nunca aprueba scope");
  assert(c.mutation_history.length >= 1, "Debe registrar mutación de creación");
  assertEquals(c.mutation_history[0].phase, "F3_registry_builder");
  assertEquals(c.mutation_history[0].action, "created");
});

// ── 2. Deduplicación ────────────────────────────────────────────────

Deno.test("F3: deduplica oportunidades similares en un solo componente", () => {
  const opps = [
    makeOpp({
      opportunity_id: "OPP-001",
      name: "RAG de llamadas",
      recommended_component_family: "rag",
      recommended_layer: "A_knowledge",
    }),
    makeOpp({
      opportunity_id: "OPP-002",
      name: "RAG conversaciones propietarios",
      recommended_component_family: "rag",
      recommended_layer: "A_knowledge",
    }),
    makeOpp({
      opportunity_id: "OPP-003",
      name: "KB llamadas",
      recommended_component_family: "rag",
      recommended_layer: "A_knowledge",
    }),
  ];

  const { clusters, mergedLog } = dedupeOpportunities(opps);
  // Al menos uno de los pares debe haberse fusionado.
  assert(clusters.length < opps.length, "Debe haber fusionado al menos un par");
  assert(mergedLog.length >= 1, "Debe haber log de fusión");
});

Deno.test("F3: NO fusiona oportunidades de family distinta", () => {
  const opps = [
    makeOpp({
      opportunity_id: "OPP-001",
      name: "Catalogador de roles",
      recommended_component_family: "agent",
      recommended_layer: "B_action",
    }),
    makeOpp({
      opportunity_id: "OPP-002",
      name: "Catalogador de roles",
      recommended_component_family: "form",
      recommended_layer: "E_interface",
    }),
  ];

  const { clusters } = dedupeOpportunities(opps);
  assertEquals(clusters.length, 2, "Distinta family → no fusionar aunque mismo nombre");
});

// ── 3. Dataset readiness ────────────────────────────────────────────

Deno.test("F3: matching_engine sin dataset_requirements completos → requires_human_review", () => {
  const opp = makeOpp({
    opportunity_id: "OPP-010",
    name: "Matching activo-inversor",
    recommended_component_family: "matching_engine",
    recommended_layer: "C_intelligence",
    dataset_readiness_required: true,
    dataset_readiness_reason: "No hay histórico etiquetado de matches exitosos.",
  });

  const design = makeDesign([opp]);
  const res = buildRegistryFromDesign(design, {
    clientCompanyName: "AFFLUX",
  });

  const c = res.registry.components[0];
  assertEquals(c.status, "requires_human_review");
  assert(
    (c.dataset_requirements ?? []).length >= 1,
    "Debe haber añadido placeholder de dataset_requirements",
  );
  assert(
    res.warnings.some((w) => w.code === "F3_DATASET_READINESS_FORCED_REVIEW"),
    "Debe emitir warning F3_DATASET_READINESS_FORCED_REVIEW",
  );
});

// ── 4. DPIA trigger ─────────────────────────────────────────────────

Deno.test("F3: compliance flags peligrosas → item.dpia_required=true y registry.dpia.required=true", () => {
  const opp = makeOpp({
    opportunity_id: "OPP-020",
    name: "Detector de eventos vitales",
    recommended_component_family: "pattern_module",
    recommended_layer: "C_intelligence",
    compliance_flags: [
      "personal_data_processing",
      "gdpr_article_22_risk",
      "automated_decision_support",
    ],
    dataset_readiness_required: false,
  });

  const design = makeDesign([opp]);
  const res = buildRegistryFromDesign(design, { clientCompanyName: "AFFLUX" });

  const c = res.registry.components[0];
  assertEquals(c.dpia_required, true, "item.dpia_required debe ser true");
  assertEquals(res.registry.dpia?.required, true, "registry.dpia.required debe ser true");
  assertEquals(res.registry.dpia?.status, "not_started");
  assert(
    (res.registry.dpia?.trigger_flags ?? []).length >= 1,
    "registry.dpia.trigger_flags debe tener al menos una flag",
  );

  // Y human_review forzado a mandatory por flags HIGH_RISK.
  assertEquals(c.human_review, "mandatory");
});

// ── 5. enforceNoApproval ────────────────────────────────────────────

Deno.test("F3: enforceNoApproval baja approved_for_scope a candidate_validated", () => {
  const item: ComponentRegistryItem = {
    component_id: "COMP-B99",
    name: "Componente espurio",
    description: "test",
    family: "agent",
    layer: "B_action",
    status: "approved_for_scope", // ← prohibido en F3
    phase: "F3_registry_builder",
    priority: "P2_medium",
    business_job: "x",
    business_justification: "y",
    evidence_type: "inferred_need",
    evidence_strength: "medium",
    source_quotes: [],
    business_catalysts_covered: [],
    data_assets_activated: [],
    economic_pains_addressed: [],
    input_data: [],
    output_data: [],
    required_rags: [],
    required_agents: [],
    required_forms: [],
    external_sources: [],
    soul_dependency: "none",
    human_review: "optional",
    prerequisites: [],
    dataset_requirements: [],
    success_metric: undefined,
    acceptance_criteria: [],
    compliance_flags: [],
    dpia_required: false,
    build_complexity: "medium",
    business_impact: "medium",
    cost_estimate: undefined,
    mutation_history: [],
  };

  const { item: out, warning } = enforceNoApproval(item);
  assertEquals(out.status, "candidate_validated");
  assert(warning, "Debe devolver warning");
  assertEquals(warning?.code, "F3_FORBIDDEN_APPROVAL_DOWNGRADED");
});

Deno.test("F3: ningún componente queda en approved_for_scope al final del build", () => {
  const opps = [
    makeOpp({ opportunity_id: "OPP-001", name: "RAG llamadas", recommended_component_family: "rag", recommended_layer: "A_knowledge" }),
    makeOpp({ opportunity_id: "OPP-002", name: "Agente comercial", recommended_component_family: "agent", recommended_layer: "B_action" }),
    makeOpp({ opportunity_id: "OPP-003", name: "Soul fundador", recommended_component_family: "soul_module", recommended_layer: "D_soul" }),
  ];
  const res = buildRegistryFromDesign(makeDesign(opps), { clientCompanyName: "AFFLUX" });
  for (const c of res.registry.components) {
    assert(
      c.status !== "approved_for_scope",
      `Componente ${c.component_id} no puede estar approved_for_scope en F3`,
    );
  }
});

// ── 6. Naming collision ─────────────────────────────────────────────

Deno.test("F3: detecta naming collision cuando product_name == client_company_name", () => {
  const res = buildRegistryFromDesign(makeDesign([
    makeOpp({ opportunity_id: "OPP-001", name: "RAG", recommended_component_family: "rag", recommended_layer: "A_knowledge" }),
  ]), {
    clientCompanyName: "AFFLUX",
    productName: "AFFLUX",
  });

  const collisionWarning = res.warnings.find((w) => w.code === "F3_NAMING_COLLISION");
  assert(collisionWarning, "Debe emitir warning F3_NAMING_COLLISION cuando product=client");
});

// ── 7. applyHumanReviewRules ────────────────────────────────────────

Deno.test("F3: profiling fuerza human_review mínimo recommended", () => {
  const item: ComponentRegistryItem = {
    component_id: "COMP-C01",
    name: "Scoring",
    description: "x",
    family: "scoring_engine",
    layer: "C_intelligence",
    status: "candidate_validated",
    phase: "F3_registry_builder",
    priority: "P2_medium",
    business_job: "x",
    business_justification: "y",
    evidence_type: "inferred_need",
    evidence_strength: "medium",
    source_quotes: [],
    business_catalysts_covered: [],
    data_assets_activated: [],
    economic_pains_addressed: [],
    input_data: [], output_data: [],
    required_rags: [], required_agents: [], required_forms: [],
    external_sources: [],
    soul_dependency: "none",
    human_review: "none",
    prerequisites: [], dataset_requirements: [],
    success_metric: undefined, acceptance_criteria: [],
    compliance_flags: ["profiling"],
    dpia_required: false,
    build_complexity: "medium", business_impact: "medium",
    cost_estimate: undefined, mutation_history: [],
  };
  const out = applyHumanReviewRules(item);
  assert(["recommended", "mandatory", "mandatory_with_veto"].includes(out.human_review));
});

// ── F3 hardening: injectGovernanceIfMissing ──────────────────────────

import { injectGovernanceIfMissing } from "./f3-registry-builder.ts";
import type { ComponentRegistry } from "../_shared/component-registry-contract.ts";

function makeRegistryFixture(opts: {
  dpiaRequired: boolean;
  hasGovernance?: boolean;
}): ComponentRegistry {
  const components: ComponentRegistryItem[] = [];
  if (opts.hasGovernance) {
    components.push({
      component_id: "COMP-G01",
      name: "Existing governance",
      description: "Already-present governance module",
      family: "compliance_module",
      layer: "G_governance",
      status: "candidate_validated",
      phase: "F3_registry_builder",
      priority: "P1_high",
      business_job: "manage compliance",
      business_justification: "needed",
      evidence_type: "compliance_required",
      evidence_strength: "high",
      source_quotes: [],
      soul_dependency: "none",
      human_review: "mandatory",
      compliance_flags: ["personal_data_processing"],
      dpia_required: true,
      build_complexity: "medium",
      business_impact: "high",
      mutation_history: [],
    });
  }
  return {
    registry_version: "1.0.0",
    client_company_name: "Test",
    components,
    dpia: opts.dpiaRequired
      ? {
          required: true,
          trigger_flags: ["personal_data_processing", "profiling"],
          status: "not_started",
          reason: "test",
        }
      : {
          required: false,
          trigger_flags: [],
          status: "not_required",
          reason: "test",
        },
    updated_at: new Date().toISOString(),
  } as ComponentRegistry;
}

Deno.test("F3 hardening: injectGovernanceIfMissing inyecta cuando DPIA required y no hay governance", () => {
  const reg = makeRegistryFixture({ dpiaRequired: true });
  const counters: Record<string, number> = {};
  const res = injectGovernanceIfMissing(reg, counters);
  assertEquals(res.injected, true);
  assert(res.warning?.code === "F3_GOVERNANCE_AUTO_INJECTED");
  const govComponents = res.registry.components.filter(
    (c) => c.family === "compliance_module" || c.layer === "G_governance",
  );
  assertEquals(govComponents.length, 1);
  const gov = govComponents[0];
  assertEquals(gov.name, "Gobernanza RGPD y DPIA");
  assertEquals(gov.layer, "G_governance");
  assertEquals(gov.family, "compliance_module");
  assertEquals(gov.dpia_required, true);
  assertEquals(gov.human_review, "mandatory");
  assert(gov.component_id.startsWith("COMP-G"));
  // mutation_history presente
  assert(gov.mutation_history.length > 0, "Debe tener mutation_history");
  assertEquals(gov.mutation_history[0].action, "created");
  // status NUNCA approved_for_scope
  assert(gov.status !== "approved_for_scope" as any, "status no debe ser approved_for_scope");
  assertEquals(gov.status, "candidate_validated");
});

Deno.test("F3 hardening: injectGovernanceIfMissing NO duplica si ya existe governance", () => {
  const reg = makeRegistryFixture({ dpiaRequired: true, hasGovernance: true });
  const counters: Record<string, number> = {};
  const res = injectGovernanceIfMissing(reg, counters);
  assertEquals(res.injected, false);
  assertEquals(res.warning, undefined);
  const govComponents = res.registry.components.filter(
    (c) => c.family === "compliance_module" || c.layer === "G_governance",
  );
  assertEquals(govComponents.length, 1, "No debe duplicar governance existente");
});

Deno.test("F3 hardening: injectGovernanceIfMissing NO inyecta si DPIA no requerida", () => {
  const reg = makeRegistryFixture({ dpiaRequired: false });
  const counters: Record<string, number> = {};
  const res = injectGovernanceIfMissing(reg, counters);
  assertEquals(res.injected, false);
  const govComponents = res.registry.components.filter(
    (c) => c.family === "compliance_module" || c.layer === "G_governance",
  );
  assertEquals(govComponents.length, 0);
});

Deno.test("F3 hardening: injectGovernanceIfMissing usa trigger_flags de DPIA como compliance_flags", () => {
  const reg = makeRegistryFixture({ dpiaRequired: true });
  const counters: Record<string, number> = {};
  const res = injectGovernanceIfMissing(reg, counters);
  const gov = res.registry.components.find((c) => c.layer === "G_governance")!;
  assert(gov.compliance_flags?.includes("personal_data_processing"));
  assert(gov.compliance_flags?.includes("profiling"));
});
