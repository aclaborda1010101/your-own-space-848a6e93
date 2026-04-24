/**
 * f1-legacy-shape.ts — Helpers post-parse para el briefing F1 (Pipeline v2).
 *
 * Responsabilidades:
 *  1. ensureLegacyBriefShape(): garantiza que el briefing tenga TODOS los
 *     campos legacy esperados por la UI actual de "Briefing Extraído"
 *     aunque F1 produzca solo (o mayoritariamente) `business_extraction_v2`.
 *  2. stripRegistryLeaks(): GUARD anti-ComponentRegistryItem. F1 NO puede
 *     crear componentes — eso pertenece a F2/F3 en pasos posteriores.
 *
 * No importa runtime de `_shared/component-registry-contract.ts` para no
 * acoplar este módulo al registry.
 */

// ── Tipos auxiliares (locales, no exportados al registry) ────────────

type AnyObj = Record<string, any>;

const REGISTRY_FORBIDDEN_TOP_KEYS = ["component_registry", "components", "ComponentRegistryItem"];
const COMP_ID_REGEX = /\bCOMP-\d{2,}\b/i;

// ── stripRegistryLeaks ───────────────────────────────────────────────

export interface RegistryLeakResult {
  cleaned: AnyObj;
  leakDetected: boolean;
  leakDetails: string[];
}

/**
 * Inspecciona top-level y dentro de business_extraction_v2 buscando datos
 * de registry/componentes. Si encuentra:
 *  - elimina las claves prohibidas
 *  - registra un detalle textual para extraction_warnings
 *
 * No recorre el objeto en profundidad para mantener la operación barata.
 */
export function stripRegistryLeaks(briefing: AnyObj | null | undefined): RegistryLeakResult {
  if (!briefing || typeof briefing !== "object") {
    return { cleaned: briefing ?? {}, leakDetected: false, leakDetails: [] };
  }

  const cleaned: AnyObj = { ...briefing };
  const details: string[] = [];

  // 1. Top-level forbidden keys
  for (const key of REGISTRY_FORBIDDEN_TOP_KEYS) {
    if (key in cleaned) {
      details.push(`top-level key removed: "${key}"`);
      delete cleaned[key];
    }
  }

  // 2. business_extraction_v2 forbidden keys
  if (cleaned.business_extraction_v2 && typeof cleaned.business_extraction_v2 === "object") {
    const v2 = { ...cleaned.business_extraction_v2 };
    for (const key of REGISTRY_FORBIDDEN_TOP_KEYS) {
      if (key in v2) {
        details.push(`business_extraction_v2.${key} removed`);
        delete v2[key];
      }
    }
    cleaned.business_extraction_v2 = v2;
  }

  // 3. COMP-XXX IDs en strings top-level y campos `id` de items v2
  const checkIdField = (container: AnyObj, path: string) => {
    if (!container || typeof container !== "object") return;
    for (const [k, v] of Object.entries(container)) {
      if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) {
          const item = v[i];
          if (item && typeof item === "object") {
            const idVal = (item as AnyObj).id;
            if (typeof idVal === "string" && COMP_ID_REGEX.test(idVal)) {
              details.push(`COMP- id detected at ${path}.${k}[${i}].id="${idVal}" (left in place, flagged)`);
            }
          }
        }
      }
    }
  };
  checkIdField(cleaned, "$");
  if (cleaned.business_extraction_v2) {
    checkIdField(cleaned.business_extraction_v2, "business_extraction_v2");
  }

  return {
    cleaned,
    leakDetected: details.length > 0,
    leakDetails: details,
  };
}

// ── ensureLegacyBriefShape ───────────────────────────────────────────

const LEGACY_ARRAY_FIELDS = [
  "observed_facts",
  "inferred_needs",
  "solution_candidates",
  "constraints_and_risks",
  "open_questions",
  "architecture_signals",
  "deep_patterns",
  "extraction_warnings",
  "parallel_projects",
] as const;

function asArray(v: unknown): any[] {
  return Array.isArray(v) ? v : [];
}

function ensureItemMeta(item: AnyObj, idPrefix: string, idx: number, defaults: Partial<AnyObj>): AnyObj {
  const out: AnyObj = { ...item };
  out.id = typeof out.id === "string" && out.id.length > 0 ? out.id : `${idPrefix}-${String(idx + 1).padStart(3, "0")}`;
  out.title = typeof out.title === "string" ? out.title : (typeof out.text === "string" ? out.text.substring(0, 80) : "");
  out.description = typeof out.description === "string" ? out.description : (typeof out.text === "string" ? out.text : "");
  out.source_kind = typeof out.source_kind === "string" ? out.source_kind : (defaults.source_kind ?? "derived_inference");
  out.abstraction_level = typeof out.abstraction_level === "string" ? out.abstraction_level : (defaults.abstraction_level ?? "inferred");
  out.certainty = typeof out.certainty === "string" ? out.certainty : (defaults.certainty ?? "medium");
  out.status = typeof out.status === "string" ? out.status : (defaults.status ?? "inferred");
  out.evidence_snippets = Array.isArray(out.evidence_snippets) ? out.evidence_snippets : [];
  out.inferred_from = Array.isArray(out.inferred_from) ? out.inferred_from : [];
  out.likely_layer = typeof out.likely_layer === "string" ? out.likely_layer : "business";
  out.candidate_component_type = typeof out.candidate_component_type === "string" ? out.candidate_component_type : "none";
  out.blocked_by = Array.isArray(out.blocked_by) ? out.blocked_by : [];
  out.downstream_impact = Array.isArray(out.downstream_impact) ? out.downstream_impact : [];
  return out;
}

