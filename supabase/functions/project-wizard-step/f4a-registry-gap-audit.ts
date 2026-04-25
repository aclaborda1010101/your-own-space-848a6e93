/**
 * f4a-registry-gap-audit.ts — F4a orchestrator.
 *
 * Reads Step 2 brief + Step 25 registry, runs deterministic detectors as
 * pre-warm, then asks the LLM (Gemini Flash @ 0.2) to confirm/expand/reject
 * findings. Emits `registry_gap_audit_v1` for Step 26 persistence.
 *
 * F4a NEVER mutates the registry. Only audits.
 *
 * Created: 2026-04-25
 */

import { callGeminiFlash } from "./llm-helpers.ts";
import {
  PreDetectedGap,
  runAllDetectors,
  GapType,
  GapSeverity,
  SuggestedAction,
  SuggestedComponentCandidate,
} from "./f4a-deterministic-detectors.ts";

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────

export interface RegistryGap {
  gap_id: string;
  title: string;
  gap_type: GapType;
  severity: GapSeverity;
  evidence: string[];
  affected_registry_components: string[];
  suggested_action: SuggestedAction;
  suggested_component_candidate?: SuggestedComponentCandidate;
  reason: string;
  source: "deterministic" | "llm";
}

export interface RegistryGapAuditV1 {
  audit_version: "1.0.0";
  registry_version_reviewed: string | null;
  brief_version_reviewed: string | null;
  gaps: RegistryGap[];
  coverage_summary: {
    total_signals_reviewed: number;
    signals_with_component: number;
    signals_without_component: number;
    components_reviewed: number;
    components_flagged_for_split: number;
  };
}

export interface F4aOutput {
  registry_gap_audit_v1: RegistryGapAuditV1;
  audit_meta: {
    generated_at: string;
    f4a_ms: number;
    deterministic_pre_detections: number;
    llm_added_gaps: number;
    llm_rejected_pre_detections: number;
    llm_error?: string;
  };
}

const VALID_GAP_TYPES = new Set<GapType>([
  "missing_component", "component_should_be_split", "missing_data_source",
  "missing_form", "missing_rag", "missing_agent", "missing_moe_route",
  "missing_compliance_control", "missing_dataset_readiness", "weak_evidence",
  "phase_mismatch",
]);
const VALID_SEVERITIES = new Set<GapSeverity>(["low", "medium", "high", "critical"]);
const VALID_ACTIONS = new Set<SuggestedAction>([
  "add_component", "split_component", "defer_to_roadmap", "add_prerequisite",
  "add_dataset_requirement", "add_human_review", "no_action",
]);

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────────

function nextGapId(seq: number): string {
  return `GAP-${String(seq).padStart(3, "0")}`;
}

