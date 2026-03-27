/**
 * manifest-schema.ts — Architecture Manifest Schema & Deterministic Validator
 * Source of truth for the 5-layer business architecture (A-E).
 * Created: 2026-03-24
 */

// ── Enums & Literals ──────────────────────────────────────────────────────

export const MODULE_TYPES = [
  "knowledge_module",
  "action_module",
  "pattern_module",
  "executive_cognition_module",
  "improvement_module",
  "deterministic_engine",
  "router_orchestrator",
] as const;
export type ModuleType = typeof MODULE_TYPES[number];

export const LAYERS = ["A", "B", "C", "D", "E"] as const;
export type Layer = typeof LAYERS[number];

export const SENSITIVITY_ZONES = ["low", "business", "financial", "legal", "compliance", "people_ops", "executive"] as const;
export type SensitivityZone = typeof SENSITIVITY_ZONES[number];

export const AUTOMATION_LEVELS = ["advisory", "semi_automatic", "automatic"] as const;
export type AutomationLevel = typeof AUTOMATION_LEVELS[number];

export const MATERIALIZATION_TARGETS = [
  "expertforge_rag", "expertforge_specialist", "expertforge_deterministic_engine",
  "expertforge_soul", "expertforge_moe", "runtime_only", "roadmap_only", "manual_design",
] as const;
export type MaterializationTarget = typeof MATERIALIZATION_TARGETS[number];

export const EXECUTION_MODES = ["deterministic", "llm_augmented", "hybrid"] as const;
export type ExecutionMode = typeof EXECUTION_MODES[number];

export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export type RiskLevel = typeof RISK_LEVELS[number];

export const INTERACTION_TYPES = [
  "reads_from", "writes_to", "triggers", "evaluates", "explains", "modulates", "none",
] as const;
export type InteractionType = typeof INTERACTION_TYPES[number];

export const SOUL_SCOPES = ["tone_only", "advisory", "strategic_assist", "decision_style"] as const;
export type SoulScope = typeof SOUL_SCOPES[number];

export const SOUL_AUTHORITY_LEVELS = ["low", "medium", "high"] as const;
export type SoulAuthorityLevel = typeof SOUL_AUTHORITY_LEVELS[number];

export const SOUL_SUBJECT_TYPES = ["ceo", "founder", "manager", "worker", "mixed"] as const;
export type SoulSubjectType = typeof SOUL_SUBJECT_TYPES[number];

// ── Layer ↔ ModuleType valid mappings ─────────────────────────────────────

const VALID_LAYER_MODULE_MAP: Record<Layer, ModuleType[]> = {
  A: ["knowledge_module"],
  B: ["action_module", "router_orchestrator"],
  C: ["pattern_module", "deterministic_engine"],
  D: ["executive_cognition_module"],
  E: ["improvement_module"],
};

// ── Interfaces ────────────────────────────────────────────────────────────

export interface CompilationMetadata {
  compiler_version: string;
  compiled_at: string;
  repair_applied: boolean;
  repair_reason: string | null;
  source_prd_version: number;
  compilation_model: string;
}

export interface ProjectSummary {
  name: string;
  domain: string;
  problem: string;
  solution: string;
}

export interface LayerConfig {
  active: boolean;
  modules: string[]; // module_id references
}

export interface ExecutiveCognitionLayer {
  active: boolean;
  enabled: boolean;
  subject_type: SoulSubjectType;
  scope: SoulScope;
  authority_level: SoulAuthorityLevel;
  source_types: string[];
  influences_modules: string[];
  excluded_from_modules: string[];
  governance_rules: string;
}

export interface Layers {
  A_knowledge: LayerConfig;
  B_action: LayerConfig;
  C_pattern_intelligence: LayerConfig;
  D_executive_cognition: ExecutiveCognitionLayer;
  E_improvement: LayerConfig;
}

// ── EU AI Act Compliance ──────────────────────────────────────────────────

