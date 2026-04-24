/**
 * f0-signal-preservation.ts — Subfase F0 del Pipeline v2
 *
 * Preserva señales de negocio del raw transcript ANTES de que el filtro
 * (transcript filter) descarte contenido potencialmente útil.
 *
 * Diseño:
 * - 1 sola llamada al LLM sobre el raw completo (no se hace una segunda
 *   llamada sobre contenido descartado para mantener coste/latencia bajo).
 * - El campo `discarded_content_with_business_signal_candidates` representa
 *   "frases laterales que un filtro probablemente descartaría pero contienen
 *   señal de negocio". No afirma que fueron descartadas realmente.
 * - Reutiliza `callGeminiFlash` (JSON mode) — NO crea cliente Gemini nuevo.
 * - En cualquier error devuelve `emptyF0Result()` para no romper el pipeline.
 *
 * Ajuste 4 final: límites duros aplicados post-parse para evitar inflar
 * `output_data` en `project_wizard_steps`.
 */

import { callGeminiFlash } from "./llm-helpers.ts";

// ── Tipos ─────────────────────────────────────────────────────────────

export interface GoldenQuote {
  text: string;
  reason?: string;
}

export interface QuantitativeSignal {
  text: string;
  metric_kind?: string; // "revenue" | "count" | "duration" | "ratio" | "other"
}

export interface NamedEntity {
  name: string;
  kind?: string; // "person" | "company" | "tool" | "place" | "other"
}

export interface SignalPreservationResult {
  version: "1.0.0";
  golden_quotes: GoldenQuote[];
  discarded_content_with_business_signal_candidates: GoldenQuote[];
  quantitative_signals: QuantitativeSignal[];
  named_entities: NamedEntity[];
  external_sources_mentioned: string[];
  data_assets_mentioned: string[];
  business_catalyst_candidates: string[];
  economic_pain_candidates: string[];
  ambiguity_notes: string[];
  _meta?: {
    generated: boolean;
    error?: string;
    truncated_fields?: string[];
  };
}

// ── Límites duros ─────────────────────────────────────────────────────

const LIMITS = {
  golden_quotes: 25,
  quote_text_chars: 500,
  discarded_content: 20,
  named_entities: 50,
  quantitative_signals: 30,
  external_sources: 20,
  data_assets: 20,
  business_catalysts: 15,
  economic_pains: 15,
  ambiguity_notes: 10,
  ambiguity_text_chars: 300,
};

export function emptyF0Result(error?: string): SignalPreservationResult {
  return {
    version: "1.0.0",
    golden_quotes: [],
    discarded_content_with_business_signal_candidates: [],
    quantitative_signals: [],
    named_entities: [],
    external_sources_mentioned: [],
    data_assets_mentioned: [],
    business_catalyst_candidates: [],
    economic_pain_candidates: [],
    ambiguity_notes: [],
    _meta: { generated: false, error },
  };
}

