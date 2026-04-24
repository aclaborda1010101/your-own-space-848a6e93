/**
 * f1-legacy-shape_test.ts — QA Paso 2 (F0+F1)
 *
 * Tests puros (sin LLM, sin red) sobre los helpers post-parse:
 *   - ensureLegacyBriefShape
 *   - stripRegistryLeaks
 *   - appendExtractionWarning
 */

import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  appendExtractionWarning,
  ensureLegacyBriefShape,
  stripRegistryLeaks,
} from "./f1-legacy-shape.ts";

// ── ensureLegacyBriefShape ─────────────────────────────────────────────

Deno.test("ensureLegacyBriefShape: deriva los 10 campos legacy desde business_extraction_v2", () => {
  const input = {
    brief_version: "2.0.0",
    business_extraction_v2: {
      business_model_summary: "Cliente real estate off-market en Madrid.",
      observed_facts: [{ fact: "Tienen 3.000 llamadas grabadas" }],
      architecture_signals: [{ signal: "Necesitan RAG de llamadas" }],
      client_requested_items: [{ item: "Catalogar propietarios en 7 roles" }],
      ai_native_opportunity_signals: [{ signal_name: "Detector de fallecimientos" }],
      inferred_needs: [{ need: "Mejorar seguimiento comercial" }],
      constraints_and_risks: [{ risk: "Dependencia del Soul de Alejandro" }],
      open_questions: [{ question: "¿Dónde están almacenadas las llamadas?" }],
    },
  };

  const out = ensureLegacyBriefShape(input);

  assertExists(out.project_summary, "project_summary debe existir");
  assertEquals(typeof out.project_summary, "object");

  // 10 campos legacy presentes (project_summary + 9 arrays)
  for (const field of [
    "observed_facts",
    "inferred_needs",
    "solution_candidates",
    "constraints_and_risks",
    "open_questions",
    "architecture_signals",
    "deep_patterns",
    "extraction_warnings",
    "parallel_projects",
  ]) {
    assert(Array.isArray(out[field]), `${field} debe ser array`);
  }

  // solution_candidates derivado de client_requested_items + ai_native_opportunity_signals
  assert(
    out.solution_candidates.length >= 2,
    `solution_candidates debe tener >=2 (got ${out.solution_candidates.length})`,
  );

  // observed_facts viene de v2 con id derivado
  assertEquals(out.observed_facts.length, 1);
  assertEquals(out.observed_facts[0].id, "OF-001");

  // business_extraction_v2 se preserva intacto
  assertExists(out.business_extraction_v2);
  assertEquals(out.brief_version, "2.0.0");
});

Deno.test("ensureLegacyBriefShape: input vacío/null devuelve objeto sin romper", () => {
  assertEquals(ensureLegacyBriefShape(null), {});
  assertEquals(ensureLegacyBriefShape(undefined), {});

  const empty = ensureLegacyBriefShape({});
  assertExists(empty.project_summary);
  assert(Array.isArray(empty.observed_facts));
  assertEquals(empty.observed_facts.length, 0);
});

Deno.test("ensureLegacyBriefShape: respeta arrays legacy ya presentes (no sobrescribe)", () => {
  const input = {
    observed_facts: [{ id: "OF-EXISTING", description: "ya estaba" }],
    business_extraction_v2: {
      observed_facts: [{ fact: "no debería sobrescribir" }],
    },
  };
  const out = ensureLegacyBriefShape(input);
  assertEquals(out.observed_facts.length, 1);
  assertEquals(out.observed_facts[0].id, "OF-EXISTING");
});

// ── stripRegistryLeaks ─────────────────────────────────────────────────

Deno.test("stripRegistryLeaks: elimina component_registry y components top-level y dentro de v2", () => {
  const input = {
    component_registry: { foo: "bar" },
    components: [{ id: "X" }],
    business_extraction_v2: {
      ComponentRegistryItem: { id: "Y" },
      components: [{ id: "Z" }],
      ai_native_opportunity_signals: [
        { id: "COMP-001", signal_name: "Algo" },
        { id: "AON-002", signal_name: "Otro" },
      ],
    },
  };

  const { cleaned, leakDetected, leakDetails } = stripRegistryLeaks(input);

  assert(!("component_registry" in cleaned), "component_registry debe haberse eliminado");
  assert(!("components" in cleaned), "components top-level debe haberse eliminado");
  assert(
    !("ComponentRegistryItem" in cleaned.business_extraction_v2),
    "business_extraction_v2.ComponentRegistryItem debe haberse eliminado",
  );
  assert(
    !("components" in cleaned.business_extraction_v2),
    "business_extraction_v2.components debe haberse eliminado",
  );

  assertEquals(leakDetected, true);
  assert(leakDetails.length > 0, "leakDetails debe tener entradas");

  // El item con COMP-001 queda registrado en details (flagged, no borrado del array)
  const flagged = leakDetails.some((d) => d.includes("COMP-001"));
  assert(flagged, "COMP-001 debe quedar registrado en leakDetails");
});

Deno.test("stripRegistryLeaks: input limpio no detecta leaks", () => {
  const input = {
    business_extraction_v2: {
      observed_facts: [{ id: "OF-001", description: "ok" }],
      ai_native_opportunity_signals: [{ id: "AON-001", signal_name: "ok" }],
    },
  };
  const { leakDetected, leakDetails } = stripRegistryLeaks(input);
  assertEquals(leakDetected, false);
  assertEquals(leakDetails.length, 0);
});

Deno.test("stripRegistryLeaks: null/undefined no rompen", () => {
  const r1 = stripRegistryLeaks(null);
  assertEquals(r1.leakDetected, false);
  assertEquals(r1.leakDetails.length, 0);

  const r2 = stripRegistryLeaks(undefined);
  assertEquals(r2.leakDetected, false);
});

// ── appendExtractionWarning ────────────────────────────────────────────

Deno.test("appendExtractionWarning: crea array si no existe", () => {
  const briefing: any = {};
  appendExtractionWarning(briefing, { code: "TEST_WARN", message: "hola" });
  assert(Array.isArray(briefing.extraction_warnings));
  assertEquals(briefing.extraction_warnings.length, 1);
  assertEquals(briefing.extraction_warnings[0].code, "TEST_WARN");
});

Deno.test("appendExtractionWarning: añade sin reemplazar warnings previos", () => {
  const briefing: any = {
    extraction_warnings: [{ code: "PREV", message: "anterior" }],
  };
  appendExtractionWarning(briefing, { code: "NEW", message: "nuevo" });
  assertEquals(briefing.extraction_warnings.length, 2);
  assertEquals(briefing.extraction_warnings[0].code, "PREV");
  assertEquals(briefing.extraction_warnings[1].code, "NEW");
});