export const EU_AI_ACT_RISK_LEVELS = ["unacceptable", "high", "limited", "minimal"] as const;
export type EuAiActRiskLevel = typeof EU_AI_ACT_RISK_LEVELS[number];

export const ISOLATION_PRIORITIES = ["mandatory", "recommended", "optional", "not_needed"] as const;
export type IsolationPriority = typeof ISOLATION_PRIORITIES[number];

export const HUMAN_OVERSIGHT_LEVELS = ["full_autonomous", "human_in_the_loop", "human_on_the_loop", "human_in_command"] as const;
export type HumanOversightLevel = typeof HUMAN_OVERSIGHT_LEVELS[number];

export const DATA_RESIDENCY_OPTIONS = ["eu_only", "client_premises", "any", "air_gapped"] as const;
export type DataResidency = typeof DATA_RESIDENCY_OPTIONS[number];

export interface ComplianceMetadata {
  eu_ai_act_risk_level: EuAiActRiskLevel;
  eu_ai_act_annex_iii_domain: string | null;
  eu_ai_act_rationale?: string;
  requires_isolated_model: boolean;
  isolation_priority: IsolationPriority;
  isolation_reason?: string[];
  data_residency: DataResidency;
  human_oversight_level: HumanOversightLevel;
  explainability_required: boolean;
  decision_logging_required: boolean;
}

export interface InfrastructureSizing {
  deployment_phase: "beta" | "production" | "saas_scale";
  requires_isolated_infrastructure: boolean;
  isolation_modules_count: number;
  hardware_recommendation: Array<{
    phase: string; config: string; gpu: string;
    vram_gb: number; models_supported: string;
    concurrent_users: string; estimated_cost_eur: string;
  }>;
  llm_recommendation: Array<{
    model: string; parameters: string; license: string;
    vram_min_gb: number; use_case: string;
  }>;
  embedding_recommendation: Array<{
    model: string; dimensions: number; license: string;
    vram_gb: number; use_case: string;
  }>;
  scale_path_summary: string;
}

// ── Core Module Interface ─────────────────────────────────────────────────

export interface ArchitectureModule {
  module_id: string;
  module_name: string;
  module_type: ModuleType;
  layer: Layer;
  purpose: string;
  business_problem_solved: string;
  inputs: string[];
  outputs: string[];
  source_systems: string[];
  dependencies: string[];
  risk_level: RiskLevel;
  sensitivity_zone: SensitivityZone;
  explainability_requirement: boolean;
  confidence_policy: string;
  evaluation_policy: string;
  requires_human_approval: boolean;
  automation_level: AutomationLevel;
  materialization_target: MaterializationTarget;
  execution_mode: ExecutionMode;
  optional: boolean;
  phase: string;
  compliance?: ComplianceMetadata;
}

export interface Interconnection {
  from: string;
  to: string;
  data_type: string;
  frequency: string;
  criticality: RiskLevel;
  interaction_type: InteractionType;
  approval_required: boolean;
  review_required: boolean;
}

export interface SourceSystem {
  name: string;
  type: string;
  owner: string;
  access_method: string;
}

export interface DecisionSupported {
  decision: string;
  owner: string;
  automation_level: AutomationLevel;
  modules_involved: string[];
}

export interface EvaluationPlan {
  metrics: string[];
  datasets: string[];
  review_cadence: string;
  feedback_signals: string[];
  outcomes_tracked: string[];
}

export interface DeploymentPhase {
  phase: string;
  modules: string[];
  criteria: string;
}

export interface ArchitectureManifest {
  schema_version: string;
  compilation_metadata: CompilationMetadata;
  project_summary: ProjectSummary;
  layers: Layers;
  modules: ArchitectureModule[];
  interconnections: Interconnection[];
  source_systems: SourceSystem[];
  decisions_supported: DecisionSupported[];
  criticality_map: Record<string, RiskLevel>;
  evaluation_plan: EvaluationPlan;
  deployment_phases: DeploymentPhase[];
  infrastructure_sizing?: InfrastructureSizing;
}

