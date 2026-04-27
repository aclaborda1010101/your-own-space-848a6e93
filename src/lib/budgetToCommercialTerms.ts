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

export interface BudgetImplementationOverride {
  /** Semanas para la fase MVP (sobrescribe heurística). */
  mvp_weeks?: number;
  /** Semanas para fast-follow (sobrescribe heurística). */
  fast_follow_weeks?: number;
  /** Fecha ISO YYYY-MM-DD de arranque (opcional). */
  start_date?: string;
  /** Notas libres que se anexan al cronograma del cliente. */
  notes?: string;
}

/**
 * F7.2 — Consultoría / Asesoría IA recurrente mensual.
 * Si `enabled`, aplica un descuento (default 50%) sobre el setup_fee
 * del modelo recomendado. Solo formato mensual con horas incluidas.
 */
export interface BudgetConsultingRetainer {
  enabled?: boolean;
  /** Cuota mensual EUR que pagará el cliente por la consultoría. */
  monthly_fee_eur?: number;
  /** Horas mensuales de consultoría/mentoría incluidas en la cuota. */
  monthly_hours?: number;
  /** % de descuento aplicado al desarrollo cuando enabled = true. Default 50. */
  discount_pct?: number;
  /** Notas / alcance libre (qué incluye la asesoría). */
  notes?: string;
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
  /** F7.1 — Override del cronograma de implementación que se propaga al PDF cliente. */
  implementation_override?: BudgetImplementationOverride;
  /** F7.2 — Consultoría/asesoría IA recurrente. Aplica descuento al desarrollo. */
  consulting_retainer?: BudgetConsultingRetainer;
}

export interface CommercialTermsModel {
  id: string;
  name: string;
  selected: boolean;
  recommended: boolean;
  visible_to_client: boolean;
  setup_fee: number | null;
  setup_fee_max: number | null;
  setup_fee_display: string | null;
  monthly_fee: number | null;
  monthly_fee_max: number | null;
  monthly_fee_display: string | null;
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
  setup_fee_max?: number;
  setup_fee_display?: string;
  monthly_retainer?: number;
  monthly_retainer_max?: number;
  monthly_retainer_display?: string;
  phase_prices?: Array<{ phase: string; price: number; description?: string }>;
  optional_addons?: Array<{ name: string; price?: number; description?: string }>;
  ai_usage_cost_policy: string;
  payment_terms: string;
  taxes?: string;
  currency: string;
  validity_days: number;
  /** F7.1 — Override del cronograma propagado a la propuesta cliente. */
  implementation_override?: BudgetImplementationOverride;
  /** F7.2 — Consultoría/asesoría IA recurrente que aplica descuento al desarrollo. */
  consulting_retainer?: {
    enabled: boolean;
    monthly_fee_eur: number;
    monthly_hours: number;
    discount_pct: number;
    notes?: string;
    /** Importe de desarrollo ANTES del descuento (referencia). */
    setup_fee_before_discount?: number;
    setup_fee_max_before_discount?: number;
  };

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

/**
 * Parser robusto de importes europeos y rangos.
 *
 * Soporta:
 *   - "13.500"           → { min: 13500, display: "13.500 EUR" }
 *   - "13,500"           → { min: 13500, display: "13.500 EUR" }   (separador miles ES)
 *   - "15.000 - 18.000"  → { min: 15000, max: 18000, display: "15.000 - 18.000 EUR" }
 *   - "€750 - 850"       → { min: 750, max: 850, display: "750 - 850 EUR" }
 *   - "1,250"            → { min: 1250, display: "1.250 EUR" }
 *   - "13,5"             → { min: 13.5, display: "13,5 EUR" }      (decimal real, raro)
 *   - "Estimado 8.500 - 12.000 (facturado por horas)" → rango 8500-12000
 *   - número 15000       → { min: 15000, display: "15.000 EUR" }
 *
 * Heurística clave para resolver la ambigüedad coma/punto:
 *   Si tras la coma o punto hay 3 dígitos y luego no-dígito (o fin) → separador de miles.
 *   Si hay 1 o 2 dígitos tras el separador y solo hay UN separador → decimal.
 */
export function parseEuroAmountOrRange(
  value: string | number | undefined | null,
): { min?: number; max?: number; display: string } | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return { min: value, display: `${formatEuroNumber(value)} EUR` };
  }

  const raw = String(value).trim();
  if (!raw) return null;

  // Quitar símbolos de moneda al principio. Mantenemos el resto del texto
  // para detectar rangos aunque vengan con prefijo (e.g. "Estimado 8.500 - 12.000").
  const cleaned = raw.replace(/€|EUR|euros?/gi, " ").replace(/\s+/g, " ").trim();

  // Token de número europeo: dígitos con posibles separadores . o , y un decimal.
  // Aceptamos guion bajo opcional para tokens raros.
  const NUMBER_TOKEN = /\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?/g;

  const tokens = cleaned.match(NUMBER_TOKEN) ?? [];
  if (tokens.length === 0) return null;

  const numbers = tokens
    .map(parseEuroToken)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));

  if (numbers.length === 0) return null;

  // Detectar rango: dos números separados por "-", "–", "—" o " a " o " to ".
  if (numbers.length >= 2) {
    const tok0 = tokens[0];
    const tok1 = tokens[1];
    if (tok0 && tok1) {
      const idx1 = cleaned.indexOf(tok0);
      const idx2 = cleaned.indexOf(tok1, idx1 + tok0.length);
      const between = idx2 >= 0 ? cleaned.slice(idx1 + tok0.length, idx2) : "";
      if (/[-–—]|(?:\s(?:a|to|hasta)\s)/i.test(between)) {
        const a = numbers[0]!;
        const b = numbers[1]!;
        const min = Math.min(a, b);
        const max = Math.max(a, b);
        return {
          min,
          max,
          display: `${formatEuroNumber(min)} - ${formatEuroNumber(max)} EUR`,
        };
      }
    }
  }

  // Si no hay rango, devolvemos el primer número.
  const single = numbers[0];
  return { min: single, display: `${formatEuroNumber(single)} EUR` };
}

