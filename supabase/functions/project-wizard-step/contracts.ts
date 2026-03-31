/**
 * contracts.ts — Centralized Phase Contracts for the JARVIS Pipeline
 * Single source of truth for what each phase can/cannot produce and consume.
 * Used by: prompts (injection), validators (post-gen), sanitizer (export), frontend (render).
 * Created: 2026-03-14
 */

export interface PhaseContract {
  /** Human-readable phase name */
  name: string;
  /** Keys allowed at top level of JSON output (if applicable) */
  allowedTopLevelKeys?: string[];
  /** Keys that MUST NOT appear in output — triggers contract violation */
  forbiddenKeys: string[];
  /** Terms/phrases that MUST NOT appear in output text */
  forbiddenTerms: string[];
  /** Keys that MUST be present in output */
  requiredFields?: string[];
  /** Per-item metadata fields required (e.g. origin, confidence) */
  requiredItemMeta?: string[];
  /** Which previous steps this phase may consume */
  inputStepsAllowed: number[];
  /** For markdown outputs: sections that must be present */
  requiredSections?: string[];
  /** Enable technical density check (PRD only) */
  technicalDensityCheck?: boolean;
  /** Max % of opening that can be narrative/commercial */
  maxNarrativeOpeningPct?: number;
  /** MVP scope limits */
  mvpScopeLimit?: { maxModules: number; maxExternalDeps: number };
  /** Schema version for tracking */
  outputSchemaVersion: string;
}

export const PHASE_CONTRACTS: Record<number, PhaseContract> = {
  // ── Step 2: Extracción Inteligente (v3 — typed brief) ──
  2: {
    name: "Extracción Inteligente",
    allowedTopLevelKeys: [
      "project_summary", "observed_facts", "inferred_needs",
      "solution_candidates", "constraints_and_risks", "open_questions",
      "architecture_signals", "extraction_warnings", "deep_patterns",
      "parallel_projects", "_was_filtered", "_filtered_content",
      "_contract_validation", "_brief_validation",
    ],
    forbiddenKeys: [
      "development_phases", "development", "phases", "monetization_models",
      "cost_eur", "total_development_eur", "hours", "hourly_rate",
      "hourly_rate_eur", "sql_schema", "edge_functions", "prd",
      "mvp_spec", "pricing", "setup_price_eur", "monthly_price_eur",
      "budget", "monetization",
      // Anti-premature-architecture keys
      "rag_projects", "specialists", "engines", "formal_components",
      "modules", "microservices", "services",
    ],
    forbiddenTerms: [
      "CREATE TABLE", "Edge Function", "monetización", "precio de venta",
      "presupuesto detallado", "margen del consultor",
      // Anti-premature-architecture terms
      "componente final", "arquitectura definitiva", "módulo definitivo",
      "RAG final", "especialista final", "motor final",
    ],
    requiredFields: [
      "project_summary", "observed_facts", "inferred_needs",
      "solution_candidates", "constraints_and_risks", "open_questions",
      "architecture_signals",
    ],
    requiredItemMeta: [
      "id", "title", "description", "source_kind", "abstraction_level",
      "certainty", "status", "evidence_snippets", "likely_layer",
      "candidate_component_type",
      "layer_candidate", "module_type_candidate", "phase_candidate",
    ],
    inputStepsAllowed: [1],
    outputSchemaVersion: "v3.1",
  },

  // ── Step 3: Documento de Alcance ──
  3: {
    name: "Documento de Alcance",
    forbiddenKeys: [
      "sql_schema", "create_table", "edge_functions",
      "monetization_models", "hourly_rate", "hourly_rate_eur",
    ],
    forbiddenTerms: [
      "CREATE TABLE", "RLS", "Edge Function", "token cost",
      "tokens_input", "tokens_output", "cost_usd",
    ],
    inputStepsAllowed: [2],
    outputSchemaVersion: "v2.0",
  },

  // ── Step 4: Auditoría IA ──
  4: {
    name: "Auditoría IA",
    allowedTopLevelKeys: [
      "resumen", "oportunidades", "quick_wins", "requiere_datos_previos",
      "stack_ia_recomendado", "coste_ia_total_mensual_estimado",
      "nota_implementación", "services_decision",
    ],
    forbiddenKeys: [
      "development", "phases", "development_phases",
      "monetization_models", "pricing_notes", "pricing",
      "total_development_eur", "hourly_rate_eur", "hourly_rate",
      "setup_price_eur", "monthly_price_eur", "budget",
      "monetization", "plan_implementacion", "cronograma",
    ],
    forbiddenTerms: [
      "Fase 0", "Fase 1", "Fase 2", "Fase 3",
      "Plan de Implementación", "cronograma de desarrollo",
      "presupuesto detallado", "margen", "monetización",
      "precio de venta", "hourly rate",
    ],
    inputStepsAllowed: [2, 3],
    outputSchemaVersion: "v2.0",
  },

  // ── Step 5: PRD Técnico (Triple Capa) ──
  5: {
    name: "PRD Técnico",
    allowedTopLevelKeys: [
      "document", "blueprint", "checklist", "specs", "validation",
      "_contract_validation",
      "interpretation_contract", "lovable_build_prd", "expert_forge_spec",
    ],
    forbiddenKeys: [
      "monetization_models", "pricing", "setup_price_eur",
      "monthly_price_eur", "hourly_rate", "hourly_rate_eur",
      "budget", "monetization",
    ],
    forbiddenTerms: [
      "precio de venta", "monetización", "setup_price",
      "monthly_price", "margen del consultor", "presupuesto detallado",
    ],
    requiredSections: [
      "entidades", "workflows", "SQL", "API", "seguridad", "RLS",
      "Edge Function", "observabilidad",
      "CONTRATO DE INTERPRETACIÓN", "nomenclatura canónica",
      "clasificación de componentes", "LOVABLE BUILD ADAPTER",
      "EXPERT FORGE ADAPTER", "Inventario IA",
      "Orquestadores", "Módulos de Aprendizaje",
      "Mapa de Interconexiones", "Resumen de Infraestructura",
      "Capa A", "Capa B", "Capa C", "Capa D", "Capa E",
      "Compliance IA",
    ],
    technicalDensityCheck: true,
    maxNarrativeOpeningPct: 15,
    inputStepsAllowed: [2, 3, 4],
    outputSchemaVersion: "v3.0",
  },

  // ── Step 10: Alcance Interno (chained) ──
  10: {
    name: "Alcance Interno",
    forbiddenKeys: [
      "sql_schema", "create_table", "edge_functions",
      "monetization_models", "hourly_rate", "hourly_rate_eur",
    ],
    forbiddenTerms: [
      "AGENTE_IA", "MOTOR_DETERMINISTA", "MODULO_APRENDIZAJE",
      "CREATE TABLE", "RLS", "Edge Function",
      "monetización", "precio de venta",
    ],
    inputStepsAllowed: [2],
    outputSchemaVersion: "v2.0",
  },

  // ── Step 11: Auditoría IA / Descripción MVP ──
  11: {
    name: "Auditoría IA",
    forbiddenKeys: [
      "development_phases", "monetization_models", "cost_eur",
      "hourly_rate", "hourly_rate_eur", "pricing", "budget",
      "monetization", "total_development_eur",
    ],
    forbiddenTerms: [
      "AGENTE_IA", "MOTOR_DETERMINISTA", "MODULO_APRENDIZAJE",
      "presupuesto detallado", "margen", "monetización",
      "precio de venta", "hourly rate",
    ],
    requiredSections: [],
    requiredFields: [
      "resumen", "componentes_auditados", "validaciones", "stack_ia", "automation_roadmap",
    ],
    mvpScopeLimit: { maxModules: 5, maxExternalDeps: 3 },
    inputStepsAllowed: [2, 3, 10],
    outputSchemaVersion: "v2.0",
  },

  // ── Step 21: Compliance IA & Soberanía de Datos ──
  21: {
    name: "Compliance IA",
    allowedTopLevelKeys: [
      "risk_classification", "isolation_requirements", "infrastructure_sizing",
      "human_oversight", "data_residency_map", "scale_path",
    ],
    forbiddenKeys: [
      "pricing", "monetization", "setup_price_eur", "monthly_price_eur",
      "hourly_rate", "budget",
    ],
    forbiddenTerms: [
      "precio de venta", "presupuesto detallado", "margen del consultor",
      "monetización",
    ],
    requiredFields: [
      "risk_classification", "isolation_requirements",
    ],
    inputStepsAllowed: [2, 5, 10, 11],
    outputSchemaVersion: "v1.0",
  },
};

