/**
 * f7-proposal-builder_test.ts
 */
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildClientProposal, renderProposalMarkdown, detectInternalJargon } from "./f7-proposal-builder.ts";
import type { ScopeArchitectureV1 } from "./f5-deterministic-scope.ts";

function fakeScope(): ScopeArchitectureV1 {
  return {
    schema_version: "1.0.0",
    data_foundation: [{
      scope_id: "SCOPE-001", source_type: "registry_component", source_ref: "COMP-A01",
      name: "Conocimiento base", bucket: "data_foundation", status: "approved_for_scope",
      blockers: [], required_actions: [], soul_dependency: "none",
      business_job: "Mantener la fuente de verdad de la operativa.",
    }],
    mvp: [{
      scope_id: "SCOPE-002", source_type: "registry_component", source_ref: "COMP-C01",
      name: "Detector de oportunidades", bucket: "mvp", status: "approved_with_conditions",
      blockers: [], required_actions: [], soul_dependency: "none",
      business_job: "Detectar oportunidades comerciales en el flujo entrante.",
    }],
    fast_follow_f2: [{
      scope_id: "SCOPE-003", source_type: "registry_component", source_ref: "COMP-C04",
      name: "Compradores institucionales (Benatar)", bucket: "fast_follow_f2",
      status: "deferred", blockers: [], required_actions: [], soul_dependency: "none",
    }],
    roadmap_f3: [],
    rejected_out_of_scope: [],
    compliance_blockers: [{
      scope_id: "SCOPE-002", component_name: "Detector de oportunidades",
      required_artifacts: ["DPIA"], reason: "Datos personales.",
      owner: "DPO / Responsable legal del cliente", deadline_weeks: 4,
      blocks_design: false, blocks_internal_testing: false, blocks_production: true,
    }],
    data_readiness_blockers: [],
    human_decisions_applied: [],
    soul_capture_plan: {
      required: true, sessions: 4, session_duration_min: 45, weeks_window: "weeks_1_to_2",
      deliverables: ["criterio"], hard_dependencies: ["COMP-D01"], async_dependencies: [],
      fallback: "Heurísticas.",
    },
    client_deliverables: { mvp_demo_features: [], documentation: [], training_sessions: [] },
    scope_decision_log: [],
  };
}

function fakeCommercial(overrides: Partial<any> = {}) {
  return {
    pricing_model: "setup_plus_monthly" as const,
    setup_fee: 25000,
    monthly_retainer: 4500,
    currency: "EUR",
    payment_terms: "50% al inicio, 50% contra entrega.",
    validity_days: 30,
    ai_usage_cost_policy: "Costes IA según consumo.",
    taxes: "IVA no incluido.",
    ...overrides,
  };
}

Deno.test("F7: produces a single proposal with budget and conditions", () => {
  const out = buildClientProposal({
    scope: fakeScope(),
    source_step: { step_number: 28, version: 3, row_id: "row-28" },
    projectName: "AFFLUX",
    clientCompany: "AFLU / AFFLUX",
    decisionMakerName: "Alejandro Gordo",
    commercialTerms: fakeCommercial(),
  });
  const p = out.client_proposal_v1;
  assertEquals(p.mvp_scope.length, 2);
  assertEquals(p.later_phases.fast_follow.length, 1);
  assertEquals(p.later_phases.roadmap.length, 0);
  assertEquals(p.budget.setup_fee, 25000);
  assertEquals(p.budget.monthly_retainer, 4500);
  assertEquals(p.client_company, "AFLU / AFFLUX");
  assertEquals(p.decision_maker_name, "Alejandro Gordo");
  assert(p.conditions.some((c) => /cumplimiento/i.test(c)));
  assert(p.conditions.some((c) => /sesiones/i.test(c)));
  assert(p.implementation_plan.soul_sessions_required);
  assertEquals(p.implementation_plan.soul_sessions_count, 4);
});

Deno.test("F7: markdown uses ES headers and shows cliente/decisor", () => {
  const out = buildClientProposal({
    scope: fakeScope(),
    source_step: { step_number: 28, version: 3, row_id: "row-28" },
    projectName: "AFFLUX",
    clientCompany: "AFLU / AFFLUX",
    decisionMakerName: "Alejandro Gordo",
    commercialTerms: fakeCommercial({ pricing_model: "fixed_project", monthly_retainer: undefined, setup_fee: 50000 }),
  });
  const md = renderProposalMarkdown(out.client_proposal_v1);
  const jargon = detectInternalJargon(md);
  assertEquals(jargon, []);
  assert(md.includes("# Propuesta — AFFLUX"));
  // REGLA DE ORO: CONFIDENCIAL usa el projectName del usuario, no client_company.
  assert(md.includes("CONFIDENCIAL — AFFLUX"));
  assert(md.includes("**Proyecto / Producto:** AFFLUX"));
  assert(md.includes("**Cliente / empresa:** AFLU / AFFLUX"));
  assert(md.includes("**Decisor:** Alejandro Gordo"));
});

