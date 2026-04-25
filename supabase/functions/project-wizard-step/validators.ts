/**
 * validators.ts — Post-generation validators for the JARVIS Pipeline
 * Runs AFTER LLM output is parsed, BEFORE saving to DB.
 * Created: 2026-03-14
 */

import { PHASE_CONTRACTS } from "./contracts.ts";

export interface ValidationResult {
  /** Overall pass/fail */
  valid: boolean;
  /** Specific violations found */
  violations: ValidationViolation[];
  /** Metadata flags to attach to output */
  flags: Record<string, any>;
}

export interface ValidationViolation {
  type: "forbidden_key" | "forbidden_term" | "missing_required" | "technical_density" | "mvp_scope" | "contamination" | "brief_integrity" | "manifest_integrity" | "flat_naming";
  detail: string;
  severity: "warning" | "error";
}

/**
 * Validate output against the phase contract.
 * Checks forbidden keys, forbidden terms, and required fields.
 */
export function validateAgainstContract(
  stepNumber: number,
  outputData: any,
  outputText?: string
): ValidationResult {
  const contract = PHASE_CONTRACTS[stepNumber];
  if (!contract) {
    return { valid: true, violations: [], flags: {} };
  }

  const violations: ValidationViolation[] = [];
  const flags: Record<string, any> = {};

  // ── Check forbidden keys in JSON output ──
  if (outputData && typeof outputData === "object" && !outputData.parse_error) {
    const outputStr = JSON.stringify(outputData).toLowerCase();
    for (const key of contract.forbiddenKeys) {
      // Check both as JSON key and as substring
      if (outputStr.includes(`"${key.toLowerCase()}":`)) {
        violations.push({
          type: "forbidden_key",
          detail: `Forbidden key "${key}" found in output`,
          severity: "warning",
        });
      }
    }
  }

  // ── Check forbidden terms in text output ──
  const textToCheck = outputText || (typeof outputData === "string" ? outputData : JSON.stringify(outputData || ""));
  const textLower = textToCheck.toLowerCase();
  for (const term of contract.forbiddenTerms) {
    if (textLower.includes(term.toLowerCase())) {
      violations.push({
        type: "forbidden_term",
        detail: `Forbidden term "${term}" found in output text`,
        severity: "warning",
      });
    }
  }

  // ── Check required fields ──
  if (contract.requiredFields && outputData && typeof outputData === "object") {
    for (const field of contract.requiredFields) {
      if (!(field in outputData) || outputData[field] === null || outputData[field] === undefined) {
        violations.push({
          type: "missing_required",
          detail: `Required field "${field}" missing from output`,
          severity: "warning",
        });
      }
    }
  }

  // ── Check required sections in markdown ──
  if (contract.requiredSections && outputText) {
    const textLowerFull = outputText.toLowerCase();
    const missingSections: string[] = [];
    for (const section of contract.requiredSections) {
      if (!textLowerFull.includes(section.toLowerCase())) {
        missingSections.push(section);
      }
    }
    if (missingSections.length > 0) {
      violations.push({
        type: "missing_required",
        detail: `Missing required sections: ${missingSections.join(", ")}`,
        severity: "warning",
      });
      flags.missing_sections = missingSections;
    }
  }

  if (violations.length > 0) {
    flags.contract_violation = true;
    flags.violation_count = violations.length;
    flags.violation_details = violations.map(v => `[${v.type}] ${v.detail}`);
  }

  return {
    valid: violations.filter(v => v.severity === "error").length === 0,
    violations,
    flags,
  };
}

/**
 * Validate technical density for PRD (Step 5).
 * Checks that the output is genuinely technical, not a sales pitch.
 */