/**
 * Build a prompt injection block from a contract's forbidden rules.
 * Append this to the system or user prompt to enforce boundaries.
 */
export function buildContractPromptBlock(stepNumber: number): string {
  const contract = PHASE_CONTRACTS[stepNumber];
  if (!contract) return "";

  const lines: string[] = [
    `\nCONTRATO DE FASE — ${contract.name} (v${contract.outputSchemaVersion}):`,
  ];

  if (contract.forbiddenKeys.length > 0) {
    lines.push(`CLAVES PROHIBIDAS en el output (NO incluir bajo ningún concepto): ${contract.forbiddenKeys.join(", ")}`);
  }
  if (contract.forbiddenTerms.length > 0) {
    lines.push(`TÉRMINOS PROHIBIDOS en el texto de salida: ${contract.forbiddenTerms.map(t => `"${t}"`).join(", ")}`);
  }
  if (contract.requiredSections && contract.requiredSections.length > 0) {
    lines.push(`SECCIONES OBLIGATORIAS que deben aparecer: ${contract.requiredSections.join(", ")}`);
  }

  return lines.join("\n");
}

/**
 * Gate inputs: filter available step data to only what this phase is allowed to consume.
 * Returns filtered map + metadata about what was gated.
 */
export interface GatedInputs {
  /** Filtered data keyed by step number */
  data: Record<number, any>;
  /** Metadata for audit trail */
  meta: {
    generated_from_steps: number[];
    approved_inputs_only: boolean;
    contract_version: string;
    gated_out_steps: number[];
  };
}

export function gateInputs(
  stepNumber: number,
  availableStepData: Record<number, any>
): GatedInputs {
  const contract = PHASE_CONTRACTS[stepNumber];
  if (!contract) {
    // No contract = pass everything through (legacy steps)
    return {
      data: availableStepData,
      meta: {
        generated_from_steps: Object.keys(availableStepData).map(Number),
        approved_inputs_only: false,
        contract_version: "legacy",
        gated_out_steps: [],
      },
    };
  }

  const allowed = new Set(contract.inputStepsAllowed);
  const filtered: Record<number, any> = {};
  const gatedOut: number[] = [];
  const usedSteps: number[] = [];

  for (const [stepStr, data] of Object.entries(availableStepData)) {
    const step = Number(stepStr);
    if (allowed.has(step)) {
      filtered[step] = data;
      usedSteps.push(step);
    } else {
      gatedOut.push(step);
    }
  }

  return {
    data: filtered,
    meta: {
      generated_from_steps: usedSteps,
      approved_inputs_only: true,
      contract_version: contract.outputSchemaVersion,
      gated_out_steps: gatedOut,
    },
  };
}