Deno.test("F7: phased pricing — meta counts coherent", () => {
  const out = buildClientProposal({
    scope: fakeScope(),
    source_step: { step_number: 28, version: 3, row_id: "row-28" },
    projectName: "AFFLUX",
    clientCompany: "AFLU / AFFLUX",
    commercialTerms: fakeCommercial({
      pricing_model: "phased",
      setup_fee: undefined,
      monthly_retainer: undefined,
      phase_prices: [{ phase: "F1", price: 10000 }],
    }),
  });
  assertEquals(out.proposal_meta.mvp_count, 2);
  assertEquals(out.proposal_meta.fast_follow_count, 1);
  assert(out.proposal_meta.has_compliance_blockers);
  assert(out.proposal_meta.soul_required);
});

Deno.test("F7: detectInternalJargon catches banned phrases", () => {
  const found = detectInternalJargon("This mentions Step 28 and F4 and registry_gap_audit_v1.");
  assert(found.length >= 2);
});

Deno.test("F7: throws MISSING_BUDGET_AMOUNTS when no fees provided", () => {
  let threw = false;
  try {
    buildClientProposal({
      scope: fakeScope(),
      source_step: { step_number: 28, version: 3, row_id: "row-28" },
      projectName: "AFFLUX",
      clientCompany: "AFLU / AFFLUX",
      commercialTerms: fakeCommercial({ setup_fee: undefined, monthly_retainer: undefined, phase_prices: undefined }),
    });
  } catch (e) {
    threw = true;
    assert(String((e as Error).message).startsWith("MISSING_BUDGET_AMOUNTS"));
  }
  assert(threw, "expected MISSING_BUDGET_AMOUNTS to throw");
});

Deno.test("F7: weeks_1_to_2 → 'semanas 1 y 2' in conditions", () => {
  const out = buildClientProposal({
    scope: fakeScope(),
    source_step: { step_number: 28, version: 3, row_id: "row-28" },
    projectName: "AFFLUX",
    clientCompany: "AFLU / AFFLUX",
    commercialTerms: fakeCommercial(),
  });
  const cond = out.client_proposal_v1.conditions.find((c) => /sesiones/i.test(c));
  assert(cond, "expected a conditions entry about sesiones");
  assert(/semanas 1 y 2/.test(cond!), `expected 'semanas 1 y 2' in: ${cond}`);
  assert(!/weeks?[_ ]1[_ ]to[_ ]2/i.test(cond!), `should not contain raw weeks_1_to_2: ${cond}`);
});