export function validateTechnicalDensity(prdText: string): ValidationResult {
  const violations: ValidationViolation[] = [];
  const flags: Record<string, any> = {};

  if (!prdText || prdText.length < 500) {
    return { valid: true, violations: [], flags: {} };
  }

  // Check required technical sections
  const technicalMarkers = [
    { term: "entidad", label: "Entidades/Dominio" },
    { term: "workflow", label: "Workflows" },
    { term: "create table", label: "SQL Schema" },
    { term: "api", label: "API Contracts" },
    { term: "rls", label: "Seguridad/RLS" },
    { term: "edge function", label: "Edge Functions" },
    { term: "observab", label: "Observabilidad" },
    { term: "autenticación", label: "Autenticación" },
  ];

  const textLower = prdText.toLowerCase();
  let technicalSectionsFound = 0;
  const missingTechnical: string[] = [];

  for (const marker of technicalMarkers) {
    if (textLower.includes(marker.term)) {
      technicalSectionsFound++;
    } else {
      missingTechnical.push(marker.label);
    }
  }

  if (technicalSectionsFound < 5) {
    violations.push({
      type: "technical_density",
      detail: `Only ${technicalSectionsFound}/8 technical markers found. Missing: ${missingTechnical.join(", ")}`,
      severity: "warning",
    });
    flags.technical_density_too_low = true;
    flags.technical_sections_found = technicalSectionsFound;
    flags.missing_technical = missingTechnical;
  }

  // Check narrative opening density
  const totalLength = prdText.length;
  const openingCutoff = Math.floor(totalLength * 0.15);
  const opening = prdText.substring(0, openingCutoff).toLowerCase();

  const commercialTerms = [
    "transformación", "transformacion", "escalabilidad", "visión", "vision",
    "revolución", "revolucion", "oportunidad", "colapso operativo",
    "liderazgo", "competitivo", "innovador", "disruptivo", "posicionamiento",
    "ventaja competitiva", "propuesta de valor",
  ];

  let commercialHits = 0;
  for (const term of commercialTerms) {
    const regex = new RegExp(term, "gi");
    const matches = opening.match(regex);
    if (matches) commercialHits += matches.length;
  }

  if (commercialHits >= 5) {
    violations.push({
      type: "technical_density",
      detail: `Opening 15% has ${commercialHits} commercial/narrative terms — too sales-oriented for a technical PRD`,
      severity: "warning",
    });
    flags.narrative_opening_too_dense = true;
    flags.commercial_term_count = commercialHits;
  }

  return {
    valid: violations.filter(v => v.severity === "error").length === 0,
    violations,
    flags,
  };
}

/**
 * Validate MVP scope limits (Step 11).
 * Flags if MVP tries to include too many modules or dependencies.
 */