// ── Validation ────────────────────────────────────────────────────────────

export type CriticSeverity = "error" | "warning" | "advice";

export interface CriticViolation {
  severity: CriticSeverity;
  rule: string;
  detail: string;
  module_id?: string;
}

export interface ManifestValidationResult {
  valid: boolean;
  errors: CriticViolation[];
  warnings: CriticViolation[];
  advice: CriticViolation[];
  total_modules: number;
  layers_active: string[];
}

/**
 * Deterministic validator + critic for ArchitectureManifest.
 * No LLM calls — pure rule evaluation with 3 severities.
 */
export function validateManifest(manifest: ArchitectureManifest): ManifestValidationResult {
  const errors: CriticViolation[] = [];
  const warnings: CriticViolation[] = [];
  const advice: CriticViolation[] = [];

  const modules = manifest.modules || [];
  const totalModules = modules.length;
  const moduleIds = new Set(modules.map(m => m.module_id));

  // ── Per-module validations ──
  for (const m of modules) {
    // E1: module_type not in allowed list
    if (!MODULE_TYPES.includes(m.module_type as any)) {
      errors.push({ severity: "error", rule: "E_INVALID_MODULE_TYPE", detail: `module_type "${m.module_type}" not in allowed list`, module_id: m.module_id });
    }

    // E2: layer incoherent with module_type
    if (LAYERS.includes(m.layer as any) && MODULE_TYPES.includes(m.module_type as any)) {
      const allowed = VALID_LAYER_MODULE_MAP[m.layer as Layer] || [];
      if (!allowed.includes(m.module_type as ModuleType)) {
        errors.push({ severity: "error", rule: "E_LAYER_MISMATCH", detail: `module_type "${m.module_type}" not valid in layer ${m.layer}. Expected: ${allowed.join(", ")}`, module_id: m.module_id });
      }
    }

    // E3: pattern_module without source_systems
    if (m.module_type === "pattern_module" && (!m.source_systems || m.source_systems.length === 0)) {
      errors.push({ severity: "error", rule: "E_PATTERN_NO_SOURCES", detail: `pattern_module has no source_systems`, module_id: m.module_id });
    }

    // E4: automatic + requires_human_approval
    if (m.automation_level === "automatic" && m.requires_human_approval === true) {
      errors.push({ severity: "error", rule: "E_AUTO_WITH_APPROVAL", detail: `automation_level "automatic" conflicts with requires_human_approval=true`, module_id: m.module_id });
    }

    // W1: phase != MVP with expertforge_* materialization_target
    if (m.phase && m.phase.toUpperCase() !== "MVP" && m.materialization_target?.startsWith("expertforge_")) {
      warnings.push({ severity: "warning", rule: "W_PHASE_MATERIALIZATION", detail: `phase "${m.phase}" with materialization_target "${m.materialization_target}" — non-MVP modules should not target active materialization`, module_id: m.module_id });
    }

    // W2: executive_cognition_module with optional=false
    if (m.module_type === "executive_cognition_module" && m.optional === false) {
      warnings.push({ severity: "warning", rule: "W_SOUL_NOT_OPTIONAL", detail: `executive_cognition_module marked as non-optional`, module_id: m.module_id });
    }

    // W3: automatic in sensitive zone
    const sensitiveZones: SensitivityZone[] = ["financial", "legal", "compliance", "people_ops"];
    if (m.automation_level === "automatic" && sensitiveZones.includes(m.sensitivity_zone as SensitivityZone)) {
      warnings.push({ severity: "warning", rule: "W_AUTO_SENSITIVE", detail: `automatic automation in ${m.sensitivity_zone} zone — consider semi_automatic or advisory`, module_id: m.module_id });
    }

    // W4: Capa E module without evaluation_policy
    if (m.layer === "E" && (!m.evaluation_policy || m.evaluation_policy.trim() === "")) {
      warnings.push({ severity: "warning", rule: "W_IMPROVEMENT_NO_EVAL", detail: `improvement module missing evaluation_policy`, module_id: m.module_id });
    }

    // A1: pattern_module with conversational purpose
    if (m.module_type === "pattern_module") {
      const actionTerms = ["responder preguntas", "asistir usuario", "coordinar tareas", "actuar como experto", "conversacional", "chatbot"];
      const purposeLower = (m.purpose || "").toLowerCase();
      if (actionTerms.some(t => purposeLower.includes(t))) {
        advice.push({ severity: "advice", rule: "A_PATTERN_MISCLASS", detail: `pattern_module purpose sounds like an action module: "${m.purpose.substring(0, 80)}"`, module_id: m.module_id });
      }
    }

    // A2: action_module with scoring/detection purpose
    if (m.module_type === "action_module") {
      const patternTerms = ["detectar correlaciones", "priorizar entidades", "predecir riesgo", "segmentar", "scoring", "ranking", "anomal"];
      const purposeLower = (m.purpose || "").toLowerCase();
      if (patternTerms.some(t => purposeLower.includes(t))) {
        advice.push({ severity: "advice", rule: "A_ACTION_MISCLASS", detail: `action_module purpose sounds like a pattern module: "${m.purpose.substring(0, 80)}"`, module_id: m.module_id });
      }
    }
  }

  // ── Soul validations ──
  const soul = manifest.layers?.D_executive_cognition;
  if (soul?.enabled) {
    // E5: Soul enabled without governance_rules
    if (!soul.governance_rules || soul.governance_rules.trim() === "") {
      errors.push({ severity: "error", rule: "E_SOUL_NO_GOVERNANCE", detail: `Executive Cognition enabled without governance_rules` });
    }

    // W5: Soul influences > 50% of modules
    if (soul.influences_modules && totalModules > 0) {
      const influencePct = soul.influences_modules.length / totalModules;
      if (influencePct > 0.5) {
        warnings.push({ severity: "warning", rule: "W_SOUL_OVERREACH", detail: `Soul influences ${soul.influences_modules.length}/${totalModules} modules (${Math.round(influencePct * 100)}%) — consider reducing scope` });
      }
    }
  }

  // ── Evaluation plan (contextual obligation) ──
  const layerE = manifest.layers?.E_improvement;
  if (layerE?.active) {
    const evalPlan = manifest.evaluation_plan;
    const hasFeedback = evalPlan?.feedback_signals && evalPlan.feedback_signals.length > 0;
    const hasOutcomes = evalPlan?.outcomes_tracked && evalPlan.outcomes_tracked.length > 0;
    const hasMetrics = evalPlan?.metrics && evalPlan.metrics.length > 0;

    if (!hasFeedback && !hasOutcomes && !hasMetrics) {
      warnings.push({ severity: "warning", rule: "W_IMPROVEMENT_EMPTY", detail: `Improvement Layer active but evaluation_plan has no metrics, feedback_signals, or outcomes_tracked — Capa E may be filler` });
    }
  }

  // ── Global validations ──
  // A3: >70% modules automatic
  const automaticCount = modules.filter(m => m.automation_level === "automatic").length;
  if (totalModules > 0 && (automaticCount / totalModules) > 0.7) {
    advice.push({ severity: "advice", rule: "A_TOO_MANY_AUTO", detail: `${automaticCount}/${totalModules} modules (${Math.round((automaticCount / totalModules) * 100)}%) are automatic — may lack human oversight` });
  }

  // Collect active layers
  const layersActive: string[] = [];
  if (manifest.layers?.A_knowledge?.active) layersActive.push("A");
  if (manifest.layers?.B_action?.active) layersActive.push("B");
  if (manifest.layers?.C_pattern_intelligence?.active) layersActive.push("C");
  if (manifest.layers?.D_executive_cognition?.active) layersActive.push("D");
  if (manifest.layers?.E_improvement?.active) layersActive.push("E");

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    advice,
    total_modules: totalModules,
    layers_active: layersActive,
  };
}