/**
 * Convierte un token "13.500", "13,500", "1,250.50", "13,5" en number.
 * Heurística europea: ',' suele ser miles si hay 3 dígitos exactos detrás
 * y no es el único separador con otra interpretación.
 */
function parseEuroToken(tok: string): number | null {
  if (!tok) return null;
  const hasDot = tok.includes(".");
  const hasComma = tok.includes(",");

  // Caso 1: solo dígitos.
  if (!hasDot && !hasComma) {
    const n = Number(tok);
    return Number.isFinite(n) ? n : null;
  }

  // Caso 2: ambos separadores → el último es el decimal, el otro es miles.
  if (hasDot && hasComma) {
    const lastDot = tok.lastIndexOf(".");
    const lastComma = tok.lastIndexOf(",");
    const decimalChar = lastDot > lastComma ? "." : ",";
    const thousandsChar = decimalChar === "." ? "," : ".";
    const normalized = tok.split(thousandsChar).join("").replace(decimalChar, ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  // Caso 3: solo un tipo de separador.
  const sep = hasDot ? "." : ",";
  const parts = tok.split(sep);

  // Si hay >2 partes (e.g. "1.234.567"), claramente miles.
  if (parts.length > 2) {
    const n = Number(parts.join(""));
    return Number.isFinite(n) ? n : null;
  }

  // Solo dos partes: la última define interpretación.
  const last = parts[1];
  if (last.length === 3) {
    // "13.500" o "13,500" → miles.
    const n = Number(parts.join(""));
    return Number.isFinite(n) ? n : null;
  }
  if (last.length === 1 || last.length === 2) {
    // "13,5" o "13.50" → decimal real.
    const n = Number(`${parts[0]}.${last}`);
    return Number.isFinite(n) ? n : null;
  }
  // Otros (4+ dígitos tras el separador) — improbable; tratamos como decimal.
  const n = Number(`${parts[0]}.${last}`);
  return Number.isFinite(n) ? n : null;
}

function formatEuroNumber(n: number): string {
  // Punto como separador de miles, sin decimales si es entero.
  return n.toLocaleString("es-ES", {
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
    useGrouping: true,
  });
}

// Compatibilidad con código existente que llamaba a parseEuro.
function parseEuro(v: string | number | undefined): number | null {
  const parsed = parseEuroAmountOrRange(v);
  return parsed?.min ?? null;
}

/**
 * Limpia notas/payment_terms para evitar que se filtre lenguaje interno
 * (margen, coste interno, tarifa por hora, horas estimadas) al cliente.
 */
function scrubInternalLeak(text: string | undefined | null): string {
  if (!text) return "";
  // Quitamos frases que mencionen margen / coste interno / tarifa / horas internas.
  // Trabajamos sentence-by-sentence para no romper el resto del texto.
  const sentences = text.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((s) => {
    const lower = s.toLowerCase();
    return !(
      /\bmargen\b/.test(lower) ||
      /margin/.test(lower) ||
      /coste\s+interno/.test(lower) ||
      /tarifa\s+(?:por\s+hora|interna|hora)/.test(lower) ||
      /hourly\s*rate/.test(lower) ||
      /horas?\s+(?:estimadas|internas|de\s+consultor)/.test(lower) ||
      /rentabilidad/.test(lower)
    );
  });
  return kept.join(" ").trim();
}

export function budgetToCommercialTermsV1(
  budget: BudgetData | null | undefined,
): CommercialTermsV1 | null {
  if (!budget || !budget.monetization_models?.length) return null;

  const models = budget.monetization_models.map<CommercialTermsModel>((m) => {
    const recommended = budget.recommended_model === m.name;
    const setupParsed = parseEuroAmountOrRange(m.setup_price_eur);
    const monthlyParsed = parseEuroAmountOrRange(m.monthly_price_eur);
    const unitParsed = parseEuroAmountOrRange(m.price_range);
    return {
      id: slugify(m.name),
      name: m.name,
      selected: true,
      recommended,
      // Si el usuario no marca explícitamente, el recomendado es visible.
      visible_to_client: m.visible_to_client ?? recommended,
      setup_fee: setupParsed?.min ?? null,
      setup_fee_max: setupParsed?.max ?? null,
      setup_fee_display: setupParsed?.display ?? null,
      monthly_fee: monthlyParsed?.min ?? null,
      monthly_fee_max: monthlyParsed?.max ?? null,
      monthly_fee_display: monthlyParsed?.display ?? null,
      unit_price: unitParsed?.min ?? null,
      revenue_share_pct: null,
      description: m.description || "",
      includes: [],
      excludes: [],
      pros: m.pros || [],
      cons: m.cons || [],
      internal: { margin_pct: m.your_margin_pct ?? null },
    };
  });

  // Pricing model heuristic basado en el modelo recomendado/principal
  const recommended = models.find((m) => m.recommended) || null;
  const primary = recommended || models[0];
  const visibleModels = models.filter((m) => m.visible_to_client);

  let pricing_model: CommercialTermsV1["pricing_model"] = "fixed_project";
  if (primary.setup_fee != null && primary.monthly_fee != null) pricing_model = "setup_plus_monthly";
  else if (primary.monthly_fee != null) pricing_model = "subscription";
  else if (primary.setup_fee != null) pricing_model = "fixed_project";

  // Aplanar el modelo principal a los campos que F7 lee directamente.
  const setup_fee = primary.setup_fee ?? undefined;
  const setup_fee_max = primary.setup_fee_max ?? undefined;
  const setup_fee_display = primary.setup_fee_display ?? undefined;
  const monthly_retainer = primary.monthly_fee ?? undefined;
  const monthly_retainer_max = primary.monthly_fee_max ?? undefined;
  const monthly_retainer_display = primary.monthly_fee_display ?? undefined;

  // Otros modelos visibles → opcionales (no incluidos en el precio base).
  const optional_addons = visibleModels
    .filter((m) => m.id !== primary.id)
    .map((m) => ({
      name: m.name,
      price: m.setup_fee ?? m.monthly_fee ?? m.unit_price ?? undefined,
      description: m.description || undefined,
    }));

  // Sanear notas y payment_terms para que no se filtre lenguaje interno.
  const cleanedPricingNotes = scrubInternalLeak(budget.pricing_notes);
  const payment_terms = cleanedPricingNotes ||
    "50% al inicio del proyecto y 50% contra entrega del MVP. Mensualidades, en su caso, facturadas a mes vencido.";

  return {
    // Flat fields consumed by F7
    pricing_model,
    setup_fee,
    setup_fee_max,
    setup_fee_display,
    monthly_retainer,
    monthly_retainer_max,
    monthly_retainer_display,
    phase_prices: undefined,
    optional_addons: optional_addons.length > 0 ? optional_addons : undefined,
    ai_usage_cost_policy:
      "Costes de IA/API no incluidos por defecto, facturados según consumo real.",
    payment_terms,
    taxes: "IVA no incluido. Se aplicará el tipo vigente.",
    currency: "EUR",
    validity_days: 30,
    implementation_override: budget.implementation_override
      ? {
          mvp_weeks:
            typeof budget.implementation_override.mvp_weeks === "number" &&
            budget.implementation_override.mvp_weeks > 0
              ? budget.implementation_override.mvp_weeks
              : undefined,
          fast_follow_weeks:
            typeof budget.implementation_override.fast_follow_weeks === "number" &&
            budget.implementation_override.fast_follow_weeks >= 0
              ? budget.implementation_override.fast_follow_weeks
              : undefined,
          start_date: budget.implementation_override.start_date?.trim() || undefined,
          notes: budget.implementation_override.notes?.trim() || undefined,
        }
      : undefined,

    // Internal audit
    selected_models: models,
    recommended_model: budget.recommended_model || null,
    development_total_eur: budget.development?.total_development_eur ?? null,
    recurring_monthly_eur: budget.recurring_monthly?.total_monthly_eur ?? null,
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
  budget: BudgetData | null | undefined,
): string | null {
  if (!budget) return "Genera el presupuesto antes de crear la propuesta cliente.";
  const models = budget.monetization_models || [];
  if (models.length === 0) return "Añade al menos un modelo de monetización.";

  const visibles = models.filter((m) => (m.visible_to_client ?? budget.recommended_model === m.name));
  if (visibles.length === 0) {
    return "Marca al menos un modelo como visible para el cliente.";
  }

  // Debe haber al menos un modelo visible con un importe NUMÉRICO real
  // (no string vacío, no rango sin número).
  const withNumericPrice = visibles.filter((m) => {
    const setup = parseEuro(m.setup_price_eur);
    const monthly = parseEuro(m.monthly_price_eur);
    return (typeof setup === "number" && setup > 0) ||
      (typeof monthly === "number" && monthly > 0);
  });
  if (withNumericPrice.length === 0) {
    return "El modelo visible para el cliente debe tener un importe numérico (cuota inicial o mensualidad). Sin importes reales no se puede generar la propuesta.";
  }

  return null;
}
