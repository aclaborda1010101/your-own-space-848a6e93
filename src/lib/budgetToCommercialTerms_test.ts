/**
 * Deno tests for src/lib/budgetToCommercialTerms.ts
 *
 * Run with: deno test --allow-read src/lib/budgetToCommercialTerms_test.ts
 *
 * Why Deno (and not Vitest)? The project pipeline runs the
 * `supabase--test_edge_functions` runner which uses Deno. This file is
 * pure TypeScript with no node/browser deps, so Deno can execute it
 * directly and we keep all tests in a single runner.
 */
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  budgetToCommercialTermsV1,
  parseEuroAmountOrRange,
  type BudgetData,
} from "./budgetToCommercialTerms.ts";

// ───────────────────────────────────────────────────────────────────────────────
// parseEuroAmountOrRange — directly fixes the "15,5 EUR" bug
// ───────────────────────────────────────────────────────────────────────────────

Deno.test("parser: '13.500' → 13500 (thousand separator dot)", () => {
  const r = parseEuroAmountOrRange("13.500");
  assertEquals(r?.min, 13500);
  assertEquals(r?.max, undefined);
  assertEquals(r?.display, "13.500 EUR");
});

Deno.test("parser: '13,500' → 13500 (Spanish thousand separator comma)", () => {
  const r = parseEuroAmountOrRange("13,500");
  assertEquals(r?.min, 13500);
  assertEquals(r?.display, "13.500 EUR");
  // Critical: must NOT be 13.5 / "13,5 EUR"
  assert(r?.display !== "13,5 EUR", `must not produce '13,5 EUR' from '13,500'`);
});

Deno.test("parser: '15.000 - 18.000' → range 15000-18000", () => {
  const r = parseEuroAmountOrRange("15.000 - 18.000");
  assertEquals(r?.min, 15000);
  assertEquals(r?.max, 18000);
  assertEquals(r?.display, "15.000 - 18.000 EUR");
});

Deno.test("parser: '€750 - 850' → range 750-850", () => {
  const r = parseEuroAmountOrRange("€750 - 850");
  assertEquals(r?.min, 750);
  assertEquals(r?.max, 850);
  assertEquals(r?.display, "750 - 850 EUR");
});

Deno.test("parser: '850' → 850 single", () => {
  const r = parseEuroAmountOrRange("850");
  assertEquals(r?.min, 850);
  assertEquals(r?.max, undefined);
});

Deno.test("parser: '1,250' → 1250 (not 1.25)", () => {
  const r = parseEuroAmountOrRange("1,250");
  assertEquals(r?.min, 1250);
});

Deno.test("parser: '13,5' → 13.5 (real decimal, 1 digit after comma)", () => {
  const r = parseEuroAmountOrRange("13,5");
  assertEquals(r?.min, 13.5);
});

Deno.test("parser: 'Estimado 8.500 - 12.000 (facturado por horas)' → range", () => {
  const r = parseEuroAmountOrRange("Estimado 8.500 - 12.000 (facturado por horas)");
  assertEquals(r?.min, 8500);
  assertEquals(r?.max, 12000);
});

Deno.test("parser: empty/null/undefined → null", () => {
  assertEquals(parseEuroAmountOrRange(""), null);
  assertEquals(parseEuroAmountOrRange(null), null);
  assertEquals(parseEuroAmountOrRange(undefined), null);
});

Deno.test("parser: number input preserved", () => {
  const r = parseEuroAmountOrRange(15000);
  assertEquals(r?.min, 15000);
  assertEquals(r?.display, "15.000 EUR");
});

// ───────────────────────────────────────────────────────────────────────────────
// budgetToCommercialTermsV1 — integration covering the original AFFLUX failure
// ───────────────────────────────────────────────────────────────────────────────

function baseBudget(over: Partial<NonNullable<BudgetData["monetization_models"]>[number]> = {}): BudgetData {
  return {
    pricing_notes: "50% al inicio, 50% a entrega.",
    recommended_model: "Proyecto Cerrado + Retainer",
    monetization_models: [
      {
        name: "Proyecto Cerrado + Retainer",
        setup_price_eur: "13,500",
        monthly_price_eur: "1,250",
        your_margin_pct: 48.2,
        ...over,
      },
    ],
  };
}

Deno.test("mapper: '13,500' setup_price → 13500 (regression for the '15,5 EUR' bug)", () => {
  const ct = budgetToCommercialTermsV1(baseBudget())!;
  assertEquals(ct.setup_fee, 13500);
  assertEquals(ct.setup_fee_display, "13.500 EUR");
  assertEquals(ct.monthly_retainer, 1250);
  assertEquals(ct.monthly_retainer_display, "1.250 EUR");
});

Deno.test("mapper: '15.000 - 18.000' setup → setup_fee 15000, max 18000, display range", () => {
  const ct = budgetToCommercialTermsV1(
    baseBudget({ setup_price_eur: "15.000 - 18.000", monthly_price_eur: "750 - 850" }),
  )!;
  assertEquals(ct.setup_fee, 15000);
  assertEquals(ct.setup_fee_max, 18000);
  assertEquals(ct.setup_fee_display, "15.000 - 18.000 EUR");
  assertEquals(ct.monthly_retainer, 750);
  assertEquals(ct.monthly_retainer_max, 850);
  assertEquals(ct.monthly_retainer_display, "750 - 850 EUR");
});

Deno.test("mapper: scrubs 'margen de consultoría 40%' from pricing_notes → payment_terms", () => {
  const ct = budgetToCommercialTermsV1({
    ...baseBudget(),
    pricing_notes:
      "50% al inicio. 50% a entrega del MVP. El precio de setup incluye un margen de consultoría del 40%.",
  })!;
  assert(!/margen/i.test(ct.payment_terms), `payment_terms still leaks margin: ${ct.payment_terms}`);
  assert(/50%/.test(ct.payment_terms), `payment_terms should keep the 50/50 sentence`);
});

Deno.test("mapper: returns null when no monetization_models", () => {
  assertEquals(budgetToCommercialTermsV1({} as BudgetData), null);
  assertEquals(budgetToCommercialTermsV1(null), null);
});
