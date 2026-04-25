/**
 * Vitest unit tests for budgetToCommercialTermsV1 + parseEuroAmountOrRange.
 * Run with: bunx vitest run src/lib/budgetToCommercialTerms.test.ts
 */
import { describe, it, expect } from "vitest";
import {
  budgetToCommercialTermsV1,
  parseEuroAmountOrRange,
  type BudgetData,
} from "./budgetToCommercialTerms";

describe("parseEuroAmountOrRange", () => {
  it("parses '13.500' as 13500 (thousand separator)", () => {
    const r = parseEuroAmountOrRange("13.500");
    expect(r?.min).toBe(13500);
    expect(r?.max).toBeUndefined();
    expect(r?.display).toBe("13.500 EUR");
  });

  it("parses '13,500' as 13500 (Spanish thousand separator)", () => {
    const r = parseEuroAmountOrRange("13,500");
    expect(r?.min).toBe(13500);
    expect(r?.display).toBe("13.500 EUR");
  });

  it("parses '15.000 - 18.000' as range 15000-18000", () => {
    const r = parseEuroAmountOrRange("15.000 - 18.000");
    expect(r?.min).toBe(15000);
    expect(r?.max).toBe(18000);
    expect(r?.display).toBe("15.000 - 18.000 EUR");
  });

  it("parses '€750 - 850' as range 750-850", () => {
    const r = parseEuroAmountOrRange("€750 - 850");
    expect(r?.min).toBe(750);
    expect(r?.max).toBe(850);
    expect(r?.display).toBe("750 - 850 EUR");
  });

  it("parses '850' as single value 850", () => {
    const r = parseEuroAmountOrRange("850");
    expect(r?.min).toBe(850);
    expect(r?.max).toBeUndefined();
  });

  it("parses '1,250' as 1250 (not 1.25)", () => {
    const r = parseEuroAmountOrRange("1,250");
    expect(r?.min).toBe(1250);
  });

  it("parses '13,5' as 13.5 (real decimal, 1 digit after comma)", () => {
    const r = parseEuroAmountOrRange("13,5");
    expect(r?.min).toBe(13.5);
  });

  it("parses 'Estimado 8.500 - 12.000 (facturado por horas)' as range", () => {
    const r = parseEuroAmountOrRange("Estimado 8.500 - 12.000 (facturado por horas)");
    expect(r?.min).toBe(8500);
    expect(r?.max).toBe(12000);
  });

  it("returns null for empty/null/undefined", () => {
    expect(parseEuroAmountOrRange("")).toBeNull();
    expect(parseEuroAmountOrRange(null)).toBeNull();
    expect(parseEuroAmountOrRange(undefined)).toBeNull();
  });

  it("preserves number input", () => {
    const r = parseEuroAmountOrRange(15000);
    expect(r?.min).toBe(15000);
    expect(r?.display).toBe("15.000 EUR");
  });
});

describe("budgetToCommercialTermsV1 — integration", () => {
  const baseBudget = (override: Partial<BudgetData["monetization_models"][number]> = {}): BudgetData => ({
    pricing_notes: "50% al inicio, 50% a entrega.",
    recommended_model: "Proyecto Cerrado + Retainer",
    monetization_models: [
      {
        name: "Proyecto Cerrado + Retainer",
        setup_price_eur: "13,500",
        monthly_price_eur: "1,250",
        your_margin_pct: 48.2,
        ...override,
      },
    ],
  });

  it("does NOT produce '15,5 EUR' from '13,500' (regression for the original bug)", () => {
    const ct = budgetToCommercialTermsV1(baseBudget());
    expect(ct).not.toBeNull();
    expect(ct!.setup_fee).toBe(13500);
    expect(ct!.setup_fee_display).toBe("13.500 EUR");
    expect(ct!.monthly_retainer).toBe(1250);
    expect(ct!.monthly_retainer_display).toBe("1.250 EUR");
  });

  it("maps a range like '15.000 - 18.000' into setup_fee/setup_fee_max/setup_fee_display", () => {
    const ct = budgetToCommercialTermsV1(
      baseBudget({ setup_price_eur: "15.000 - 18.000", monthly_price_eur: "750 - 850" }),
    );
    expect(ct!.setup_fee).toBe(15000);
    expect(ct!.setup_fee_max).toBe(18000);
    expect(ct!.setup_fee_display).toBe("15.000 - 18.000 EUR");
    expect(ct!.monthly_retainer).toBe(750);
    expect(ct!.monthly_retainer_max).toBe(850);
    expect(ct!.monthly_retainer_display).toBe("750 - 850 EUR");
  });

  it("scrubs 'margen de consultoría 40%' from pricing_notes → payment_terms", () => {
    const ct = budgetToCommercialTermsV1({
      ...baseBudget(),
      pricing_notes:
        "50% al inicio. 50% a entrega del MVP. El precio de setup incluye un margen de consultoría del 40%.",
    });
    expect(ct!.payment_terms).not.toMatch(/margen/i);
    expect(ct!.payment_terms).toMatch(/50%/);
  });

  it("returns null when no monetization_models", () => {
    expect(budgetToCommercialTermsV1({} as any)).toBeNull();
    expect(budgetToCommercialTermsV1(null)).toBeNull();
  });
});