/**
 * Garantiza que el briefing tenga la forma legacy esperada por la UI.
 * Operaciones:
 *  - asegura que existan todos los arrays legacy (vacíos si faltan)
 *  - deriva campos legacy desde business_extraction_v2 si hace falta
 *  - asegura un project_summary mínimo
 */
export function ensureLegacyBriefShape(briefing: AnyObj | null | undefined): AnyObj {
  if (!briefing || typeof briefing !== "object") return briefing ?? {};

  const out: AnyObj = { ...briefing };
  const v2: AnyObj | undefined = out.business_extraction_v2 && typeof out.business_extraction_v2 === "object"
    ? out.business_extraction_v2
    : undefined;

  // 1. project_summary
  if (!out.project_summary || typeof out.project_summary !== "object") {
    if (v2?.business_model_summary) {
      const sum = v2.business_model_summary;
      out.project_summary = {
        title: typeof sum?.title === "string" ? sum.title : (typeof v2?.project_title === "string" ? v2.project_title : ""),
        context: typeof sum === "string" ? sum : (sum?.context ?? sum?.summary ?? ""),
        primary_goal: sum?.primary_goal ?? "",
        complexity_level: sum?.complexity_level ?? "medium",
        urgency_level: sum?.urgency_level ?? "medium",
      };
    } else {
      out.project_summary = { title: "", context: "", primary_goal: "", complexity_level: "medium", urgency_level: "medium" };
    }
  }

  // 2. Arrays legacy: asegurar presencia
  for (const field of LEGACY_ARRAY_FIELDS) {
    if (!Array.isArray(out[field])) out[field] = [];
  }

  // 3. Derivaciones desde v2 si los arrays legacy están vacíos
  if (v2) {
    if (out.observed_facts.length === 0 && Array.isArray(v2.observed_facts)) {
      out.observed_facts = v2.observed_facts.map((it: AnyObj, i: number) =>
        ensureItemMeta(it, "OF", i, { source_kind: "transcript", abstraction_level: "observed", certainty: "high", status: "confirmed" }),
      );
    }
    if (out.architecture_signals.length === 0 && Array.isArray(v2.architecture_signals)) {
      out.architecture_signals = v2.architecture_signals.map((it: AnyObj, i: number) =>
        ensureItemMeta(it, "AS", i, { source_kind: "derived_inference", abstraction_level: "proposed", certainty: "medium", status: "proposed" }),
      );
    }
    if (out.solution_candidates.length === 0) {
      const fromRequested = Array.isArray(v2.client_requested_items) ? v2.client_requested_items : [];
      const fromOpps = Array.isArray(v2.ai_native_opportunity_signals) ? v2.ai_native_opportunity_signals : [];
      const merged = [...fromRequested, ...fromOpps];
      if (merged.length > 0) {
        out.solution_candidates = merged.map((it: AnyObj, i: number) =>
          ensureItemMeta(it, "SC", i, { source_kind: "derived_inference", abstraction_level: "proposed", certainty: "medium", status: "proposed" }),
        );
      }
    }
    if (out.inferred_needs.length === 0 && Array.isArray(v2.inferred_needs)) {
      out.inferred_needs = v2.inferred_needs.map((it: AnyObj, i: number) =>
        ensureItemMeta(it, "IN", i, { source_kind: "derived_inference", abstraction_level: "inferred", certainty: "medium", status: "inferred" }),
      );
    }
    if (out.constraints_and_risks.length === 0 && Array.isArray(v2.constraints_and_risks)) {
      out.constraints_and_risks = v2.constraints_and_risks.map((it: AnyObj, i: number) =>
        ensureItemMeta(it, "CR", i, { source_kind: "transcript", abstraction_level: "observed", certainty: "high", status: "confirmed" }),
      );
    }
    if (out.open_questions.length === 0 && Array.isArray(v2.open_questions)) {
      out.open_questions = v2.open_questions.map((it: AnyObj, i: number) =>
        ensureItemMeta(it, "OQ", i, { source_kind: "derived_inference", abstraction_level: "inferred", certainty: "low", status: "unknown" }),
      );
    }
  }

  return out;
}

/** Adjunta un warning normalizado a `extraction_warnings` sin duplicar. */
export function appendExtractionWarning(briefing: AnyObj, warning: AnyObj): void {
  if (!Array.isArray(briefing.extraction_warnings)) briefing.extraction_warnings = [];
  briefing.extraction_warnings.push(warning);
}
