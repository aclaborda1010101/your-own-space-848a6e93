/**
 * Mapper puro: budgetData (legado, fuente de verdad del editor)
 *   → commercial_terms_v1 (contrato canónico para propuesta cliente / F7).
 *
 * No tiene side-effects. No persiste nada. No depende de Supabase.
 * Se usa al guardar el presupuesto para mantener un derivado actualizado
 * que pueda consumir el pipeline técnico sin tener que reescribir el editor.
 */

export interface BudgetMonetizationModel {
  name: string;
  description?: string;
  setup_price_eur?: string | number;
  monthly_price_eur?: string | number;
  price_range?: string;
  your_margin_pct?: number;
  pros?: string[];
  cons?: string[];
  best_for?: string;
  visible_to_client?: boolean;
}

export interface BudgetData {
  development?: {
    phases?: Array<{ name: string; description?: string; hours: number; cost_eur: number }>;
    total_hours?: number;
    hourly_rate_eur?: number;
    total_development_eur?: number;
    your_cost_eur?: number;
    margin_pct?: number;
  };
  recurring_monthly?: {
    items?: Array<{ name: string; cost_eur: number; notes?: string }>;
    hosting?: number;
    ai_apis?: number;
    maintenance_hours?: number;
    maintenance_eur?: number;
    total_monthly_eur?: number;
  };
  monetization_models?: BudgetMonetizationModel[];
  pricing_notes?: string;
  risk_factors?: string[];
  recommended_model?: string;
}

export interface CommercialTermsModel {
  id: string;
  name: string;
  selected: boolean;
  recommended: boolean;
  visible_to_client: boolean;
  setup_fee: number | null;
  monthly_fee: number | null;
  unit_price: number | null;
  revenue_share_pct: number | null;
  description: string;
  includes: string[];
  excludes: string[];
  pros: string[];
  cons: string[];
  internal: {
    margin_pct: number | null;
  };
}

export interface CommercialTermsV1 {
  // ── Flat fields consumed by F7 (Step 30) ──
  pricing_model: "fixed_project" | "setup_plus_monthly" | "subscription" | "phased" | "retainer" | "mixed";
  setup_fee?: number;
  monthly_retainer?: number;
  phase_prices?: Array<{ phase: string; price: number; description?: string }>;
  optional_addons?: Array<{ name: string; price?: number; description?: string }>;
  ai_usage_cost_policy: string;
  payment_terms: string;
  taxes?: string;
  currency: string;
  validity_days: number;

  // ── Internal audit / debugging only — never rendered to client ──
  selected_models: CommercialTermsModel[];
  recommended_model: string | null;
  development_total_eur: number | null;
  recurring_monthly_eur: number | null;
  notes: string;
  risk_factors: string[];
  source: "derived_from_budget_data";
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "model";
}

function parseEuro(v: string | number | undefined): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  // string: keep first integer found ("23000-30000" -> 23000)
  const m = String(v).match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

export function budgetToCommercialTermsV1(
  budget: BudgetData | null | undefined
): CommercialTermsV1 | null {
  if (!budget || !budget.monetization_models?.length) return null;

  const models = budget.monetization_models.map<CommercialTermsModel>((m) => {
    const recommended = budget.recommended_model === m.name;
    return {
      id: slugify(m.name),
      name: m.name,
      selected: true,
      recommended,
      // Si el usuario no marca explícitamente, el recomendado es visible.
      visible_to_client: m.visible_to_client ?? recommended,
      setup_fee: parseEuro(m.setup_price_eur),
      monthly_fee: parseEuro(m.monthly_price_eur),
      unit_price: parseEuro(m.price_range),
      revenue_share_pct: null,
      description: m.description || "",
      includes: [],
      excludes: [],
      pros: m.pros || [],
      cons: m.cons || [],
      internal: { margin_pct: m.your_margin_pct ?? null },
    };
  });

  // Pricing model heuristic: usa el recomendado si existe, si no el primero
  const primary = models.find((m) => m.recommended) || models[0];
  let pricing_model = "fixed_project";
  if (primary.setup_fee != null && primary.monthly_fee != null) pricing_model = "setup_plus_monthly";
  else if (primary.monthly_fee != null) pricing_model = "subscription";
  else if (primary.setup_fee != null) pricing_model = "fixed_project";

  return {
    pricing_model,
    selected_models: models,
    recommended_model: budget.recommended_model || null,
    development_total_eur: budget.development?.total_development_eur ?? null,
    recurring_monthly_eur: budget.recurring_monthly?.total_monthly_eur ?? null,
    ai_usage_cost_policy:
      "Costes de IA/API no incluidos por defecto, facturados según consumo real.",
    notes: budget.pricing_notes || "",
    risk_factors: budget.risk_factors || [],
    source: "derived_from_budget_data",
  };
}

/**
 * Validación para "Generar propuesta cliente".
 * Devuelve null si todo OK, o mensaje de error legible.
 */
export function validateBudgetForClientProposal(
  budget: BudgetData | null | undefined
): string | null {
  if (!budget) return "Genera el presupuesto antes de crear la propuesta cliente.";
  const models = budget.monetization_models || [];
  if (models.length === 0) return "Añade al menos un modelo de monetización.";

  const visibles = models.filter((m) => (m.visible_to_client ?? budget.recommended_model === m.name));
  if (visibles.length === 0) {
    return "Marca al menos un modelo como visible para el cliente.";
  }

  const withPrice = visibles.filter(
    (m) => m.setup_price_eur || m.monthly_price_eur || m.price_range
  );
  if (withPrice.length === 0) {
    return "El modelo visible no tiene precio (setup, mensual o rango).";
  }

  return null;
}
