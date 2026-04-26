/**
 * Tests deterministas para `applyNamingSplit` (regla de oro:
 * `ctx.projectName` del usuario es la fuente canónica de
 * `proposed_product_name`; las variantes pasan a `detected_aliases[]`).
 *
 * Ejecutamos a través de `normalizeBrief` para cubrir el flujo público.
 * Pasamos `language: "es"` y dejamos los campos vacíos para evitar la
 * llamada LLM (la cobertura aquí es naming, no traducción).
 */

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeBrief } from "./brief-normalizer.ts";

function makeBriefing(extra: Record<string, unknown> = {}) {
  return {
    business_extraction_v2: {
      business_model_summary: { title: "AFFLUX", context: "AFLU es una empresa.", primary_goal: "Vender." },
      executive_summary: "AFLU y AFLUS y AFFLU son variantes que aparecen en la transcripción.",
      observed_facts: [],
      business_catalysts: [],
      underutilized_data_assets: [],
      quantified_economic_pains: [],
      decision_points: [],
      stakeholder_signals: [],
      client_requested_items: [],
      inferred_needs: [],
      ai_native_opportunity_signals: [],
      external_data_sources_mentioned: [],
      founder_commitment_signals: [],
      initial_compliance_flags: [],
      constraints_and_risks: [],
      open_questions: [],
      architecture_signals: [],
      source_quotes: ["Aflu hace muchas cosas", "Visitamos la oficina de AFLUS ayer"],
      ...extra,
    },
    _f0_signals: {},
    brief_version: "2.0.0",
  };
}

Deno.test("naming: projectName del usuario sobrescribe proposed_product_name extraído", async () => {
  const briefing = makeBriefing({
    client_naming_check: {
      client_company_name: "AFLU",
      proposed_product_name: "AFLUS",
      founder_or_decision_maker: "Alejandro Gordo",
    },
  });
  const res = await normalizeBrief(briefing, {
    projectName: "AFFLUX",
    companyName: "AFLU",
    language: "es",
  });
  const cnc = res.briefing.business_extraction_v2.client_naming_check;
  assertEquals(cnc.proposed_product_name, "AFFLUX");
  assertEquals(cnc.canonical_source, "user_project_input");
  assert(Array.isArray(cnc.detected_aliases));
  assert(cnc.detected_aliases.includes("AFLUS") || cnc.detected_aliases.includes("AFLU"));
});

Deno.test("naming: client_company_name persona se mueve a founder_or_decision_maker", async () => {
  const briefing = makeBriefing({
    client_naming_check: {
      client_company_name: "Alejandro Gordo",
      proposed_product_name: null,
    },
  });
  const res = await normalizeBrief(briefing, {
    projectName: "AFFLUX",
    companyName: "Alejandro Gordo",
    language: "es",
  });
  const cnc = res.briefing.business_extraction_v2.client_naming_check;
  assertEquals(cnc.founder_or_decision_maker, "Alejandro Gordo");
  assert(cnc.client_company_name !== "Alejandro Gordo");
  assertEquals(cnc.proposed_product_name, "AFFLUX");
});

Deno.test("naming: proposed_product_name nunca queda null si projectName existe", async () => {
  const briefing = makeBriefing({
    client_naming_check: {
      client_company_name: "AFLU",
      proposed_product_name: null,
    },
  });
  const res = await normalizeBrief(briefing, {
    projectName: "AFFLUX",
    companyName: "AFLU",
    language: "es",
  });
  const cnc = res.briefing.business_extraction_v2.client_naming_check;
  assertEquals(cnc.proposed_product_name, "AFFLUX");
  assertEquals(cnc.canonical_source, "user_project_input");
});

Deno.test("naming: aliases detectados incluyen variantes de la transcripción", async () => {
  const briefing = makeBriefing({
    client_naming_check: {
      client_company_name: "AFLU",
      proposed_product_name: "Aflu",
    },
  });
  const res = await normalizeBrief(briefing, {
    projectName: "AFFLUX",
    companyName: "AFLU",
    language: "es",
  });
  const cnc = res.briefing.business_extraction_v2.client_naming_check;
  const aliases: string[] = cnc.detected_aliases || [];
  // Al menos una variante real debe aparecer.
  const hasVariant = aliases.some((a) => /aflu/i.test(a)) ||
    aliases.some((a) => /afflu/i.test(a));
  assert(hasVariant, `Esperaba aliases con variantes; obtuve: ${JSON.stringify(aliases)}`);
  // Y el canónico NO debe aparecer como alias propio.
  assert(!aliases.some((a) => a.toLowerCase() === "afflux"));
});