// ── Safe JSON Parser with repair ──────────────────────────────────────────

export function safeParseManifest(text: string): { manifest: ArchitectureManifest | null; repaired: boolean; error?: string } {
  // Try direct parse
  try {
    const parsed = JSON.parse(text);
    return { manifest: parsed, repaired: false };
  } catch { /* continue */ }

  // Try extracting JSON from markers
  const startMarker = "===ARCHITECTURE_MANIFEST===";
  const endMarker = "===END_MANIFEST===";
  const startIdx = text.indexOf(startMarker);
  const endIdx = text.indexOf(endMarker);

  if (startIdx >= 0 && endIdx > startIdx) {
    const jsonStr = text.substring(startIdx + startMarker.length, endIdx).trim();
    try {
      const parsed = JSON.parse(jsonStr);
      return { manifest: parsed, repaired: false };
    } catch { /* continue */ }

    // Try repairing common issues
    try {
      let repaired = jsonStr;
      // Remove trailing commas before } or ]
      repaired = repaired.replace(/,\s*([}\]])/g, "$1");
      // Fix unclosed braces
      const openBraces = (repaired.match(/{/g) || []).length;
      const closeBraces = (repaired.match(/}/g) || []).length;
      for (let i = 0; i < openBraces - closeBraces; i++) repaired += "}";
      const openBrackets = (repaired.match(/\[/g) || []).length;
      const closeBrackets = (repaired.match(/]/g) || []).length;
      for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += "]";

      const parsed = JSON.parse(repaired);
      return { manifest: parsed, repaired: true };
    } catch (e) {
      return { manifest: null, repaired: false, error: `JSON repair failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  // Try finding first { ... } block
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(text.substring(firstBrace, lastBrace + 1));
      return { manifest: parsed, repaired: true };
    } catch { /* continue */ }
  }

  return { manifest: null, repaired: false, error: "No valid JSON found in manifest output" };
}

// ── Manifest Compilation Prompt ───────────────────────────────────────────

export const MANIFEST_COMPILATION_SYSTEM_PROMPT = `Eres un compilador de arquitectura empresarial. Tu misión es EXTRAER un Architecture Manifest JSON estructurado a partir de un PRD técnico ya generado.

REGLAS:
- EXTRAE, no inventes. Todo dato debe venir del PRD.
- Si el PRD no menciona un componente, NO lo incluyas en el manifest.
- Si el PRD no tiene Capa D (Executive Cognition/Soul), marca D_executive_cognition.active=false y enabled=false.
- Si el PRD no tiene Capa E (Improvement), marca E_improvement.active=false.
- Cada módulo DEBE tener module_type, layer, sensitivity_zone, materialization_target, execution_mode, automation_level, requires_human_approval.
- Los module_type válidos son: knowledge_module, action_module, pattern_module, executive_cognition_module, improvement_module, deterministic_engine, router_orchestrator.
- Las layers válidas son: A (knowledge), B (action/orchestration), C (pattern/deterministic), D (executive cognition), E (improvement).
- materialization_target: expertforge_rag, expertforge_specialist, expertforge_deterministic_engine, expertforge_soul, expertforge_moe, runtime_only, roadmap_only, manual_design.
- execution_mode: deterministic (cálculo puro), llm_augmented (usa LLM), hybrid (ambos).
- automation_level: advisory (sugiere), semi_automatic (ejecuta con aprobación), automatic (ejecuta solo).
- sensitivity_zone: low, business, financial, legal, compliance, people_ops, executive.
- scope de Soul: tone_only, advisory, strategic_assist, decision_style. authority_level: low, medium, high. SON CAMPOS SEPARADOS.
- interaction_type en interconnections: reads_from, writes_to, triggers, evaluates, explains, modulates, none. NO incluir human_gate (gobernanza va en approval_required/review_required).
- Incluye feedback_signals y outcomes_tracked en evaluation_plan si el PRD menciona mejora continua, feedback loops, o aprendizaje.

REGLAS DE GOBERNANZA SOUL (Capa D):
- Si un módulo executive_cognition_module tiene enabled=true, DEBE tener governance_rules como array no vacío.
- DEBE tener subject_type, scope, authority_level como campos separados.
- DEBE tener influences_modules (array de module_ids que el Soul puede modular).
- DEBE tener excluded_from_modules (array de module_ids donde NO interviene, especialmente deterministic_engines).
- Si no hay governance_rules definidas en el PRD, NO marques enabled=true.

REGLAS DE IMPROVEMENT (Capa E):
- Si E_improvement.active=true, el evaluation_plan DEBE contener:
  - feedback_signals: array de señales que alimentan la mejora (e.g., "user_rating", "task_completion_rate")
  - outcomes_tracked: array de métricas medidas (e.g., "precision_at_5", "response_latency_p95")
  - evaluation_policy: manual_review | automated_threshold | periodic_audit
  - review_cadence: weekly | monthly | quarterly | on_drift

CHECKLIST DE VALIDACIÓN (ejecutar antes de emitir el JSON):
✓ Ningún deterministic_engine tiene modelo LLM ni temperatura
✓ Ningún módulo con phase != "MVP" tiene materialization_target activo (excepto con justificación)
✓ Todos los módulos tienen sensitivity_zone y automation_level
✓ Soul enabled=true → governance_rules no vacío
✓ Capa E activa → feedback_signals y outcomes_tracked presentes
✓ Temperaturas diferenciadas por función (no todas iguales)
✓ No hay módulos inventados que no aparezcan en el PRD

ORDEN DE PRIORIDAD PARA COMPILAR EL MANIFEST:
1. Sección 15 del PRD (organizada por capas A-E) — fuente primaria y mandatoria para extraer módulos.
2. Metadata explícita complementaria en secciones técnicas (14, 16, 18) — solo si complementa sin contradecir.
3. Resto del PRD — solo como contexto auxiliar, NUNCA como fuente de módulos.
Si hay contradicción entre fuentes, MANDA la Sección 15.

PROHIBICIONES ADICIONALES:
- NO INVENTAR módulos no sustentados por el PRD.
- NO INFERIR Soul por defecto.
- NO convertir roadmap en MVP.
- NO convertir pattern en action ni knowledge en pattern.
- Si phase != MVP, usar materialization_target = roadmap_only salvo justificación explícita del PRD.

FORMATO DE SALIDA:
===ARCHITECTURE_MANIFEST===
{JSON del manifest}
===END_MANIFEST===

Devuelve SOLO el bloque con los markers. No incluyas texto adicional fuera de los markers.`;

export function buildManifestCompilationPrompt(fullPrd: string, briefingSummary: string, auditJson?: string): string {
  let auditBlock = "";
  if (auditJson) {
    auditBlock = `\n===AUDIT ESTRUCTURADO===\n${auditJson}\n===FIN AUDIT===\nSi el audit contiene componentes con layer, module_type y status, ÚSALOS como referencia cruzada obligatoria.\nSi hay discrepancia entre Sección 15 y audit, prioriza Sección 15 pero señala la contradicción en compilation_metadata.\n`;
  }

  return `Compila el Architecture Manifest JSON a partir del siguiente PRD, briefing y audit estructurado.

===BRIEFING===
${briefingSummary.substring(0, 5000)}
===FIN BRIEFING===
${auditBlock}
===PRD COMPLETO===
${fullPrd.substring(0, 80000)}
===FIN PRD===

Extrae los módulos tomando como referencia PRIMARIA la Sección 15 del PRD (organizada por capas A-E). El audit estructurado sirve como referencia cruzada para validar layer, module_type, phase y status. Las demás secciones solo sirven como contexto complementario. Si hay contradicción entre PRD y audit, manda la Sección 15.
NO inventes módulos que no estén explícitamente definidos en el PRD.
Genera el JSON completo del Architecture Manifest siguiendo el schema v1.0.`;
}
