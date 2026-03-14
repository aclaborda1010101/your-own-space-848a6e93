/**
 * sanitizer.ts — Hard sanitization for client-facing exports
 * Strips ALL internal metadata, debug info, and contamination flags.
 * Created: 2026-03-14
 */

/** Keys to strip from any output before client export */
const INTERNAL_KEYS = new Set([
  // Filter/debug metadata
  "_was_filtered",
  "_filtered_content",
  "parse_error",
  "raw_text",
  // Validation/contract metadata
  "contract_violation",
  "violation_count",
  "violation_details",
  "phase_contamination_detected",
  "duplicated_from",
  "contamination_action",
  "validation_ran",
  "validation_timestamp",
  "total_violations",
  "technical_density_too_low",
  "narrative_opening_too_dense",
  "commercial_term_count",
  "technical_sections_found",
  "missing_technical",
  "missing_sections",
  "mvp_scope_risk",
  "mvp_dependency_risk",
  // Gating metadata
  "generated_from_steps",
  "approved_inputs_only",
  "contract_version",
  "gated_out_steps",
  // Cost/token data
  "cost_usd",
  "tokens_input",
  "tokens_output",
  "token_costs",
  // Internal views
  "internal_view",
  "document_internal",
  "diff_summary",
]);

/**
 * Deep-strip internal keys from any object.
 * Returns a clean copy safe for client export.
 */
export function sanitizeClientOutput(output: any): any {
  if (output === null || output === undefined) return output;

  if (typeof output === "string") {
    return sanitizeClientText(output);
  }

  if (Array.isArray(output)) {
    return output.map(item => sanitizeClientOutput(item));
  }

  if (typeof output === "object") {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(output)) {
      if (INTERNAL_KEYS.has(key)) continue;
      cleaned[key] = sanitizeClientOutput(value);
    }
    return cleaned;
  }

  return output;
}

/**
 * Strip internal content from text strings.
 * Removes [[INTERNAL_ONLY]] blocks, changelogs, debug notes, and cost traces.
 */
export function sanitizeClientText(text: string): string {
  if (!text || typeof text !== "string") return text || "";

  let t = text;

  // 1. Strip [[INTERNAL_ONLY]]...[[/INTERNAL_ONLY]] blocks
  t = t.replace(/\[\[INTERNAL_ONLY\]\][\s\S]*?\[\[\/INTERNAL_ONLY\]\]/g, "");

  // 2. Autoclose unclosed [[INTERNAL_ONLY]] and strip to end
  if (t.includes("[[INTERNAL_ONLY]]")) {
    t = t.replace(/\[\[INTERNAL_ONLY\]\][\s\S]*$/g, "");
  }

  // 3. Strip changelog sections
  t = t.replace(/\n---\s*\n+##\s*CHANGELOG[\s\S]*$/i, "");

  // 4. Strip [[NO_APLICA:*]] tags
  t = t.replace(/\[\[NO_APLICA:[^\]]*\]\]/g, "");

  // 5. Strip debug/propagation notes
  t = t.replace(/\[\[DEBUG:[^\]]*\]\]/g, "");
  t = t.replace(/\[\[PROPAGATION:[^\]]*\]\]/g, "");

  // 6. Strip cost/token references that leaked into text
  t = t.replace(/cost_usd\s*[:=]\s*[\d.]+/gi, "");
  t = t.replace(/tokens?[_\s](?:input|output)\s*[:=]\s*[\d,]+/gi, "");

  // 7. Clean up excess whitespace from removals
  t = t.replace(/\n{4,}/g, "\n\n\n");

  return t.trim();
}