export function validateMvpScope(mvpText: string): ValidationResult {
  const contract = PHASE_CONTRACTS[11];
  const violations: ValidationViolation[] = [];
  const flags: Record<string, any> = {};

  if (!mvpText || !contract?.mvpScopeLimit) {
    return { valid: true, violations: [], flags: {} };
  }

  // Count module mentions (## headings that look like modules/features)
  const moduleHeadings = mvpText.match(/^##\s+\d+\.\s+/gm) || [];
  // Count external dependency mentions
  const extDepPatterns = /(?:API|SDK|servicio externo|integración|third.?party)/gi;
  const extDeps = mvpText.match(extDepPatterns) || [];

  if (moduleHeadings.length > contract.mvpScopeLimit.maxModules * 2) {
    violations.push({
      type: "mvp_scope",
      detail: `MVP has ${moduleHeadings.length} section headings — may exceed ${contract.mvpScopeLimit.maxModules} module limit`,
      severity: "warning",
    });
    flags.mvp_scope_risk = "high";
  }

  if (extDeps.length > contract.mvpScopeLimit.maxExternalDeps * 3) {
    violations.push({
      type: "mvp_scope",
      detail: `MVP mentions ${extDeps.length} external dependencies — may exceed limit`,
      severity: "warning",
    });
    flags.mvp_dependency_risk = "high";
  }

  return {
    valid: violations.filter(v => v.severity === "error").length === 0,
    violations,
    flags,
  };
}

/**
 * Detect phase contamination by comparing output against previous phases.
 * Uses normalized paragraph n-gram overlap.
 */
export function detectPhaseContamination(
  stepNumber: number,
  outputText: string,
  previousOutputs: Record<number, string>
): ValidationResult {
  const violations: ValidationViolation[] = [];
  const flags: Record<string, any> = {};

  if (!outputText || Object.keys(previousOutputs).length === 0) {
    return { valid: true, violations: [], flags: {} };
  }

  // Normalize text: lowercase, strip numbers/punctuation, collapse whitespace
  const normalize = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[0-9€$%]/g, "")
      .replace(/[^\wáéíóúñü\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  // Extract n-grams (trigrams of words)
  const getNgrams = (text: string, n = 3): Set<string> => {
    const words = normalize(text).split(" ").filter(w => w.length > 2);
    const ngrams = new Set<string>();
    for (let i = 0; i <= words.length - n; i++) {
      ngrams.add(words.slice(i, i + n).join(" "));
    }
    return ngrams;
  };

  const currentNgrams = getNgrams(outputText);
  if (currentNgrams.size === 0) {
    return { valid: true, violations: [], flags: {} };
  }

  const duplicatedFrom: number[] = [];

  for (const [stepStr, prevText] of Object.entries(previousOutputs)) {
    const prevStep = Number(stepStr);
    if (prevStep === stepNumber) continue;

    const prevNgrams = getNgrams(prevText);
    if (prevNgrams.size === 0) continue;

    // Calculate overlap
    let overlapCount = 0;
    for (const ng of currentNgrams) {
      if (prevNgrams.has(ng)) overlapCount++;
    }

    const overlapPct = overlapCount / currentNgrams.size;

    if (overlapPct > 0.30) {
      duplicatedFrom.push(prevStep);
      violations.push({
        type: "contamination",
        detail: `${Math.round(overlapPct * 100)}% n-gram overlap with step ${prevStep} (${PHASE_CONTRACTS[prevStep]?.name || "unknown"})`,
        severity: "warning",
      });
    }
  }

  if (duplicatedFrom.length > 0) {
    flags.phase_contamination_detected = true;
    flags.duplicated_from = duplicatedFrom;
    flags.contamination_action = "review"; // v1: log only, v2: regenerate
  }

  return {
    valid: true, // v1: never block, just flag
    violations,
    flags,
  };
}

/**
 * Validate brief integrity for Step 2 (v3 typed brief).
 * Enforces separation between facts, needs, candidates and architecture signals.
 */
export function validateBriefIntegrity(briefData: any): ValidationResult {
  const violations: ValidationViolation[] = [];
  const flags: Record<string, any> = {};

  if (!briefData || briefData.parse_error) {
    return { valid: true, violations: [], flags: {} };
  }

  const VALID_SOURCE_KINDS = ["transcript", "uploaded_doc", "user_note", "structured_summary", "derived_inference"];
  const VALID_ABSTRACTION = ["observed", "inferred", "proposed"];
  const VALID_CERTAINTY = ["high", "medium", "low"];
  const VALID_STATUS = ["confirmed", "inferred", "proposed", "unknown"];
  const VALID_LAYERS = ["business", "knowledge", "execution", "deterministic", "orchestration", "integration", "presentation"];
  const VALID_COMPONENT_TYPES = ["none", "knowledge_asset", "ai_specialist", "workflow_module", "deterministic_engine", "orchestrator", "dashboard", "connector", "analytics_module"];

  // Helper: validate item metadata
  function validateItemMeta(item: any, blockName: string, index: number) {
    if (!item.id) {
      violations.push({ type: "brief_integrity", detail: `${blockName}[${index}]: missing "id"`, severity: "warning" });
    }
    if (!item.title) {
      violations.push({ type: "brief_integrity", detail: `${blockName}[${index}]: missing "title"`, severity: "warning" });
    }
    if (item.source_kind && !VALID_SOURCE_KINDS.includes(item.source_kind)) {
      violations.push({ type: "brief_integrity", detail: `${blockName}[${index}]: invalid source_kind "${item.source_kind}"`, severity: "warning" });
    }
    if (item.abstraction_level && !VALID_ABSTRACTION.includes(item.abstraction_level)) {
      violations.push({ type: "brief_integrity", detail: `${blockName}[${index}]: invalid abstraction_level "${item.abstraction_level}"`, severity: "warning" });
    }
    if (item.certainty && !VALID_CERTAINTY.includes(item.certainty)) {
      violations.push({ type: "brief_integrity", detail: `${blockName}[${index}]: invalid certainty "${item.certainty}"`, severity: "warning" });
    }
    if (item.status && !VALID_STATUS.includes(item.status)) {
      violations.push({ type: "brief_integrity", detail: `${blockName}[${index}]: invalid status "${item.status}"`, severity: "warning" });
    }
    if (item.likely_layer && !VALID_LAYERS.includes(item.likely_layer)) {
      violations.push({ type: "brief_integrity", detail: `${blockName}[${index}]: invalid likely_layer "${item.likely_layer}"`, severity: "warning" });
    }
    if (item.candidate_component_type && !VALID_COMPONENT_TYPES.includes(item.candidate_component_type)) {
      violations.push({ type: "brief_integrity", detail: `${blockName}[${index}]: invalid candidate_component_type "${item.candidate_component_type}"`, severity: "warning" });
    }
  }

  // 1. observed_facts must have abstraction_level "observed" and status "confirmed" or "unknown"
  if (Array.isArray(briefData.observed_facts)) {
    briefData.observed_facts.forEach((item: any, i: number) => {
      validateItemMeta(item, "observed_facts", i);
      if (item.abstraction_level && item.abstraction_level !== "observed") {
        violations.push({ type: "brief_integrity", detail: `observed_facts[${i}]: abstraction_level should be "observed", got "${item.abstraction_level}"`, severity: "warning" });
      }
      if (item.status === "proposed") {
        violations.push({ type: "brief_integrity", detail: `observed_facts[${i}]: "proposed" status in observed_facts — mixing facts with proposals`, severity: "error" });
      }
      // Facts should not have solution-like candidate_component_type
      if (item.candidate_component_type && item.candidate_component_type !== "none") {
        violations.push({ type: "brief_integrity", detail: `observed_facts[${i}]: candidate_component_type "${item.candidate_component_type}" in observed_facts — facts should not propose components`, severity: "error" });
      }
    });
  }

  // 2. inferred_needs must not have status "confirmed" and should not be formalized as final components
  if (Array.isArray(briefData.inferred_needs)) {
    briefData.inferred_needs.forEach((item: any, i: number) => {
      validateItemMeta(item, "inferred_needs", i);
      if (item.status === "confirmed") {
        violations.push({ type: "brief_integrity", detail: `inferred_needs[${i}]: "confirmed" status on an inferred need — inferred items cannot be confirmed`, severity: "warning" });
      }
    });
  }

  // 3. solution_candidates must be "proposed" and never "confirmed"
  if (Array.isArray(briefData.solution_candidates)) {
    briefData.solution_candidates.forEach((item: any, i: number) => {
      validateItemMeta(item, "solution_candidates", i);
      if (item.status === "confirmed") {
        violations.push({ type: "brief_integrity", detail: `solution_candidates[${i}]: "confirmed" status — candidates cannot be confirmed in the brief layer`, severity: "error" });
      }
      if (item.abstraction_level === "observed") {
        violations.push({ type: "brief_integrity", detail: `solution_candidates[${i}]: abstraction_level "observed" — candidates are proposed, not observed`, severity: "error" });
      }
    });
  }

  // 4. architecture_signals must not use formal component names without evidence
  if (Array.isArray(briefData.architecture_signals)) {
    briefData.architecture_signals.forEach((item: any, i: number) => {
      validateItemMeta(item, "architecture_signals", i);
      if (item.status === "confirmed") {
        violations.push({ type: "brief_integrity", detail: `architecture_signals[${i}]: "confirmed" status — signals cannot be confirmed in the brief layer`, severity: "error" });
      }
    });
  }

  // 5. Cross-check: detect duplicate domains appearing as both knowledge_asset and ai_specialist without relationship
  const knowledgeDomains: Map<string, string> = new Map();
  const specialistDomains: Map<string, string> = new Map();
  const allItems = [
    ...(briefData.inferred_needs || []),
    ...(briefData.solution_candidates || []),
    ...(briefData.architecture_signals || []),
  ];

  for (const item of allItems) {
    const titleLower = (item.title || "").toLowerCase();
    if (item.candidate_component_type === "knowledge_asset") {
      knowledgeDomains.set(titleLower, item.id || "");
    } else if (item.candidate_component_type === "ai_specialist") {
      specialistDomains.set(titleLower, item.id || "");
    }
  }

  for (const [domain, knowledgeId] of knowledgeDomains) {
    for (const [specDomain, specId] of specialistDomains) {
      // Check for overlapping domain names (fuzzy: >60% word overlap)
      const kWords = domain.split(/\s+/).filter(w => w.length > 2);
      const sWords = specDomain.split(/\s+/).filter(w => w.length > 2);
      const overlap = kWords.filter(w => sWords.includes(w)).length;
      if (overlap > 0 && overlap >= Math.max(1, Math.ceil(Math.min(kWords.length, sWords.length) * 0.6))) {
        // Check if they reference each other via inferred_from
        const specItem = allItems.find((it: any) => it.id === specId);
        const hasRef = specItem?.inferred_from?.includes(knowledgeId);
        if (!hasRef) {
          violations.push({
            type: "brief_integrity",
            detail: `Duplicate domain: "${domain}" appears as knowledge_asset (${knowledgeId}) and ai_specialist (${specDomain}/${specId}) without inferred_from relationship`,
            severity: "warning",
          });
        }
      }
    }
  }

  if (violations.length > 0) {
    flags.brief_integrity_checked = true;
    flags.brief_integrity_violations = violations.length;
    flags.brief_integrity_errors = violations.filter(v => v.severity === "error").length;
  }

  return {
    valid: violations.filter(v => v.severity === "error").length === 0,
    violations,
    flags,
  };
}

/**
 * Run all applicable validators for a given step.
 * Returns merged flags to attach to output metadata.
 */
export function runAllValidators(
  stepNumber: number,
  outputData: any,
  outputText: string,
  previousOutputs: Record<number, string> = {}
): { flags: Record<string, any>; violations: ValidationViolation[] } {
  const allFlags: Record<string, any> = {};
  const allViolations: ValidationViolation[] = [];

  // 1. Contract validation (all steps)
  const contractResult = validateAgainstContract(stepNumber, outputData, outputText);
  Object.assign(allFlags, contractResult.flags);
  allViolations.push(...contractResult.violations);

  // 2. Brief integrity (step 2 only)
  if (stepNumber === 2 && outputData) {
    const briefResult = validateBriefIntegrity(outputData);
    Object.assign(allFlags, briefResult.flags);
    allViolations.push(...briefResult.violations);

    // 2b. Canonical fields validation for brief
    const canonicalResult = validateBriefCanonicalFields(outputData);
    Object.assign(allFlags, canonicalResult.flags);
    allViolations.push(...canonicalResult.violations);
  }

  // 3. Technical density (step 5 only)
  if (stepNumber === 5 && outputText) {
    const densityResult = validateTechnicalDensity(outputText);
    Object.assign(allFlags, densityResult.flags);
    allViolations.push(...densityResult.violations);
  }

  // 4. MVP scope (step 11 only)
  if (stepNumber === 11 && outputText) {
    const mvpResult = validateMvpScope(outputText);
    Object.assign(allFlags, mvpResult.flags);
    allViolations.push(...mvpResult.violations);
  }

  // 5. Contamination detection (all steps with previous outputs)
  if (Object.keys(previousOutputs).length > 0) {
    const contamResult = detectPhaseContamination(stepNumber, outputText, previousOutputs);
    Object.assign(allFlags, contamResult.flags);
    allViolations.push(...contamResult.violations);
  }

  // 6. Flat-naming contamination (steps 10 and 11)
  if ((stepNumber === 10 || stepNumber === 11) && (outputData || outputText)) {
    const flatResult = validateFlatNamingContamination(outputData, outputText);
    Object.assign(allFlags, flatResult.flags);
    allViolations.push(...flatResult.violations);
  }

  // 7. Registry approval guard (step 25 only) — semantic check on component.status
  if (stepNumber === 25 && outputData) {
    const approvalResult = validateRegistryNoApproval(outputData);
    Object.assign(allFlags, approvalResult.flags);
    allViolations.push(...approvalResult.violations);
  }

  // 8. F4a/F4b audit-only guard (steps 26 & 27) — hard-block approved_for_scope
  //    in any nested field and forbid registry mutation payloads.
  if ((stepNumber === 26 || stepNumber === 27) && outputData) {
    const auditResult = validateAuditNoApproval(stepNumber, outputData);
    Object.assign(allFlags, auditResult.flags);
    allViolations.push(...auditResult.violations);
  }

  // Add validation metadata
  if (allViolations.length > 0) {
    allFlags.validation_ran = true;
    allFlags.validation_timestamp = new Date().toISOString();
    allFlags.total_violations = allViolations.length;
    console.warn(`[Validator] Step ${stepNumber}: ${allViolations.length} violation(s) found:`,
      allViolations.map(v => `[${v.type}] ${v.detail}`).join("; "));
  }

  return { flags: allFlags, violations: allViolations };
}

/**
 * Validate canonical fields in brief extraction (Step 2).
 * Checks that solution_candidates and architecture_signals have
 * layer_candidate, module_type_candidate, phase_candidate.
 */
export function validateBriefCanonicalFields(briefData: any): ValidationResult {
  const violations: ValidationViolation[] = [];
  const flags: Record<string, any> = {};

  if (!briefData || briefData.parse_error) {
    return { valid: true, violations: [], flags: {} };
  }

  const VALID_LAYERS_CANONICAL = ["A", "B", "C", "D", "E", "unknown"];
  const VALID_MODULE_TYPES_CANONICAL = [
    "knowledge_module", "action_module", "pattern_module",
    "deterministic_engine", "router_orchestrator",
    "executive_cognition_module", "improvement_module", "unknown",
  ];
  const VALID_PHASES = ["MVP", "F2", "F3", "EXPLORATORY"];

  function checkCanonical(items: any[], blockName: string) {
    if (!Array.isArray(items)) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const label = `${blockName}[${i}] (${item.id || "?"})`;

      // Check presence of canonical fields
      if (!item.layer_candidate) {
        violations.push({ type: "brief_integrity", detail: `${label}: missing layer_candidate`, severity: "warning" });
      } else if (!VALID_LAYERS_CANONICAL.includes(item.layer_candidate)) {
        violations.push({ type: "brief_integrity", detail: `${label}: invalid layer_candidate "${item.layer_candidate}"`, severity: "warning" });
      }

      if (!item.module_type_candidate) {
        violations.push({ type: "brief_integrity", detail: `${label}: missing module_type_candidate`, severity: "warning" });
      } else if (!VALID_MODULE_TYPES_CANONICAL.includes(item.module_type_candidate)) {
        violations.push({ type: "brief_integrity", detail: `${label}: invalid module_type_candidate "${item.module_type_candidate}"`, severity: "warning" });
      }

      if (!item.phase_candidate) {
        violations.push({ type: "brief_integrity", detail: `${label}: missing phase_candidate`, severity: "warning" });
      } else if (!VALID_PHASES.includes(item.phase_candidate)) {
        violations.push({ type: "brief_integrity", detail: `${label}: invalid phase_candidate "${item.phase_candidate}"`, severity: "warning" });
      }

      // Coherence checks
      if (item.certainty === "low" && item.phase_candidate === "MVP") {
        violations.push({ type: "brief_integrity", detail: `${label}: certainty "low" but phase_candidate "MVP" — likely inflation`, severity: "warning" });
      }

      if (item.module_type_candidate === "executive_cognition_module") {
        const hasEvidence = Array.isArray(item.evidence_snippets) && item.evidence_snippets.length > 0;
        if (!hasEvidence) {
          violations.push({ type: "brief_integrity", detail: `${label}: executive_cognition_module without evidence_snippets — Soul requires explicit evidence`, severity: "warning" });
        }
      }

      if (item.phase_candidate && item.phase_candidate !== "MVP" && !item.why_not_mvp) {
        violations.push({ type: "brief_integrity", detail: `${label}: phase_candidate "${item.phase_candidate}" but why_not_mvp is missing`, severity: "warning" });
      }

      if (item.status === "proposed" && item.certainty === "low" && item.requires_human_design !== true) {
        violations.push({ type: "brief_integrity", detail: `${label}: status "proposed" + certainty "low" but requires_human_design is not true`, severity: "warning" });
      }
    }
  }

  checkCanonical(briefData.solution_candidates, "solution_candidates");
  checkCanonical(briefData.architecture_signals, "architecture_signals");

  if (violations.length > 0) {
    flags.canonical_fields_checked = true;
    flags.canonical_violations = violations.length;
  }

  return {
    valid: true, // warnings only, don't block
    violations,
    flags,
  };
}

/**
 * Detect legacy flat-naming contamination in Scope and AI Audit outputs.
 * Flags when old taxonomy (AGENTE_IA, MOTOR_DETERMINISTA, etc.) is used as structural classification.
 */
export function validateFlatNamingContamination(
  outputData: any,
  outputText?: string
): ValidationResult {
  const violations: ValidationViolation[] = [];
  const flags: Record<string, any> = {};

  const LEGACY_STRUCTURAL_TERMS = [
    "AGENTE_IA",
    "MOTOR_DETERMINISTA",
    "MODULO_APRENDIZAJE",
    "ORQUESTADOR",
  ];

  // Patterns that indicate structural usage (not just descriptive mention)
  const STRUCTURAL_PATTERNS = [
    /\|\s*(?:RAG|AGENTE_IA|MOTOR_DETERMINISTA|ORQUESTADOR|MODULO_APRENDIZAJE)\s*\|/gi,
    /"tipo"\s*:\s*"(?:RAG|AGENTE_IA|MOTOR_DETERMINISTA|ORQUESTADOR|MODULO_APRENDIZAJE)"/gi,
    /Tipo\s*(?:es|=)\s*(?:RAG|AGENTE_IA|MOTOR_DETERMINISTA|ORQUESTADOR|MODULO_APRENDIZAJE)/gi,
  ];

  const textToCheck = outputText || (typeof outputData === "string" ? outputData : JSON.stringify(outputData || ""));

  // Check JSON output for legacy "tipo" field
  if (outputData && typeof outputData === "object" && !outputData.parse_error) {
    const outputStr = JSON.stringify(outputData);
    for (const term of LEGACY_STRUCTURAL_TERMS) {
      if (outputStr.includes(`"tipo":"${term}"`) || outputStr.includes(`"tipo": "${term}"`)) {
        violations.push({
          type: "flat_naming",
          detail: `Legacy structural type "${term}" found as "tipo" in JSON output — should use canonical module_type + layer`,
          severity: "warning",
        });
      }
    }
    // Check for missing canonical fields
    const hasComponents = outputData.componentes_validados || outputData.componentes_auditados;
    if (Array.isArray(hasComponents)) {
      for (const comp of hasComponents) {
        if (comp.tipo && !comp.module_type) {
          violations.push({
            type: "flat_naming",
            detail: `Component "${comp.nombre || comp.id}" uses legacy "tipo" field without canonical "module_type"`,
            severity: "warning",
          });
        }
        if (!comp.layer && !comp.capa) {
          violations.push({
            type: "flat_naming",
            detail: `Component "${comp.nombre || comp.id}" missing "layer" field — cannot classify into A-E architecture`,
            severity: "warning",
          });
        }
      }
    }
  }

  // Check text output for structural patterns
  for (const pattern of STRUCTURAL_PATTERNS) {
    const matches = textToCheck.match(pattern);
    if (matches && matches.length > 0) {
      violations.push({
        type: "flat_naming",
        detail: `Legacy flat naming used structurally: ${matches.slice(0, 3).join(", ")}${matches.length > 3 ? ` (+${matches.length - 3} more)` : ""}`,
        severity: "warning",
      });
      break; // One violation per pattern type is enough
    }
  }

  if (violations.length > 0) {
    flags.flat_naming_contamination = true;
    flags.flat_naming_violations = violations.length;
  }

  return {
    valid: true, // v1: flag only, don't block
    violations,
    flags,
  };
}

/**
 * Step 25 — Registry approval guard (semantic).
 * F3 must NEVER mark components as approved_for_scope. That decision belongs
 * to F4a/F4b downstream. This validator inspects the actual `status` value of
 * each component in `component_registry.components` (and `legacy_components`
 * if present). Narrative mentions in `mutation_history[].reason` or warnings
 * are explicitly allowed.
 *
 * Emits code F3_APPROVED_FOR_SCOPE_FORBIDDEN with severity error per offending
 * component.
 */
export function validateRegistryNoApproval(outputData: any): ValidationResult {
  const violations: ValidationViolation[] = [];
  const flags: Record<string, any> = {};

  if (!outputData || typeof outputData !== "object") {
    return { valid: true, violations, flags };
  }

  const registry = outputData.component_registry;
  if (!registry || typeof registry !== "object") {
    return { valid: true, violations, flags };
  }

  const buckets: Array<{ key: string; items: any }> = [
    { key: "components", items: registry.components },
    { key: "legacy_components", items: registry.legacy_components },
  ];

  for (const { key, items } of buckets) {
    if (!Array.isArray(items)) continue;
    for (const comp of items) {
      if (comp && typeof comp === "object" && comp.status === "approved_for_scope") {
        const id = comp.component_id || comp.id || "<unknown_id>";
        const name = comp.name || comp.title || "<unnamed>";
        violations.push({
          type: "forbidden_key",
          severity: "error",
          detail: `[F3_APPROVED_FOR_SCOPE_FORBIDDEN] F3 cannot approve components for scope. Component ${id} (${name}) in component_registry.${key} has status "approved_for_scope". Must be downgraded to candidate_validated before persisting Step 25.`,
        });
      }
    }
  }

  if (violations.length > 0) {
    flags.f3_approved_for_scope_violations = violations.length;
  }

  return {
    valid: violations.length === 0,
    violations,
    flags,
  };
}