Deno.test("F7: markdown numbering is consecutive (1..N), no gaps", () => {
  const out = buildClientProposal({
    scope: fakeScope(),
    source_step: { step_number: 28, version: 3, row_id: "row-28" },
    projectName: "AFFLUX",
    clientCompany: "AFLU / AFFLUX",
    commercialTerms: fakeCommercial(),
  });
  const md = renderProposalMarkdown(out.client_proposal_v1);
  const numbered = [...md.matchAll(/^## (\d+)\. /gm)].map((m) => Number(m[1]));
  assert(numbered.length >= 8, `expected at least 8 numbered sections, got ${numbered.length}`);
  for (let i = 0; i < numbered.length; i++) {
    assertEquals(numbered[i], i + 1, `section ${i} should be numbered ${i + 1}, got ${numbered[i]}`);
  }
});

Deno.test("F7: omits 'Roadmap posterior' subsection when empty", () => {
  const out = buildClientProposal({
    scope: fakeScope(),
    source_step: { step_number: 28, version: 3, row_id: "row-28" },
    projectName: "AFFLUX",
    clientCompany: "AFLU / AFFLUX",
    commercialTerms: fakeCommercial(),
  });
  const md = renderProposalMarkdown(out.client_proposal_v1);
  assert(!md.includes("Roadmap posterior"), "should not render empty Roadmap subsection");
  assert(md.includes("Segundo lote"), "should still render fast-follow subsection");
});

Deno.test("F7: respects Step 28 buckets — copies them as-is (1+9 / 2 / 0)", () => {
  const scope = fakeScope();
  scope.mvp = Array.from({ length: 9 }, (_, i) => ({
    scope_id: `SCOPE-MVP-${i + 1}`,
    source_type: "registry_component" as const,
    source_ref: `COMP-MVP-${i + 1}`,
    name: `Componente MVP ${i + 1}`,
    bucket: "mvp" as const,
    status: "approved_for_scope" as const,
    blockers: [],
    required_actions: [],
    soul_dependency: "none" as const,
    business_job: `Trabajo de negocio ${i + 1}.`,
  }));
  scope.fast_follow_f2 = [
    {
      scope_id: "SCOPE-FF-1", source_type: "registry_component", source_ref: "COMP-FF-1",
      name: "Revista emocional", bucket: "fast_follow_f2", status: "deferred",
      blockers: [], required_actions: [], soul_dependency: "none",
    },
    {
      scope_id: "SCOPE-FF-2", source_type: "registry_component", source_ref: "COMP-FF-2",
      name: "Compradores institucionales (Benatar)", bucket: "fast_follow_f2", status: "deferred",
      blockers: [], required_actions: [], soul_dependency: "none",
    },
  ];
  scope.roadmap_f3 = [];

  const out = buildClientProposal({
    scope,
    source_step: { step_number: 28, version: 2, row_id: "row-28" },
    projectName: "AFFLUX",
    clientCompany: "AFLU / AFFLUX",
    commercialTerms: fakeCommercial(),
  });
  // data_foundation (1) + mvp (9) = 10 en alcance MVP del PDF
  assertEquals(out.client_proposal_v1.mvp_scope.length, 10);
  assertEquals(out.client_proposal_v1.later_phases.fast_follow.length, 2);
  assertEquals(out.client_proposal_v1.later_phases.roadmap.length, 0);
});

// ───────────────────────────────────────────────────────────────────────────────
// Bug #1 — Importes europeos / rangos en setup_fee_display y monthly_retainer_display
// ───────────────────────────────────────────────────────────────────────────────

Deno.test("F7: renders setup_fee_display when provided (range '15.000 - 18.000 EUR')", () => {
  const out = buildClientProposal({
    scope: fakeScope(),
    source_step: { step_number: 28, version: 3, row_id: "row-28" },
    projectName: "AFFLUX",
    clientCompany: "AFLU / AFFLUX",
    commercialTerms: fakeCommercial({
      setup_fee: 15000,
      setup_fee_max: 18000,
      setup_fee_display: "15.000 - 18.000 EUR",
      monthly_retainer: 750,
      monthly_retainer_max: 850,
      monthly_retainer_display: "750 - 850 EUR/mes",
    }),
  });
  const md = renderProposalMarkdown(out.client_proposal_v1);
  assert(md.includes("15.000 - 18.000 EUR"), `expected '15.000 - 18.000 EUR' in markdown`);
  assert(md.includes("750 - 850 EUR/mes"), `expected '750 - 850 EUR/mes' in markdown`);
  // Crucially: must NOT render the broken "15,5 EUR" pattern.
  assert(!/\b15,5\s*EUR\b/.test(md), `must not render broken '15,5 EUR'`);
  // And must NOT compute a 12-month total when ranges exist (avoid misleading numbers).
  assert(!md.includes("Total estimado primer año"), `must not compute year total when ranges present`);
});

Deno.test("F7: when only display strings provided (no numeric), still renders budget", () => {
  const out = buildClientProposal({
    scope: fakeScope(),
    source_step: { step_number: 28, version: 3, row_id: "row-28" },
    projectName: "AFFLUX",
    clientCompany: "AFLU / AFFLUX",
    commercialTerms: fakeCommercial({
      setup_fee: undefined,
      monthly_retainer: undefined,
      setup_fee_display: "13.500 EUR",
    }),
  });
  const md = renderProposalMarkdown(out.client_proposal_v1);
  assert(md.includes("13.500 EUR"), `expected display string`);
});

// ───────────────────────────────────────────────────────────────────────────────
// Bug #2 — No internal margin/cost leak in client document
// ───────────────────────────────────────────────────────────────────────────────

Deno.test("F7: scrubs 'margen de consultoría 40%' from payment_terms", () => {
  const out = buildClientProposal({
    scope: fakeScope(),
    source_step: { step_number: 28, version: 3, row_id: "row-28" },
    projectName: "AFFLUX",
    clientCompany: "AFLU / AFFLUX",
    commercialTerms: fakeCommercial({
      payment_terms:
        "50% al inicio. 50% a la entrega del MVP. El precio de setup incluye un margen de consultoría del 40%. Mensualidades a mes vencido.",
    }),
  });
  const p = out.client_proposal_v1;
  assert(!/margen/i.test(p.payment_terms), `payment_terms still leaks margin: ${p.payment_terms}`);
  assert(/50%/.test(p.payment_terms), `payment_terms should keep the 50/50 sentence`);

  const md = renderProposalMarkdown(p);
  const jargon = detectInternalJargon(md);
  assertEquals(jargon, [], `internal jargon detected: ${jargon.join(", ")}`);
});

Deno.test("F7: BANNED_PHRASES catches 'margen del 40%' and 'tarifa por hora'", () => {
  const found1 = detectInternalJargon("El precio incluye un margen del 40% por consultoría.");
  assert(found1.length >= 1, `expected to flag 'margen del 40%', got ${JSON.stringify(found1)}`);

  const found2 = detectInternalJargon("Tarifa por hora interna: 80 EUR.");
  assert(found2.length >= 1, `expected to flag 'tarifa por hora', got ${JSON.stringify(found2)}`);

  const found3 = detectInternalJargon("Coste interno estimado: 8.000 EUR.");
  assert(found3.length >= 1, `expected to flag 'coste interno'`);
});