function parseJsonLoose(text: string): any {
  let cleaned = (text || "").trim();
  cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/gm, "").replace(/\n?```\s*$/gm, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first !== -1 && last > first) {
      try { return JSON.parse(cleaned.substring(first, last + 1)); } catch { return null; }
    }
    return null;
  }
}

function clampString(s: unknown, max = 500): string {
  if (typeof s !== "string") return "";
  return s.length > max ? s.substring(0, max) : s;
}

function clampStringArray(arr: unknown, maxItems = 10, maxLen = 300): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, maxItems).map((s) => clampString(s, maxLen)).filter((s) => s.length > 0);
}

function clampSuggestedCandidate(raw: any): SuggestedComponentCandidate | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  return {
    name: clampString(raw.name, 200),
    family: clampString(raw.family, 80),
    layer: clampString(raw.layer, 40),
    priority: clampString(raw.priority, 40),
    suggested_delivery_phase: clampString(raw.suggested_delivery_phase, 40),
    business_job: clampString(raw.business_job, 600),
    business_justification: clampString(raw.business_justification, 600),
  };
}

/**
 * Convert a deterministic pre-detected gap into the final RegistryGap shape.
 */
function fromPreDetected(g: PreDetectedGap, gapId: string): RegistryGap {
  return {
    gap_id: gapId,
    title: g.title,
    gap_type: g.gap_type,
    severity: g.severity,
    evidence: g.evidence,
    affected_registry_components: g.affected_registry_components,
    suggested_action: g.suggested_action,
    suggested_component_candidate: g.suggested_component_candidate,
    reason: g.reason,
    source: "deterministic",
  };
}

/**
 * Validate + clamp an LLM-emitted gap into the final RegistryGap shape.
 * Returns null if it's malformed beyond repair.
 */
function fromLlmGap(raw: any, gapId: string): RegistryGap | null {
  if (!raw || typeof raw !== "object") return null;
  const gap_type = raw.gap_type;
  const severity = raw.severity;
  const suggested_action = raw.suggested_action;
  if (!VALID_GAP_TYPES.has(gap_type)) return null;
  if (!VALID_SEVERITIES.has(severity)) return null;
  if (!VALID_ACTIONS.has(suggested_action)) return null;

  const evidence = clampStringArray(raw.evidence, 8, 400);
  if (evidence.length === 0) return null; // contract: every gap needs evidence

  return {
    gap_id: gapId,
    title: clampString(raw.title, 250) || "Gap sin título",
    gap_type,
    severity,
    evidence,
    affected_registry_components: clampStringArray(raw.affected_registry_components, 20, 80),
    suggested_action,
    suggested_component_candidate: clampSuggestedCandidate(raw.suggested_component_candidate),
    reason: clampString(raw.reason, 800) || "Sin razón explícita.",
    source: "llm",
  };
}

function emptyAudit(stepVer: string | null, briefVer: string | null, errMsg?: string): F4aOutput {
  return {
    registry_gap_audit_v1: {
      audit_version: "1.0.0",
      registry_version_reviewed: stepVer,
      brief_version_reviewed: briefVer,
      gaps: [],
      coverage_summary: {
        total_signals_reviewed: 0,
        signals_with_component: 0,
        signals_without_component: 0,
        components_reviewed: 0,
        components_flagged_for_split: 0,
      },
    },
    audit_meta: {
      generated_at: new Date().toISOString(),
      f4a_ms: 0,
      deterministic_pre_detections: 0,
      llm_added_gaps: 0,
      llm_rejected_pre_detections: 0,
      ...(errMsg ? { llm_error: errMsg } : {}),
    },
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Prompt
// ───────────────────────────────────────────────────────────────────────────────

const F4A_SYSTEM_PROMPT = `Eres un Senior AI Solutions Auditor. Tu tarea es auditar un component_registry generado por F3 contra el brief original (Step 2) y emitir una lista de GAPS (huecos) en formato JSON estricto.

REGLAS DURAS:

1. NUNCA propongas mutar el registry. Solo audita.
2. NUNCA emitas \`component_registry\` ni \`ai_opportunity_design_v1\` en tu output.
3. Cada gap DEBE tener al menos 1 evidencia citando un campo del brief o un component_id.
4. Si un componente del registry ya cubre la señal (revisa name + family + business_job), NO emitas gap.
5. NUNCA uses status "approved_for_scope" — está prohibido en F4a.
6. Devuelve SOLO JSON válido con la estructura exacta descrita abajo. Sin texto adicional, sin markdown.

CHECKLIST AFFLUX (revisar explícitamente):
- Detector compradores institucionales tipo Benatar (NO fusionar con detector de fallecimientos: son conceptualmente distintos).
- Pipeline de transcripción de llamadas.
- Analizador de notas comerciales.
- Formularios mínimos: post-llamada, validación de rol, ficha de propietario, ficha de inversor/comprador, ficha de activo.
- Fuentes externas: BORME, CNAE, licencias municipales, esquelas, BOE, BrainsRE, HubSpot, Gmail, Drive.
- MoE: router por intención y especialistas (clasificación, RAG, copy, compliance, matching, valoración).
- Soul dependencies: si múltiples componentes consultan el Soul y no existe módulo D_soul.
- Componentes fusionados que deberían separarse.

PRE_DETECTED_GAPS:
Recibirás una lista de gaps pre-detectados por heurísticas deterministas. Para cada uno DEBES:
- Confirmarlo (incluyéndolo en tu output, pudiendo enriquecer evidencia o reason).
- Rechazarlo explícitamente añadiéndolo a "rejected_pre_detected_dedupe_keys" con justificación en "rejection_reasons".
NO los ignores en silencio.

FORMATO DE SALIDA (estricto):
{
  "gaps": [
    {
      "title": "string",
      "gap_type": "missing_component | component_should_be_split | missing_data_source | missing_form | missing_rag | missing_agent | missing_moe_route | missing_compliance_control | missing_dataset_readiness | weak_evidence | phase_mismatch",
      "severity": "low | medium | high | critical",
      "evidence": ["string", ...],
      "affected_registry_components": ["COMP-ID", ...],
      "suggested_action": "add_component | split_component | defer_to_roadmap | add_prerequisite | add_dataset_requirement | add_human_review | no_action",
      "suggested_component_candidate": {
        "name": "string",
        "family": "string",
        "layer": "string",
        "priority": "string",
        "suggested_delivery_phase": "string",
        "business_job": "string",
        "business_justification": "string"
      },
      "reason": "string"
    }
  ],
  "rejected_pre_detected_dedupe_keys": ["string", ...],
  "rejection_reasons": { "<dedupe_key>": "razón" },
  "coverage_summary": {
    "total_signals_reviewed": 0,
    "signals_with_component": 0,
    "signals_without_component": 0,
    "components_reviewed": 0,
    "components_flagged_for_split": 0
  }
}`;

function buildUserPrompt(
  briefV2: any,
  f0: any,
  registry: any,
  preDetected: PreDetectedGap[],
  ctx: F4aProjectContext,
): string {
  const v2Str = briefV2 ? JSON.stringify(briefV2).substring(0, 50_000) : "(no business_extraction_v2)";
  const f0Str = f0 ? JSON.stringify(f0).substring(0, 20_000) : "(no _f0_signals)";

  // Send a compact registry view (id, name, family, layer, business_job, signal_ids).
  const compact = (Array.isArray(registry?.components) ? registry.components : []).map((c: any) => ({
    id: c.component_id || c.id,
    name: c.name,
    family: c.family,
    layer: c.layer,
    business_job: c.business_job,
    signal_ids: c.signal_ids,
    soul_dependency: c.soul_dependency,
    compliance_flags: c.compliance_flags,
    external_sources: c.external_sources,
  }));
  const compactStr = JSON.stringify(compact).substring(0, 40_000);

  const preStr = JSON.stringify(preDetected).substring(0, 20_000);

  return `Proyecto: ${ctx.projectName ?? "?"} | Cliente: ${ctx.companyName ?? "?"}

BUSINESS_EXTRACTION_V2:
${v2Str}

F0_SIGNALS:
${f0Str}

REGISTRY (compactado):
${compactStr}

PRE_DETECTED_GAPS (heurísticas deterministas — confirma o rechaza explícitamente cada uno):
${preStr}

Audita y devuelve SOLO el JSON descrito.`;
}

// ───────────────────────────────────────────────────────────────────────────────
// Orchestrator
// ───────────────────────────────────────────────────────────────────────────────

export interface F4aProjectContext {
  projectName?: string;
  companyName?: string;
}

export type LlmCaller = (system: string, user: string) => Promise<{ text: string }>;

export interface RunF4aOptions {
  /** Inject a mock LLM caller for tests. Defaults to callGeminiFlash. */
  llmCaller?: LlmCaller;
}

export async function runF4aGapAudit(
  briefing: any,
  step25Output: any,
  ctx: F4aProjectContext = {},
  opts: RunF4aOptions = {},
): Promise<F4aOutput> {
  const t0 = Date.now();
  const briefVer = briefing?.brief_version ? String(briefing.brief_version) : null;
  const stepVer = step25Output?.build_meta?.generated_at ? String(step25Output.build_meta.generated_at) : null;

  if (!briefing || typeof briefing !== "object") {
    return emptyAudit(stepVer, briefVer, "empty_briefing");
  }
  if (!step25Output || typeof step25Output !== "object") {
    return emptyAudit(stepVer, briefVer, "empty_step25");
  }

  const v2 = briefing.business_extraction_v2 ?? null;
  const f0 = briefing._f0_signals ?? null;
  const registry = step25Output.component_registry ?? null;

  // 1. Pre-warm with deterministic detectors.
  const preDetected = runAllDetectors(briefing, registry);

  // 2. LLM call.
  const userPrompt = buildUserPrompt(v2, f0, registry, preDetected, ctx);
  const llm = opts.llmCaller ?? ((s, u) => callGeminiFlash(s, u));

  let llmResult: { text: string };
  let llmError: string | undefined;
  try {
    llmResult = await llm(F4A_SYSTEM_PROMPT, userPrompt);
  } catch (err) {
    llmError = err instanceof Error ? err.message : String(err);
    console.warn(`[F4a] LLM error: ${llmError}`);
    llmResult = { text: "" };
  }

  const parsed = parseJsonLoose(llmResult.text) || {};
  const llmGapsRaw = Array.isArray(parsed.gaps) ? parsed.gaps : [];
  const rejectedKeys = new Set<string>(
    Array.isArray(parsed.rejected_pre_detected_dedupe_keys)
      ? parsed.rejected_pre_detected_dedupe_keys.filter((k: any) => typeof k === "string")
      : [],
  );

  // 3. Merge: deterministic gaps survive unless explicitly rejected by LLM.
  const finalGaps: RegistryGap[] = [];
  let seq = 1;

  for (const pre of preDetected) {
    if (rejectedKeys.has(pre.dedupe_key)) continue;
    finalGaps.push(fromPreDetected(pre, nextGapId(seq++)));
  }

  // 4. Add LLM-only gaps (those whose suggested_component_candidate.name doesn't
  // collide with an existing pre-detected one).
  const existingCandidateNames = new Set(
    finalGaps
      .map((g) => g.suggested_component_candidate?.name?.toLowerCase().trim())
      .filter((s): s is string => !!s),
  );
  let llmAdded = 0;
  for (const raw of llmGapsRaw) {
    const id = nextGapId(seq);
    const gap = fromLlmGap(raw, id);
    if (!gap) continue;
    const candName = gap.suggested_component_candidate?.name?.toLowerCase().trim();
    if (candName && existingCandidateNames.has(candName)) continue;
    finalGaps.push(gap);
    if (candName) existingCandidateNames.add(candName);
    seq++;
    llmAdded++;
  }

  // 5. Build coverage summary.
  const coverageRaw = parsed.coverage_summary && typeof parsed.coverage_summary === "object"
    ? parsed.coverage_summary
    : {};
  const components = Array.isArray(registry?.components) ? registry.components : [];
  const coverage_summary = {
    total_signals_reviewed: Number(coverageRaw.total_signals_reviewed) || 0,
    signals_with_component: Number(coverageRaw.signals_with_component) || 0,
    signals_without_component: Number(coverageRaw.signals_without_component) || finalGaps.filter((g) => g.gap_type === "missing_component").length,
    components_reviewed: Number(coverageRaw.components_reviewed) || components.length,
    components_flagged_for_split: Number(coverageRaw.components_flagged_for_split)
      || finalGaps.filter((g) => g.gap_type === "component_should_be_split").length,
  };

  return {
    registry_gap_audit_v1: {
      audit_version: "1.0.0",
      registry_version_reviewed: stepVer,
      brief_version_reviewed: briefVer,
      gaps: finalGaps,
      coverage_summary,
    },
    audit_meta: {
      generated_at: new Date().toISOString(),
      f4a_ms: Date.now() - t0,
      deterministic_pre_detections: preDetected.length,
      llm_added_gaps: llmAdded,
      llm_rejected_pre_detections: rejectedKeys.size,
      ...(llmError ? { llm_error: llmError } : {}),
    },
  };
}