function truncateString(s: unknown, maxChars: number): string {
  if (typeof s !== "string") return "";
  if (s.length <= maxChars) return s;
  return s.substring(0, maxChars - 1) + "…";
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function clampQuotes(arr: unknown, maxItems: number, maxChars: number): GoldenQuote[] {
  return asArray<any>(arr)
    .slice(0, maxItems)
    .map((q) => {
      if (typeof q === "string") {
        return { text: truncateString(q, maxChars) };
      }
      return {
        text: truncateString(q?.text ?? q?.quote ?? "", maxChars),
        reason: typeof q?.reason === "string" ? truncateString(q.reason, 200) : undefined,
      };
    })
    .filter((q) => q.text.length > 0);
}

function clampStringArray(arr: unknown, maxItems: number, maxChars = 200): string[] {
  return asArray<unknown>(arr)
    .map((x) => (typeof x === "string" ? x : (x as any)?.text ?? (x as any)?.name ?? ""))
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .map((s) => truncateString(s, maxChars))
    .slice(0, maxItems);
}

/**
 * Aplica límites duros y normaliza la forma del resultado F0.
 * Pure function — exportada para testabilidad. NO cambia comportamiento runtime.
 */
export function clampF0Result(raw: any): SignalPreservationResult {
  const truncated: string[] = [];
  const golden = asArray(raw?.golden_quotes);
  const discarded = asArray(raw?.discarded_content_with_business_signal_candidates);
  const entities = asArray(raw?.named_entities);
  const quants = asArray(raw?.quantitative_signals);

  if (golden.length > LIMITS.golden_quotes) truncated.push("golden_quotes");
  if (discarded.length > LIMITS.discarded_content) truncated.push("discarded_content_*");
  if (entities.length > LIMITS.named_entities) truncated.push("named_entities");
  if (quants.length > LIMITS.quantitative_signals) truncated.push("quantitative_signals");

  return {
    version: "1.0.0",
    golden_quotes: clampQuotes(raw?.golden_quotes, LIMITS.golden_quotes, LIMITS.quote_text_chars),
    discarded_content_with_business_signal_candidates: clampQuotes(
      raw?.discarded_content_with_business_signal_candidates,
      LIMITS.discarded_content,
      LIMITS.quote_text_chars,
    ),
    quantitative_signals: asArray<any>(raw?.quantitative_signals)
      .slice(0, LIMITS.quantitative_signals)
      .map((q) => ({
        text: truncateString(typeof q === "string" ? q : q?.text, 300),
        metric_kind: typeof q?.metric_kind === "string" ? q.metric_kind : undefined,
      }))
      .filter((q) => q.text.length > 0),
    named_entities: asArray<any>(raw?.named_entities)
      .slice(0, LIMITS.named_entities)
      .map((e) => ({
        name: truncateString(typeof e === "string" ? e : e?.name, 150),
        kind: typeof e?.kind === "string" ? e.kind : undefined,
      }))
      .filter((e) => e.name.length > 0),
    external_sources_mentioned: clampStringArray(raw?.external_sources_mentioned, LIMITS.external_sources),
    data_assets_mentioned: clampStringArray(raw?.data_assets_mentioned, LIMITS.data_assets),
    business_catalyst_candidates: clampStringArray(raw?.business_catalyst_candidates, LIMITS.business_catalysts, 300),
    economic_pain_candidates: clampStringArray(raw?.economic_pain_candidates, LIMITS.economic_pains, 300),
    ambiguity_notes: clampStringArray(raw?.ambiguity_notes, LIMITS.ambiguity_notes, LIMITS.ambiguity_text_chars),
    _meta: {
      generated: true,
      truncated_fields: truncated.length > 0 ? truncated : undefined,
    },
  };
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
      try {
        return JSON.parse(cleaned.substring(first, last + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ── Prompt ────────────────────────────────────────────────────────────

const F0_SYSTEM_PROMPT = `Eres un arquitecto IA-nativo senior actuando como CAPTOR DE SEÑAL.

Tu única misión en esta fase (F0) es preservar señales de negocio del material RAW antes de que cualquier filtro de transcripción descarte contenido. NO estás aquí para resumir, ni para diseñar arquitectura, ni para clasificar componentes.

REGLAS ANTI-PÉRDIDA DE SEÑAL LATERAL:
1. Las frases LATERALES (comentarios al pasar, anécdotas, "por cierto…", "lo que más nos mueve es…") suelen contener la señal más valiosa. Captúralas literalmente.
2. Cifras concretas (€, %, horas, unidades, plazos) son sagradas — extráelas tal cual aparecen.
3. Activos de datos infrautilizados (Excel artesanal, grabaciones, logs, históricos) son candidatos a knowledge_assets — anótalos aunque el cliente no les dé importancia.
4. Catalysts de negocio (eventos que mueven la decisión: "muertes", "auditorías", "contratos que vencen", "campañas") son críticos.
5. Dolores económicos cuantificables ("perdemos X al mes", "tardamos N horas") van aparte de los dolores cualitativos.
6. Las menciones a fuentes externas (regulación, competidores, mercado) son señales de contexto.
7. NO interpretes. NO inventes. NO infieras. SOLO captura lo que está en el texto.
8. Si una frase aparece de pasada pero podría ser descartada por un filtro de transcripción posterior (porque suena conversacional o lateral), inclúyela en discarded_content_with_business_signal_candidates.

Devuelve SOLO JSON válido con esta estructura EXACTA:
{
  "version": "1.0.0",
  "golden_quotes": [{"text": "cita literal", "reason": "por qué importa (1 frase)"}],
  "discarded_content_with_business_signal_candidates": [{"text": "frase lateral con señal", "reason": "por qué un filtro la descartaría"}],
  "quantitative_signals": [{"text": "cifra literal en contexto", "metric_kind": "revenue|count|duration|ratio|other"}],
  "named_entities": [{"name": "nombre", "kind": "person|company|tool|place|other"}],
  "external_sources_mentioned": ["regulación X", "competidor Y"],
  "data_assets_mentioned": ["Excel de cierres", "3000 llamadas grabadas"],
  "business_catalyst_candidates": ["evento o disparador de decisión"],
  "economic_pain_candidates": ["dolor con magnitud económica si la hay"],
  "ambiguity_notes": ["cosas que no quedan claras y conviene marcar"]
}

Sin markdown, sin backticks, sin explicaciones fuera del JSON.`;

// ── API pública ───────────────────────────────────────────────────────

export async function runF0SignalPreservation(
  rawContent: string,
  projectContext?: { projectName?: string; companyName?: string; projectType?: string },
): Promise<SignalPreservationResult> {
  if (!rawContent || rawContent.trim().length === 0) {
    return emptyF0Result("empty_input");
  }

  // Hard cap input size to protect prompt budget (raw can be huge).
  const MAX_INPUT_CHARS = 120_000;
  const inputClipped = rawContent.length > MAX_INPUT_CHARS
    ? rawContent.substring(0, MAX_INPUT_CHARS) + "\n\n[...input truncado por longitud...]"
    : rawContent;

  const ctxLine = projectContext
    ? `Proyecto: ${projectContext.projectName ?? "?"} | Cliente: ${projectContext.companyName ?? "?"} | Tipo: ${projectContext.projectType ?? "?"}`
    : "Proyecto: (sin contexto)";

  const userPrompt = `${ctxLine}

MATERIAL RAW (sin filtrar):
${inputClipped}

Extrae señal según las reglas. Devuelve SOLO el JSON.`;

  try {
    const result = await callGeminiFlash(F0_SYSTEM_PROMPT, userPrompt);
    const parsed = parseJsonLoose(result.text);
    if (!parsed || typeof parsed !== "object") {
      console.warn("[F0] JSON parse failed — returning empty F0 result.");
      return emptyF0Result("parse_failed");
    }
    return clampF0Result(parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[F0] LLM call failed: ${msg}`);
    return emptyF0Result(msg);
  }
}

/** Renderiza el bloque F0_SIGNALS para inyectar en el prompt F1. */
export function renderF0SignalsBlock(f0: SignalPreservationResult): string {
  if (!f0._meta?.generated) {
    return "F0_SIGNALS: (no disponibles — usa solo el material principal)";
  }
  const parts: string[] = ["F0_SIGNALS (señales preservadas del raw — úsalas para no perder contexto):"];
  if (f0.golden_quotes.length) {
    parts.push("- Golden quotes:");
    for (const q of f0.golden_quotes) parts.push(`  · "${q.text}"${q.reason ? ` — ${q.reason}` : ""}`);
  }
  if (f0.discarded_content_with_business_signal_candidates.length) {
    parts.push("- Contenido lateral con señal de negocio (no descartar):");
    for (const q of f0.discarded_content_with_business_signal_candidates) parts.push(`  · "${q.text}"`);
  }
  if (f0.quantitative_signals.length) {
    parts.push("- Cifras concretas:");
    for (const q of f0.quantitative_signals) parts.push(`  · ${q.text}${q.metric_kind ? ` [${q.metric_kind}]` : ""}`);
  }
  if (f0.data_assets_mentioned.length) {
    parts.push(`- Data assets mencionados: ${f0.data_assets_mentioned.join("; ")}`);
  }
  if (f0.business_catalyst_candidates.length) {
    parts.push(`- Business catalysts candidatos: ${f0.business_catalyst_candidates.join("; ")}`);
  }
  if (f0.economic_pain_candidates.length) {
    parts.push(`- Dolores económicos candidatos: ${f0.economic_pain_candidates.join("; ")}`);
  }
  if (f0.external_sources_mentioned.length) {
    parts.push(`- Fuentes externas: ${f0.external_sources_mentioned.join("; ")}`);
  }
  if (f0.named_entities.length) {
    parts.push(`- Entidades: ${f0.named_entities.map((e) => `${e.name}${e.kind ? `(${e.kind})` : ""}`).join("; ")}`);
  }
  if (f0.ambiguity_notes.length) {
    parts.push("- Ambigüedades a marcar como open_questions si no se resuelven en el material.");
  }
  return parts.join("\n");
}
