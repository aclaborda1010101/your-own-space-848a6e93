/**
 * brief-normalizer.ts — Post-extraction cleanup layer.
 *
 * Takes a raw `business_extraction_v2` briefing and applies deterministic
 * normalizations + ONE optional LLM call for language translation.
 *
 * Steps (in order):
 *   1. Naming split (founder vs company vs product).
 *   2. Sector token cleanup (e.g. "retail" → "real estate off-market").
 *   3. Language normalization (EN → ES, single LLM batch).
 *   4. Semantic dedup of solution candidates (deterministic stem-based).
 *   5. Compliance flag expansion (rule-based inference).
 *   6. Quote validator for numeric signals (marks _unverified_number).
 *
 * Each step appends to `briefing._normalization_log`.
 */

import { callGeminiFlash } from "./llm-helpers.ts";
import { checkNamingCollision } from "../_shared/component-registry-contract.ts";

// ── Types ────────────────────────────────────────────────────────────

export interface CanonicalComponent {
  canonical: string;
  matchTokens: string[];
  /**
   * Optional inline description used when this component must be
   * INJECTED into the brief because it was missing from extraction.
   */
  description?: string;
}

export interface ManualReviewAlert {
  signal: string;
  question: string;
  source?: string;
}

export interface CanonicalCatalyst {
  title: string;
  description?: string;
}

export interface NormalizationContext {
  projectName: string;
  companyName: string;
  founderName?: string;
  productName?: string;
  /**
   * Authoritative override for client_company_name. Used when the
   * extraction picked up a person name and `companyName` from the DB
   * is also a person name (no real company on record).
   */
  companyNameOverride?: string;
  sectorHint?: string;
  language?: "es" | "en";
  /**
   * Optional canonical component list. When provided, REPLACES the default
   * generic groups so the dedup step uses the project-specific taxonomy.
   */
  canonicalComponents?: CanonicalComponent[];
  /**
   * Pairs of canonical names that MUST NOT be fused even when token
   * overlap is high. Each pair forbids merging the two component names.
   */
  mutexGroups?: Array<[string, string]>;
  /**
   * Catalysts that the brief MUST mention even if the LLM missed them.
   * Inserted into business_catalysts with `_inferred_by: "normalizer_catalyst_v1"`.
   */
  canonicalCatalysts?: CanonicalCatalyst[];
  /**
   * Optional list of topic regexes whose mentions should be stripped from
   * the brief because they belong to other domains.
   */
  forbiddenTopics?: RegExp[];
  /**
   * Optional manual review alerts to attach.
   */
  manualReviewAlerts?: ManualReviewAlert[];
}

export interface NormalizationChange {
  type: string;
  field?: string;
  before?: any;
  after?: any;
  reason?: string;
}

export interface NormalizationResult {
  briefing: any;
  changes: NormalizationChange[];
  llmCalled: boolean;
  tokensInput: number;
  tokensOutput: number;
}

// ── 1. Naming split ──────────────────────────────────────────────────

// Acepta: "Nombre Apellido", "Nombre Apellido Apellido", "Nombre de la Cruz",
// "Juan-Carlos Pérez", "María José García-López".
const PERSON_NAME_RE = /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ-]+(\s(?:de|del|la|las|los|y|van|von|da|du|de la|de los)?\s?[A-ZÁÉÍÓÚÑ][a-záéíóúñ-]+){1,3}$/;
const COMPANY_SUFFIX_RE = /\b(S\.?L\.?U?|S\.?A\.?U?|SLU|SAU|Ltd|LLC|Inc|GmbH|AG|BV|S\.?r\.?l\.?|Sociedad|Limited|Corp|Corporation|Group|Holdings?|Studios?|Lab(?:s)?|Tech)\b/i;
const PERSON_TITLE_PREFIX_RE = /^(Sr\.?|Sra\.?|Don|Dña\.?|Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Prof\.?)\s+/i;

function looksLikePersonName(s: string): boolean {
  if (!s || typeof s !== "string") return false;
  let trimmed = s.trim().replace(PERSON_TITLE_PREFIX_RE, "");
  if (COMPANY_SUFFIX_RE.test(trimmed)) return false;
  // Si contiene caracteres típicos de empresa, descartar.
  if (/[&@#%]|\d/.test(trimmed)) return false;
  return PERSON_NAME_RE.test(trimmed);
}

/**
 * Normaliza una cadena para comparación de aliases:
 * - lower-case, sin diacríticos, sin signos, espacios colapsados.
 */
function normForCompare(s: string): string {
  if (!s || typeof s !== "string") return "";
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/**
 * Distancia de Levenshtein simple (sin librería externa). Sólo para
 * cadenas cortas (nombres de proyecto/producto), suficientemente rápido.
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[] = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) dp[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}

/**
 * Decide si `candidate` parece una variante del nombre canónico (typo,
 * mayúsculas, transcripción defectuosa). NO marca como alias cadenas
 * totalmente distintas (p. ej. nombre de persona).
 */
function looksLikeAliasOf(candidate: string, canonical: string): boolean {
  const a = normForCompare(candidate);
  const b = normForCompare(canonical);
  if (!a || !b) return false;
  if (a === b) return false; // exacto, no es alias
  if (a.length < 3 || b.length < 3) return false;
  // Substring fuerte (Aflu ⊂ Afflux normalizado)
  if (a.includes(b) || b.includes(a)) return true;
  // Distancia ≤ 2 en cadenas cortas
  const lenMin = Math.min(a.length, b.length);
  const lenMax = Math.max(a.length, b.length);
  if (lenMax - lenMin > 3) return false;
  return levenshtein(a, b) <= 2;
}

/**
 * Escanea el briefing crudo (campos text-heavy) buscando variantes del
 * `projectName` canónico para construir `detected_aliases[]`. Sólo añade
 * aliases que cumplen `looksLikeAliasOf`. Limita a 8 entradas.
 */
function collectDetectedAliases(briefing: any, projectName: string, seedAliases: string[] = []): string[] {
  const found = new Set<string>();
  // Semillas (valores que ya existían antes de ser sobrescritos por
  // projectName: client_company_name, proposed_product_name extraídos).
  for (const s of seedAliases) {
    if (typeof s !== "string") continue;
    const t = s.trim();
    if (t && looksLikeAliasOf(t, projectName)) found.add(t);
  }
  const v2 = briefing?.business_extraction_v2 || {};
  const haystacks: string[] = [];
  // Strings cortas en campos típicos donde aparece el naming.
  const SHORT_FIELDS = ["title", "context", "primary_goal"];
  if (v2.business_model_summary && typeof v2.business_model_summary === "object") {
    for (const k of SHORT_FIELDS) {
      const val = v2.business_model_summary[k];
      if (typeof val === "string") haystacks.push(val);
    }
  }
  if (typeof v2.executive_summary === "string") haystacks.push(v2.executive_summary);
  if (typeof v2.project_title === "string") haystacks.push(v2.project_title);
  // source_quotes suele tener cadenas literales de la transcripción.
  if (Array.isArray(v2.source_quotes)) {
    for (const q of v2.source_quotes.slice(0, 50)) {
      if (typeof q === "string") haystacks.push(q);
      else if (q && typeof q === "object" && typeof q.quote === "string") haystacks.push(q.quote);
    }
  }
  // Tokenizamos sólo palabras de 3-15 chars (filtra ruido).
  const TOKEN_RE = /\b[A-Za-zÀ-ÿ][A-Za-z0-9À-ÿ.-]{2,14}\b/g;
  for (const text of haystacks) {
    const matches = text.match(TOKEN_RE);
    if (!matches) continue;
    for (const tok of matches) {
      if (looksLikeAliasOf(tok, projectName)) found.add(tok);
      if (found.size >= 32) break; // safety
    }
    if (found.size >= 32) break;
  }
  // Cap final a 8 entradas, ordenadas por frecuencia aprox (set ya dedupea).
  return Array.from(found).slice(0, 8);
}

function applyNamingSplit(briefing: any, ctx: NormalizationContext, changes: NormalizationChange[]) {
  const v2 = briefing?.business_extraction_v2;
  if (!v2 || typeof v2 !== "object") return;

  if (!v2.client_naming_check || typeof v2.client_naming_check !== "object") {
    v2.client_naming_check = {};
  }
  const cnc = v2.client_naming_check;
  const before = { ...cnc };

  // Snapshot de los valores ANTES de tocar nada — alimentan detected_aliases.
  const seedAliasesFromExtraction: string[] = [];
  if (typeof cnc.proposed_product_name === "string") seedAliasesFromExtraction.push(cnc.proposed_product_name);
  if (typeof cnc.client_company_name === "string") seedAliasesFromExtraction.push(cnc.client_company_name);
  if (Array.isArray(cnc.detected_aliases)) {
    for (const a of cnc.detected_aliases) if (typeof a === "string") seedAliasesFromExtraction.push(a);
  }

  // ── Authoritative product/project name ───────────────────────────────
  // REGLA DE ORO: lo que el usuario escribe en la ficha del proyecto
  // (`ctx.projectName`) es la fuente de verdad para `proposed_product_name`.
  // `ctx.productName` solo se usa si el usuario lo escribió manualmente
  // distinto de projectName.
  const userProjectName = (ctx.projectName || "").trim();
  const userProductName = (ctx.productName || "").trim();
  const canonicalProduct = userProductName || userProjectName;

  // Decide the AUTHORITATIVE company name once, with priority:
  //   1. ctx.companyNameOverride (explicit, never wrong)
  //   2. ctx.companyName if it does NOT look like a person name
  //   3. canonicalProduct (último recurso para que NUNCA quede vacío
  //      o aparezca un nombre de persona como cliente)
  //   4. "[POR CONFIRMAR]"
  const ctxCompanyIsPerson =
    typeof ctx.companyName === "string" && looksLikePersonName(ctx.companyName);
  const authoritativeCompany =
    (ctx.companyNameOverride && ctx.companyNameOverride.trim()) ||
    (ctx.companyName && !ctxCompanyIsPerson ? ctx.companyName.trim() : "") ||
    canonicalProduct ||
    "[POR CONFIRMAR]";

  // 1. If extracted company is a person name, demote to founder.
  if (typeof cnc.client_company_name === "string" && looksLikePersonName(cnc.client_company_name)) {
    const personName = cnc.client_company_name.trim();
    if (!cnc.founder_or_decision_maker) {
      cnc.founder_or_decision_maker = personName;
    }
    cnc.client_company_name = authoritativeCompany;
    changes.push({
      type: "naming_split",
      field: "client_company_name",
      before: personName,
      after: cnc.client_company_name,
      reason: `"${personName}" parecía un nombre de persona; movido a founder_or_decision_maker.`,
    });
  }

  // 2. If ctx supplies a company override, ALWAYS apply it (last word).
  if (ctx.companyNameOverride && ctx.companyNameOverride.trim()) {
    const desired = ctx.companyNameOverride.trim();
    if (cnc.client_company_name !== desired) {
      const prev = cnc.client_company_name;
      cnc.client_company_name = desired;
      changes.push({
        type: "naming_split",
        field: "client_company_name",
        before: prev,
        after: desired,
        reason: "Aplicado companyNameOverride autoritario desde contexto.",
      });
    }
  }

  // 3. If the company AND founder ended up identical (the original tie bug),
  //    fall back to the authoritative company.
  if (
    cnc.client_company_name &&
    cnc.founder_or_decision_maker &&
    cnc.client_company_name === cnc.founder_or_decision_maker &&
    cnc.client_company_name !== authoritativeCompany
  ) {
    const prev = cnc.client_company_name;
    cnc.client_company_name = authoritativeCompany;
    changes.push({
      type: "naming_split",
      field: "client_company_name",
      before: prev,
      after: authoritativeCompany,
      reason: "Empate company == founder; aplicado nombre autoritario.",
    });
  }

  // 4. If founder is missing but ctx has a person-named companyName, use that.
  if (!cnc.founder_or_decision_maker) {
    if (ctx.founderName) {
      cnc.founder_or_decision_maker = ctx.founderName;
      changes.push({
        type: "naming_split",
        field: "founder_or_decision_maker",
        before: null,
        after: ctx.founderName,
        reason: "Aplicado founderName desde contexto.",
      });
    } else if (ctxCompanyIsPerson && ctx.companyName) {
      cnc.founder_or_decision_maker = ctx.companyName.trim();
      changes.push({
        type: "naming_split",
        field: "founder_or_decision_maker",
        before: null,
        after: ctx.companyName.trim(),
        reason: "ctx.companyName era persona; promovido a founder_or_decision_maker.",
      });
    }
  }

  // 4b. Tras todas las reglas, si client_company_name SIGUE pareciendo
  //     persona o sigue vacío y NO hay companyNameOverride, fijar al
  //     producto canónico (regla del usuario: "Cliente / empresa: AFFLUX"
  //     cuando no sepamos cuál es la empresa real).
  if (
    !ctx.companyNameOverride &&
    canonicalProduct &&
    (
      !cnc.client_company_name ||
      (typeof cnc.client_company_name === "string" && cnc.client_company_name.trim().length === 0) ||
      looksLikePersonName(cnc.client_company_name)
    )
  ) {
    const prev = cnc.client_company_name;
    cnc.client_company_name = canonicalProduct;
    changes.push({
      type: "naming_split",
      field: "client_company_name",
      before: prev,
      after: canonicalProduct,
      reason: "client_company_name vacío o persona; fallback al producto canónico.",
    });
  }

  // 5. Product name: REGLA DE ORO. `canonicalProduct` (derivado de
  //    ctx.projectName/ctx.productName) sobrescribe SIEMPRE cualquier
  //    valor que haya puesto el LLM. La única excepción es si el usuario
  //    no pasó ningún nombre — en cuyo caso respetamos lo que haya.
  if (canonicalProduct) {
    if (cnc.proposed_product_name !== canonicalProduct) {
      const prev = cnc.proposed_product_name;
      cnc.proposed_product_name = canonicalProduct;
      cnc.canonical_source = "user_project_input";
      changes.push({
        type: "naming_split",
        field: "proposed_product_name",
        before: prev,
        after: canonicalProduct,
        reason: "Forzado al projectName/productName del usuario (fuente canónica).",
      });
    } else {
      cnc.canonical_source = "user_project_input";
    }
  } else if (
    !cnc.proposed_product_name ||
    (typeof cnc.proposed_product_name === "string" && cnc.proposed_product_name.trim().length === 0)
  ) {
    cnc.proposed_product_name = null;
  }

  // 5b. Detected aliases: variantes detectadas en la transcripción que
  //     NO coinciden con el nombre canónico. Solo pueblan si tenemos
  //     un canonical contra el que comparar.
  if (canonicalProduct) {
    const aliases = collectDetectedAliases(briefing, canonicalProduct, seedAliasesFromExtraction);
    // Filtramos: nada de aliases que coincidan EXACTAMENTE con el canonical
    // (case-insensitive, sin signos) — eso es el propio nombre.
    const canonNorm = normForCompare(canonicalProduct);
    const filtered = aliases.filter((a) => normForCompare(a) !== canonNorm);
    if (filtered.length > 0) {
      const prevAliases = Array.isArray(cnc.detected_aliases) ? cnc.detected_aliases : [];
      const merged = Array.from(new Set([...prevAliases.filter((s: any) => typeof s === "string"), ...filtered])).slice(0, 8);
      cnc.detected_aliases = merged;
      if (JSON.stringify(prevAliases) !== JSON.stringify(merged)) {
        changes.push({
          type: "naming_split",
          field: "detected_aliases",
          before: prevAliases,
          after: merged,
          reason: "Variantes detectadas en transcripción registradas como aliases.",
        });
      }
    } else if (!Array.isArray(cnc.detected_aliases)) {
      cnc.detected_aliases = [];
    }
  }

  // 6. Re-check collision.
  if (cnc.client_company_name && cnc.proposed_product_name) {
    try {
      const collision = checkNamingCollision(cnc.client_company_name, cnc.proposed_product_name);
      cnc.collision_detected = collision.detected;
      if (collision.reason) cnc.collision_reason = collision.reason;
    } catch {
      cnc.collision_detected = false;
    }
  } else {
    cnc.collision_detected = false;
  }

  // Diff log (compact).
  if (JSON.stringify(before) !== JSON.stringify(cnc)) {
    changes.push({ type: "naming_check_updated", before, after: { ...cnc } });
  }
}

// ── 2. Sector cleanup ────────────────────────────────────────────────

const SECTOR_REPLACEMENTS: Array<{ from: RegExp; to: string; label: string }> = [
  { from: /\bretail\s+data\b/gi, to: "real estate data", label: "retail data → real estate data" },
  { from: /\bcomercio\s+minorista\b/gi, to: "inversión inmobiliaria", label: "comercio minorista → inversión inmobiliaria" },
  { from: /\bretail\b/gi, to: "real estate off-market", label: "retail → real estate off-market" },
];

// Patterns that strongly indicate off-topic content (other domains entirely).
// When matched in a string field of a list item, the entire item is removed.
const DEFAULT_FORBIDDEN_TOPICS: RegExp[] = [
  /\b(weather|pollen|allergy\s+medicine|allergy\s+season|hay\s+fever)\b/i,
  /\b(clima|polen|alergia|fiebre\s+del\s+heno)\b/i,
  /\bmedicamento(s)?\s+(de\s+)?alergia\b/i,
];

function applySectorCleanup(node: any, changes: NormalizationChange[], path: string[] = []): any {
  if (typeof node === "string") {
    let out = node;
    for (const r of SECTOR_REPLACEMENTS) {
      // Skip URLs / IDs (rough heuristic: contains :// or COMP-).
      if (/:\/\//.test(out) || /COMP-\d+/.test(out)) continue;
      if (r.from.test(out)) {
        const before = out;
        out = out.replace(r.from, r.to);
        if (before !== out) {
          changes.push({
            type: "sector_cleanup",
            field: path.join("."),
            before,
            after: out,
            reason: r.label,
          });
        }
      }
    }
    return out;
  }
  if (Array.isArray(node)) {
    return node.map((item, i) => applySectorCleanup(item, changes, [...path, String(i)]));
  }
  if (node && typeof node === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith("_")) {
        // Don't mutate internal metadata strings.
        out[k] = v;
        continue;
      }
      out[k] = applySectorCleanup(v, changes, [...path, k]);
    }
    return out;
  }
  return node;
}

function itemMatchesForbidden(item: any, patterns: RegExp[]): RegExp | null {
  if (!item) return null;
  const blob = typeof item === "string"
    ? item
    : Object.entries(item)
        .filter(([k]) => !k.startsWith("_"))
        .map(([_, v]) => (typeof v === "string" ? v : ""))
        .join(" ");
  for (const re of patterns) {
    if (re.test(blob)) return re;
  }
  return null;
}

function applyForbiddenTopicsFilter(briefing: any, ctx: NormalizationContext, changes: NormalizationChange[]) {
  const v2 = briefing?.business_extraction_v2;
  if (!v2) return;
  const patterns = [...DEFAULT_FORBIDDEN_TOPICS, ...(ctx.forbiddenTopics || [])];
  const FIELDS = [
    "observed_facts", "business_catalysts", "underutilized_data_assets",
    "quantified_economic_pains", "decision_points", "client_requested_items",
    "inferred_needs", "ai_native_opportunity_signals", "external_data_sources_mentioned",
    "constraints_and_risks", "open_questions",
  ];
  for (const field of FIELDS) {
    const arr = v2[field];
    if (!Array.isArray(arr)) continue;
    const kept: any[] = [];
    for (const item of arr) {
      const hit = itemMatchesForbidden(item, patterns);
      if (hit) {
        changes.push({
          type: "forbidden_topic_removed",
          field,
          before: typeof item === "string" ? item : (item.title || item.description || JSON.stringify(item).slice(0, 80)),
          reason: `Tema fuera de alcance (${hit.source}).`,
        });
      } else {
        kept.push(item);
      }
    }
    v2[field] = kept;
  }
}

// ── 3. Language normalization (LLM) ──────────────────────────────────

const EN_HINT_WORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "have", "will",
  "system", "data", "client", "based", "process", "management", "business",
  "platform", "agent", "tool", "tools", "knowledge", "support", "service",
  "automation", "workflow", "extensive", "potential", "rate", "response",
  "analysis", "managing", "unified", "custom", "powered", "generation",
  "marketing", "content", "copywriting", "guidance", "negotiation", "coaching",
  "recorded", "calls", "lost", "opportunities", "qualification", "prioritization",
  "graph", "historical", "record", "building", "deal", "owner", "owners",
  "lead", "leads", "automated", "categorization", "profiling", "estate",
  "real", "off-market", "specific", "what", "which", "should", "collected",
  "contain", "valuable", "information", "categorize", "interactions", "acknowledges",
  "expresses", "desire", "wants", "current", "increase", "find", "understand",
  "people", "buying", "crossing", "goal", "raise", "level", "team", "better",
  "closing", "deals", "depends", "need", "standardize", "follow-up", "develop",
  "listen", "boring", "repetitive", "efficiency", "resources", "preparatory",
]);

const EN_PHRASE_RE = /\b(AI can|Develop an AI|The client acknowledges|Carlos expresses|Aflu has collected|CRM data|Call recordings|Recorded Calls|Lost opportunities|Knowledge graph|Automated lead|What are the specific|The current process|There is a desire|The goal is|The effectiveness of|The client wants|Carlos wants)\b/i;

// Short English bridge fragments. ANY single match flags the string as
// requiring translation, regardless of overall ratio.
const EN_FRAGMENT_RE = /\b(data on |suggests |represents |implying |implies |is currently|are currently|is available|are available|valuable insights|in order to|such as|which is|which are|contain |contains |are not fully|is not fully|currently not|emails over|years of|birth dates|family contacts|personalized outreach|off-market|data source|leveraged by|fully utilized|fully leveraged|further utilized|structured data|potential clients|negotiation strategies|conflict resolution|contact history|rich dataset|sales efforts|to identify|to be further|the possibility of|monitoring and analyzing|to improve conversion|but not fully|cataloged or utilized|sales|owners and properties|and their|criterion|over the years|on a structured|based on the|all the|by AI|with the|by the LLM|of the system|out of)\b/i;

function hasEnglishFragment(s: string): boolean {
  return EN_FRAGMENT_RE.test(s);
}

function isLikelyEnglish(s: string): boolean {
  if (!s || typeof s !== "string") return false;
  if (EN_PHRASE_RE.test(s)) return true;
  if (hasEnglishFragment(s)) return true;
  const words = s.toLowerCase().match(/[a-záéíóúñ]+/gi) || [];
  if (words.length < 3) return false;
  const enHits = words.filter((w) => EN_HINT_WORDS.has(w)).length;
  return enHits / words.length > 0.18;
}

interface TranslateItem {
  id: string;
  text: string;
}

function collectTranslatableStrings(briefing: any): TranslateItem[] {
  const items: TranslateItem[] = [];
  const v2 = briefing?.business_extraction_v2;
  if (!v2) return items;

  const FIELDS_TO_SCAN = [
    "observed_facts", "business_catalysts", "underutilized_data_assets",
    "quantified_economic_pains", "decision_points", "client_requested_items",
    "inferred_needs", "ai_native_opportunity_signals", "constraints_and_risks",
    "open_questions", "architecture_signals", "stakeholder_signals",
    "external_data_sources_mentioned", "initial_compliance_flags",
  ];
  const STRING_KEYS = ["title", "description", "signal", "question", "name_or_role", "evidence", "purpose", "name"];

  if (typeof v2.executive_summary === "string" && isLikelyEnglish(v2.executive_summary)) {
    items.push({ id: `__v2|executive_summary|value`, text: v2.executive_summary });
  }
  if (v2.business_model_summary && typeof v2.business_model_summary === "object") {
    for (const key of ["title", "context", "primary_goal"] as const) {
      const val = v2.business_model_summary[key];
      if (typeof val === "string" && isLikelyEnglish(val)) {
        items.push({ id: `__bms|${key}|value`, text: val });
      }
    }
  }

  for (const field of FIELDS_TO_SCAN) {
    const arr = v2[field];
    if (!Array.isArray(arr)) continue;
    arr.forEach((item: any, idx: number) => {
      if (typeof item === "string") {
        if (isLikelyEnglish(item)) items.push({ id: `${field}|${idx}|__self`, text: item });
        return;
      }
      if (!item || typeof item !== "object") return;
      for (const key of STRING_KEYS) {
        const val = item[key];
        if (typeof val === "string" && isLikelyEnglish(val)) {
          items.push({ id: `${field}|${idx}|${key}`, text: val });
        }
      }
    });
  }

  return items;
}

function applyTranslations(briefing: any, translations: Record<string, string>, changes: NormalizationChange[]) {
  const v2 = briefing?.business_extraction_v2;
  if (!v2) return;

  for (const [id, translated] of Object.entries(translations)) {
    const [field, idxStr, key] = id.split("|");
    if (field === "__v2" && idxStr === "executive_summary") {
      const before = v2.executive_summary;
      if (typeof before === "string" && before !== translated) {
        v2.executive_summary = translated;
        changes.push({ type: "language_normalization", field: "executive_summary", before, after: translated, reason: "Traducido EN → ES" });
      }
      continue;
    }
    if (field === "__bms") {
      const before = v2.business_model_summary?.[idxStr];
      if (typeof before === "string" && before !== translated) {
        v2.business_model_summary[idxStr] = translated;
        changes.push({ type: "language_normalization", field: `business_model_summary.${idxStr}`, before, after: translated, reason: "Traducido EN → ES" });
      }
      continue;
    }
    const idx = parseInt(idxStr, 10);
    const arr = v2[field];
    if (!Array.isArray(arr) || arr[idx] === undefined) continue;
    if (key === "__self" && typeof arr[idx] === "string") {
      const before = arr[idx];
      if (before !== translated) {
        arr[idx] = translated;
        changes.push({ type: "language_normalization", field: `${field}[${idx}]`, before, after: translated, reason: "Traducido EN → ES" });
      }
      continue;
    }
    if (!arr[idx] || typeof arr[idx] !== "object") continue;
    const before = arr[idx][key];
    if (typeof before === "string" && before !== translated) {
      arr[idx][key] = translated;
      changes.push({
        type: "language_normalization",
        field: `${field}[${idx}].${key}`,
        before,
        after: translated,
        reason: "Traducido EN → ES",
      });
    }
  }
}

async function applyLanguageNormalization(
  briefing: any,
  changes: NormalizationChange[],
): Promise<{ tokensInput: number; tokensOutput: number; called: boolean }> {
  const items = collectTranslatableStrings(briefing);
  if (items.length === 0) return { tokensInput: 0, tokensOutput: 0, called: false };

  // Cap to avoid massive prompts.
  const capped = items.slice(0, 120);

  const systemPrompt = `Eres traductor técnico ES↔EN. Recibes una lista JSON de strings en inglés (o mezcla) extraídas de un briefing de proyecto. Tradúcelas a ESPAÑOL NEUTRO TÉCNICO.

REGLAS:
- Conserva nombres propios (HubSpot, Drive, BORME, Teclofine, AFFLUX, etc.).
- Conserva tecnicismos universales: RAG, LLM, API, JSON, MVP, KPI, CRM, ROI.
- No inventes contenido; traduce literal pero idiomático.
- Devuelve JSON con la MISMA forma { "translations": { "<id>": "<texto en español>", ... } } usando los IDs proporcionados.
- Si un string ya está claramente en español, devuélvelo tal cual.`;

  const userPrompt = `Traduce estos strings y devuelve solo el JSON:
${JSON.stringify({ items: capped }, null, 2)}`;

  try {
    const result = await callGeminiFlash(systemPrompt, userPrompt, { maxRetries: 1, maxTokens: 4096 });
    let parsed: any = null;
    try {
      const cleaned = result.text.trim().replace(/^```(?:json)?\s*\n?/gm, "").replace(/\n?```\s*$/gm, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      const fb = result.text.indexOf("{");
      const lb = result.text.lastIndexOf("}");
      if (fb !== -1 && lb > fb) {
        try { parsed = JSON.parse(result.text.substring(fb, lb + 1)); } catch { /* swallow */ }
      }
    }
    if (parsed?.translations && typeof parsed.translations === "object") {
      applyTranslations(briefing, parsed.translations, changes);
    }
    return { tokensInput: result.tokensInput, tokensOutput: result.tokensOutput, called: true };
  } catch (e) {
    console.warn("[normalizer][language] non-blocking failure:", e instanceof Error ? e.message : e);
    changes.push({
      type: "language_normalization_skipped",
      reason: e instanceof Error ? e.message : String(e),
    });
    return { tokensInput: 0, tokensOutput: 0, called: false };
  }
}

function applyDeterministicSpanishCleanup(briefing: any, changes: NormalizationChange[]) {
  const replacements: Array<[RegExp, string]> = [
    [/\bAflu has collected\b/gi, "AFLU ha recopilado"],
    [/\bAFLU has collected a vast amount of data\b/gi, "AFLU ha recopilado un volumen importante de datos"],
    [/\bhas collected a vast amount of data\b/gi, "ha recopilado un volumen importante de datos"],
    [/\bCRM data\b/gi, "Datos del CRM"],
    [/\bCall recordings\b/gi, "Grabaciones de llamadas"],
    [/\bRecorded Calls\b/gi, "Grabaciones de llamadas"],
    [/\bLost opportunities\b/gi, "Oportunidades perdidas"],
    [/\bKnowledge graph\b/gi, "Grafo de conocimiento"],
    [/\bAutomated lead qualification and prioritization\b/gi, "Calificación y priorización automatizada de oportunidades"],
    [/\bThe client acknowledges\b/gi, "El cliente reconoce"],
    [/\bThe client seeks\b/gi, "El cliente busca"],
    [/\bThe client wants\b/gi, "El cliente quiere"],
    [/\bCarlos expresses\b/gi, "Carlos expresa"],
    [/\bCarlos expresa a desire\b/gi, "Carlos expresa el deseo"],
    [/\ba desire to\b/gi, "el deseo de"],
    [/\bCarlos wants\b/gi, "Carlos quiere"],
    [/\bAgust[ií]n mentions\b/gi, "Agustín menciona"],
    [/\bDevelop an AI\b/gi, "Desarrollar una IA"],
    [/\bAI can listen\b/gi, "La IA puede escuchar"],
    [/\bThe current process\b/gi, "El proceso actual"],
    [/\bThere is a desire\b/gi, "Existe el objetivo"],
    [/\bThe goal is\b/gi, "El objetivo es"],
    [/\bThe effectiveness of\b/gi, "La eficacia de"],
    [/\bThe migration of\b/gi, "La migración de"],
    [/\bto Hubspot\b/gi, "a HubSpot"],
    [/\bDesire to automate repetitive tasks\b/gi, "Necesidad de automatizar tareas repetitivas"],
    [/\bImprove efficiency of 'zona' team\b/gi, "Mejorar la eficiencia del equipo de zona"],
    [/\bIncrease originación of assets in buildings\b/gi, "Aumentar la originación de activos en edificios"],
    [/\bImprove commercial team's effectiveness\b/gi, "Mejorar la efectividad del equipo comercial"],
    [/\bImprove Team Efficiency and Reduce Manual Effort\b/gi, "Mejorar la eficiencia del equipo y reducir el esfuerzo manual"],
    [/\bvast amount of\b/gi, "gran volumen de"],
    [/\bnon-response rate\b/gi, "tasa de no respuesta"],
    [/\bin order to\b/gi, "para"],
    [/\bsuch as\b/gi, "como"],
    [/\bincluding\b/gi, "incluyendo"],
    [/\bhowever\b/gi, "sin embargo"],
    [/\bmoreover\b/gi, "además"],
    // ── Bridge fragments observed in real briefs ───────────────────
    [/\ba gran volumen de data on real estate off-market and potential clients\b/gi,
      "un gran volumen de datos sobre activos inmobiliarios fuera de mercado y clientes potenciales"],
    [/\bdata on real estate off-market and potential clients\b/gi,
      "datos sobre activos inmobiliarios fuera de mercado y clientes potenciales"],
    [/\bdata on real estate\b/gi, "datos sobre activos inmobiliarios"],
    [/\bwhich is currently not fully leveraged by AI\b/gi,
      "que actualmente no se aprovecha plenamente con IA"],
    [/\bcurrently not fully leveraged by AI\b/gi,
      "actualmente no se aprovecha plenamente con IA"],
    [/\bnot fully leveraged by AI\b/gi, "no se aprovecha plenamente con IA"],
    [/\bsuggests a structured data source that can be further utilized\b/gi,
      "sugiere una fuente de datos estructurada que puede explotarse mejor"],
    [/\bsuggests a structured data source\b/gi,
      "sugiere una fuente de datos estructurada"],
    [/\bcan be further utilized\b/gi, "puede explotarse mejor"],
    [/\bInformation on (\d+%?) of potential clients\b/gi,
      "Información sobre el $1 de los clientes potenciales"],
    [/\bbirth dates, and family contacts\b/gi,
      "fechas de nacimiento y contactos familiares"],
    [/\bbirth dates\b/gi, "fechas de nacimiento"],
    [/\bfamily contacts\b/gi, "contactos familiares"],
    [/\brepresents a rich dataset for personalized outreach and analysis\b/gi,
      "representa un conjunto de datos rico para contacto y análisis personalizados"],
    [/\bpersonalized outreach and analysis\b/gi,
      "contacto y análisis personalizados"],
    [/\bpersonalized outreach\b/gi, "contacto personalizado"],
    [/\brich dataset\b/gi, "conjunto de datos rico"],
    [/\bAgust[ií]n menciona the possibility of monitoring and analyzing\b/gi,
      "Agustín menciona la posibilidad de monitorizar y analizar"],
    [/\bthe possibility of monitoring and analyzing\b/gi,
      "la posibilidad de monitorizar y analizar"],
    [/\bto improve conversion and discourse, implying these recordings are available but not fully utilized\b/gi,
      "para mejorar la conversión y el discurso; estas grabaciones están disponibles pero no se aprovechan plenamente"],
    [/\bto improve conversion and discourse\b/gi,
      "para mejorar la conversión y el discurso"],
    [/\bimplying these recordings are available but not fully utilized\b/gi,
      "estas grabaciones están disponibles pero no se aprovechan plenamente"],
    [/\bare available but not fully utilized\b/gi,
      "están disponibles pero no se aprovechan plenamente"],
    [/\bnot fully utilized\b/gi, "no se aprovechan plenamente"],
    [/\bover (\d[\d,\.]*) years\b/gi, "a lo largo de $1 años"],
    [/\bemails from (\d[\d,\.]*) years of commercial negotiations contain valuable insights into negotiation strategies, conflict resolution, and contact history\b/gi,
      "correos de $1 años de negociaciones comerciales contienen información valiosa sobre estrategias de negociación, resolución de conflictos e historial de contactos"],
    [/\bvaluable insights into\b/gi, "información valiosa sobre"],
    [/\bvaluable insights\b/gi, "información valiosa"],
    [/\bnegotiation strategies, conflict resolution, and contact history\b/gi,
      "estrategias de negociación, resolución de conflictos e historial de contactos"],
    [/\bExisting Datos del CRM on owners and properties is not fully cataloged or utilized to identify missing information or to pre-categorize owners for sales efforts\b/gi,
      "Los Datos del CRM existentes sobre propietarios y propiedades no están completamente catalogados ni aprovechados para identificar información faltante ni para precategorizar propietarios para acciones comerciales"],
    [/\bExisting Datos del CRM\b/gi, "Los Datos del CRM existentes"],
    [/\bExisting CRM data\b/gi, "Los Datos del CRM existentes"],
    [/\bon owners and properties is not fully cataloged or utilized\b/gi,
      "sobre propietarios y propiedades no están completamente catalogados ni aprovechados"],
    [/\bnot fully cataloged or utilized\b/gi,
      "no están completamente catalogados ni aprovechados"],
    [/\bto identify missing information\b/gi,
      "para identificar información faltante"],
    [/\bto pre-categorize owners for sales efforts\b/gi,
      "para precategorizar propietarios para acciones comerciales"],
    [/\bpre-categorize\b/gi, "precategorizar"],
    [/\bsales efforts\b/gi, "acciones comerciales"],
    [/\bowners and properties\b/gi, "propietarios y propiedades"],
    [/\b(\d[\d,\.]*) emails from (\d[\d,\.]*) years\b/gi,
      "$1 correos de $2 años"],
    [/\bemails over (\d[\d,\.]*) years\b/gi, "correos de $1 años"],
    [/\bover (\d[\d,\.]*) years of\b/gi, "de $1 años de"],
    [/\bover (\d[\d,\.]*)%\b/gi, "más del $1%"],
    [/\bof potential clients\b/gi, "de los clientes potenciales"],
    [/\bcurrently not used in an intelligent way\b/gi,
      "actualmente no se usa de forma inteligente"],
    [/\bto detect patterns or opportunities\b/gi,
      "para detectar patrones u oportunidades"],
    [/\bcurrently does not\b/gi, "actualmente no"],
    [/\bare not fully\b/gi, "no están del todo"],
    [/\bis not fully\b/gi, "no está del todo"],
    [/\bbut implies\b/gi, "pero implica"],
    [/\bimplies\b/gi, "implica"],
    [/\bimplying\b/gi, "lo que implica que"],
    [/\bsuggests\b/gi, "sugiere"],
    [/\brepresents\b/gi, "representa"],
    [/\bcontain\b/gi, "contiene"],
    [/\bcontains\b/gi, "contiene"],
    [/\bare available\b/gi, "están disponibles"],
    [/\bis available\b/gi, "está disponible"],
    [/\bis currently\b/gi, "actualmente está"],
    [/\bare currently\b/gi, "actualmente están"],
    [/\bcurrently not\b/gi, "actualmente no"],
    [/\bcurrently used\b/gi, "actualmente se usa"],
    [/\bfurther utilized\b/gi, "explotado en mayor medida"],
    [/\bdata source\b/gi, "fuente de datos"],
    [/\bstructured data\b/gi, "datos estructurados"],
    [/\bpotential clients\b/gi, "clientes potenciales"],
    [/\bcontact history\b/gi, "historial de contactos"],
    [/\bcommercial negotiations\b/gi, "negociaciones comerciales"],
    [/\bsales efforts\b/gi, "acciones comerciales"],
    [/\boff-market\b/gi, "fuera de mercado"],
    [/\breal estate\b/gi, "activos inmobiliarios"],
  ];

  function walk(node: any, path: string): any {
    if (typeof node === "string") {
      let out = node;
      for (const [from, to] of replacements) out = out.replace(from, to);
      if (out !== node) {
        changes.push({ type: "deterministic_spanish_cleanup", field: path, before: node, after: out, reason: "Frase explicativa inglesa reescrita en español." });
      }
      return out;
    }
    if (Array.isArray(node)) return node.map((item, i) => walk(item, `${path}[${i}]`));
    if (node && typeof node === "object") {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(node)) out[k] = k.startsWith("_") ? v : walk(v, path ? `${path}.${k}` : k);
      return out;
    }
    return node;
  }

  if (briefing.business_extraction_v2) {
    briefing.business_extraction_v2 = walk(briefing.business_extraction_v2, "business_extraction_v2");
  }
}

/**
 * Last-resort word-level swap. Runs AFTER deterministic phrase cleanup +
 * LLM translation. Only swaps individual EN words for ES equivalents when
 * the surrounding context still has English fragments. Avoids breaking
 * brand names by skipping CamelCase / ALLCAPS tokens.
 */
function applyResidualWordSwap(briefing: any, changes: NormalizationChange[]) {
  const SINGLE_WORDS: Array<[RegExp, string]> = [
    [/\bdata\b/gi, "datos"],
    [/\bclients\b/gi, "clientes"],
    [/\bclient\b/gi, "cliente"],
    [/\bemails\b/gi, "correos"],
    [/\brecordings\b/gi, "grabaciones"],
    [/\bowners\b/gi, "propietarios"],
    [/\bproperties\b/gi, "propiedades"],
    [/\bbuildings\b/gi, "edificios"],
    [/\bavailable\b/gi, "disponibles"],
    [/\bvaluable\b/gi, "valiosa"],
    [/\binsights\b/gi, "información"],
    [/\bcurrently\b/gi, "actualmente"],
    [/\bpotential\b/gi, "potenciales"],
    [/\bsuggests\b/gi, "sugiere"],
    [/\brepresents\b/gi, "representa"],
    [/\bincludes\b/gi, "incluye"],
    [/\bcontains\b/gi, "contiene"],
    [/\bcontain\b/gi, "contienen"],
    [/\bsuch as\b/gi, "como"],
    [/\bin order to\b/gi, "para"],
    [/\b(\d[\d,\.]*) emails\b/gi, "$1 correos"],
    [/\bover (\d[\d,\.]*) years\b/gi, "a lo largo de $1 años"],
  ];

  function walk(node: any, path: string): any {
    if (typeof node === "string") {
      if (!hasEnglishFragment(node)) return node;
      let out = node;
      for (const [from, to] of SINGLE_WORDS) out = out.replace(from, to);
      out = out.replace(/\s{2,}/g, " ").trim();
      if (out !== node) {
        changes.push({
          type: "residual_word_swap",
          field: path,
          before: node,
          after: out,
          reason: "Reemplazo de palabras puente residuales tras LLM y limpieza determinista.",
        });
      }
      return out;
    }
    if (Array.isArray(node)) return node.map((item, i) => walk(item, `${path}[${i}]`));
    if (node && typeof node === "object") {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(node)) out[k] = k.startsWith("_") ? v : walk(v, path ? `${path}.${k}` : k);
      return out;
    }
    return node;
  }

  if (briefing.business_extraction_v2) {
    briefing.business_extraction_v2 = walk(briefing.business_extraction_v2, "business_extraction_v2");
  }
}

/**
 * Apply deterministic + residual cleanup directly on a clean-brief markdown
 * string. Used as a final safety net on the pre-rendered _clean_brief_md.
 */
export function cleanupSpanishMarkdown(md: string): string {
  if (!md || typeof md !== "string") return md;
  // Reuse the same phrase map by walking a fake briefing payload.
  const fake = { business_extraction_v2: { __md: md } };
  const dummyChanges: NormalizationChange[] = [];
  applyDeterministicSpanishCleanup(fake, dummyChanges);
  applyResidualWordSwap(fake, dummyChanges);
  return fake.business_extraction_v2.__md;
}

// ── 4. Semantic dedup ────────────────────────────────────────────────

function stemEs(word: string): string {
  return word
    .toLowerCase()
    .replace(/[áàä]/g, "a").replace(/[éèë]/g, "e").replace(/[íìï]/g, "i")
    .replace(/[óòö]/g, "o").replace(/[úùü]/g, "u").replace(/ñ/g, "n")
    .replace(/(ciones|ciónes|ción|ciones|aciones|aciones)$/i, "")
    .replace(/(mente|miento|ado|ido|ar|er|ir|es|s)$/i, "")
    .slice(0, 6);
}

function tokenize(s: string): Set<string> {
  const STOP = new Set(["de","la","el","los","las","y","a","o","en","con","por","para","del","un","una","al","sobre","que"]);
  const words = (s || "").toLowerCase().match(/[a-záéíóúñ]+/gi) || [];
  return new Set(words.filter((w) => w.length > 2 && !STOP.has(w)).map(stemEs));
}

function jaccardSim(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

const CANONICAL_GROUPS: Array<{ canonical: string; matchTokens: string[] }> = [
  {
    canonical: "Generador de revista emocional y contenido por rol",
    matchTokens: ["copy", "magazine", "revista", "marketing", "content", "contenido", "emocional", "publicacion"],
  },
  {
    canonical: "Asistente pre/post llamada y coaching comercial",
    matchTokens: ["call", "llamada", "negotia", "negocia", "coach", "asistente", "agent", "post"],
  },
  {
    canonical: "RAG de conocimiento del proyecto",
    matchTokens: ["unified", "platform", "knowledge", "rag", "base", "conocimiento", "custom"],
  },
];

/**
 * Pick the canonical group with the HIGHEST score (≥2 hits). When there is
 * a tie between distinct canonical names, return null so the candidate is
 * NOT force-merged into an arbitrary bucket.
 */
function tryAssignCanonical(item: any, groups: CanonicalComponent[]): string | null {
  const text = `${item.title || ""} ${item.description || ""}`.toLowerCase();
  let bestScore = 0;
  let bestCanonical: string | null = null;
  let tied = false;
  for (const group of groups) {
    const hits = group.matchTokens.filter((t) => text.includes(t.toLowerCase())).length;
    if (hits < 2) continue;
    if (hits > bestScore) {
      bestScore = hits;
      bestCanonical = group.canonical;
      tied = false;
    } else if (hits === bestScore && group.canonical !== bestCanonical) {
      tied = true;
    }
  }
  return tied ? null : bestCanonical;
}

function isMutexBlocked(a: string, b: string, mutex: Array<[string, string]> | undefined): boolean {
  if (!mutex || mutex.length === 0) return false;
  for (const [x, y] of mutex) {
    if ((a === x && b === y) || (a === y && b === x)) return true;
  }
  return false;
}

function dedupCandidates(
  arr: any[],
  changes: NormalizationChange[],
  fieldName: string,
  groups: CanonicalComponent[],
  mutex: Array<[string, string]> | undefined,
): any[] {
  if (!Array.isArray(arr)) return arr;

  // 1. Group by canonical mapping first.
  const canonicalBuckets = new Map<string, any[]>();
  const remaining: Array<{ item: any; canon: string | null }> = [];
  for (const item of arr) {
    const canon = tryAssignCanonical(item, groups);
    if (canon) {
      const bucket = canonicalBuckets.get(canon) || [];
      bucket.push(item);
      canonicalBuckets.set(canon, bucket);
    } else {
      remaining.push({ item, canon: null });
    }
  }

  // Merge each canonical bucket into one item.
  const merged: any[] = [];
  for (const [canonical, bucket] of canonicalBuckets.entries()) {
    if (bucket.length === 1) {
      const renamed = { ...bucket[0] };
      const before = renamed.title;
      if (before !== canonical) {
        renamed.title = canonical;
        changes.push({
          type: "candidate_rename_canonical",
          field: fieldName,
          before,
          after: canonical,
          reason: "Asignado nombre canónico del proyecto.",
        });
      }
      merged.push(renamed);
      continue;
    }
    const first = { ...bucket[0] };
    first.title = canonical;
    first._merged_from = bucket.map((b) => b.title || b.description || "").filter(Boolean);
    first._source_chunks = Array.from(new Set(bucket.flatMap((b) => b._source_chunks || [])));
    first._evidence_count = first._source_chunks.length;
    const evSnippets = bucket.flatMap((b) => b.evidence_snippets || []);
    if (evSnippets.length > 0) first.evidence_snippets = Array.from(new Set(evSnippets)).slice(0, 5);
    merged.push(first);
    changes.push({
      type: "candidate_merge_canonical",
      field: fieldName,
      before: first._merged_from,
      after: canonical,
      reason: `Fusionados ${bucket.length} candidatos en componente canónico.`,
    });
  }

  // 2. Then jaccard-dedup the remaining (with mutex protection by best-canonical).
  // For each remaining item, compute a "soft canonical" — the best-scoring
  // group even if score < 2 — and forbid merging two items whose soft
  // canonicals are mutex partners.
  function softCanonical(item: any): string | null {
    const text = `${item.title || ""} ${item.description || ""}`.toLowerCase();
    let best = 0;
    let name: string | null = null;
    for (const g of groups) {
      const hits = g.matchTokens.filter((t) => text.includes(t.toLowerCase())).length;
      if (hits > best) {
        best = hits;
        name = g.canonical;
      }
    }
    return best > 0 ? name : null;
  }

  const tokenizedRemaining = remaining.map((r) => ({
    item: r.item,
    tokens: tokenize(`${r.item.title || ""} ${r.item.description || ""}`),
    soft: softCanonical(r.item),
  }));
  const used = new Array(tokenizedRemaining.length).fill(false);

  for (let i = 0; i < tokenizedRemaining.length; i++) {
    if (used[i]) continue;
    const group = [tokenizedRemaining[i].item];
    used[i] = true;
    const headSoft = tokenizedRemaining[i].soft;
    for (let j = i + 1; j < tokenizedRemaining.length; j++) {
      if (used[j]) continue;
      // Mutex protection: never merge items whose soft canonicals are partners.
      if (headSoft && tokenizedRemaining[j].soft && isMutexBlocked(headSoft, tokenizedRemaining[j].soft!, mutex)) {
        continue;
      }
      const sim = jaccardSim(tokenizedRemaining[i].tokens, tokenizedRemaining[j].tokens);
      if (sim >= 0.6) {
        group.push(tokenizedRemaining[j].item);
        used[j] = true;
      }
    }
    if (group.length === 1) {
      merged.push(group[0]);
    } else {
      const head = { ...group[0] };
      head._merged_from = group.slice(1).map((g) => g.title || g.description || "").filter(Boolean);
      head._source_chunks = Array.from(new Set(group.flatMap((g) => g._source_chunks || [])));
      head._evidence_count = head._source_chunks.length;
      merged.push(head);
      changes.push({
        type: "candidate_merge_lexical",
        field: fieldName,
        before: group.map((g) => g.title || g.description),
        after: head.title || head.description,
        reason: `Fusionados ${group.length} candidatos por similitud léxica (jaccard ≥ 0.6).`,
      });
    }
  }

  return merged;
}

function applySemanticDedup(briefing: any, changes: NormalizationChange[], ctx: NormalizationContext) {
  const v2 = briefing?.business_extraction_v2;
  if (!v2) return;
  const groups = (Array.isArray(ctx.canonicalComponents) && ctx.canonicalComponents.length > 0)
    ? ctx.canonicalComponents
    : CANONICAL_GROUPS;
  const mutex = ctx.mutexGroups;
  for (const field of ["ai_native_opportunity_signals", "client_requested_items", "inferred_needs"] as const) {
    const before = Array.isArray(v2[field]) ? v2[field].length : 0;
    v2[field] = dedupCandidates(v2[field], changes, field, groups, mutex);
    const after = Array.isArray(v2[field]) ? v2[field].length : 0;
    if (before !== after) {
      changes.push({
        type: "candidate_dedup_summary",
        field,
        before,
        after,
        reason: `Reducción ${before} → ${after}.`,
      });
    }
  }
}

function applyManualReviewAlerts(briefing: any, ctx: NormalizationContext, changes: NormalizationChange[]) {
  const v2 = briefing?.business_extraction_v2;
  if (!v2) return;
  const alerts = ctx.manualReviewAlerts || [];
  if (alerts.length === 0) return;

  if (!Array.isArray(v2.open_questions)) v2.open_questions = [];
  const existing = new Set(
    v2.open_questions
      .map((q: any) => (typeof q === "string" ? q : (q?.question || q?.title || "")).toLowerCase().trim())
      .filter(Boolean),
  );

  for (const alert of alerts) {
    const key = (alert.question || "").toLowerCase().trim();
    if (!key || existing.has(key)) continue;
    v2.open_questions.push({
      title: `Revisión manual: ${alert.signal}`,
      question: alert.question,
      _source: alert.source || "manual_review_alert",
      _inferred_by: "normalizer_v1",
    });
    existing.add(key);
    changes.push({
      type: "manual_review_alert_added",
      field: "open_questions",
      after: alert.question,
      reason: `Alerta de revisión manual: ${alert.signal}.`,
    });
  }
}

// ── 4b. Canonical catalysts injection ────────────────────────────────

function applyCanonicalCatalysts(briefing: any, ctx: NormalizationContext, changes: NormalizationChange[]) {
  const v2 = briefing?.business_extraction_v2;
  if (!v2) return;
  const catalysts = ctx.canonicalCatalysts || [];
  if (catalysts.length === 0) return;
  if (!Array.isArray(v2.business_catalysts)) v2.business_catalysts = [];

  const existingTitles = v2.business_catalysts
    .map((c: any) => (typeof c === "string" ? c : c?.title || ""))
    .map((s: string) => s.toLowerCase().trim())
    .filter(Boolean);

  const injected: any[] = [];
  for (const cat of catalysts) {
    const titleLc = (cat.title || "").toLowerCase().trim();
    if (!titleLc) continue;
    // Inject unless an existing catalyst title is essentially the same.
    // We compare by significant tokens (≥6 chars) and require ≥4 overlap to count as duplicate.
    const catTokens = new Set(titleLc.split(/\W+/).filter((t) => t.length >= 6));
    const isDuplicate = existingTitles.some((existing: string) => {
      const exTokens = new Set(existing.split(/\W+/).filter((t) => t.length >= 6));
      let overlap = 0;
      for (const t of catTokens) if (exTokens.has(t)) overlap++;
      return overlap >= 4;
    });
    if (isDuplicate) continue;
    injected.push({
      title: cat.title,
      description: cat.description || cat.title,
      _inferred_by: "normalizer_catalyst_v1",
    });
    changes.push({
      type: "catalyst_injected_canonical",
      field: "business_catalysts",
      after: cat.title,
      reason: "Catalizador canónico ausente; inyectado por normalizer.",
    });
  }
  if (injected.length > 0) {
    // place canonical-injected first so they highlight in the clean brief.
    v2.business_catalysts = [...injected, ...v2.business_catalysts];
  }
}

// ── 4c. Ensure canonical components are present ──────────────────────

function ensureCanonicalComponentsPresent(briefing: any, ctx: NormalizationContext, changes: NormalizationChange[]) {
  const v2 = briefing?.business_extraction_v2;
  if (!v2) return;
  const components = ctx.canonicalComponents || [];
  if (components.length === 0) return;

  const previous = Array.isArray(v2.ai_native_opportunity_signals) ? v2.ai_native_opportunity_signals : [];
  const evidenceByCanonical = new Map<string, any>();
  for (const item of previous) {
    if (!item || typeof item !== "object") continue;
    const title = (item.title || "").toLowerCase().trim();
    if (title) evidenceByCanonical.set(title, item);
  }

  v2.ai_native_opportunity_signals = components.map((comp) => {
    const prior = evidenceByCanonical.get(comp.canonical.toLowerCase().trim());
    return {
      title: comp.canonical,
      description: comp.description || prior?.description || "Componente canónico principal para el roadmap AFFLUX.",
      ...(prior?._source_chunks ? { _source_chunks: prior._source_chunks } : {}),
      _evidence_count: prior?._evidence_count || 0,
      _inferred_by: "normalizer_canonical_component_v1",
    };
  });
  changes.push({
    type: "canonical_component_list_replaced",
    field: "ai_native_opportunity_signals",
    before: previous.map((p: any) => typeof p === "string" ? p : p?.title).filter(Boolean),
    after: components.map((c) => c.canonical),
    reason: "Sección 9 sustituida por la taxonomía canónica estricta del proyecto.",
  });
}

// ── 5. Compliance flag expansion ─────────────────────────────────────

interface FlagRule {
  flag: string;
  evidence: string;
  trigger: (briefing: any) => boolean;
}

function hasTokenInArrayField(briefing: any, field: string, keys: string[], tokens: string[]): boolean {
  const v2 = briefing?.business_extraction_v2;
  const arr = v2?.[field];
  if (!Array.isArray(arr)) return false;
  const blob = arr.map((item: any) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") return keys.map((k) => item[k] || "").join(" ");
    return "";
  }).join(" ").toLowerCase();
  return tokens.some((t) => blob.includes(t));
}

function applyComplianceExpansion(briefing: any, changes: NormalizationChange[]) {
  const v2 = briefing?.business_extraction_v2;
  if (!v2) return;
  if (!Array.isArray(v2.initial_compliance_flags)) v2.initial_compliance_flags = [];

  const existing = new Set(v2.initial_compliance_flags.map((f: any) => (typeof f === "string" ? f : f?.flag)).filter(Boolean));

  const rules: FlagRule[] = [
    {
      flag: "external_data_enrichment",
      evidence: "Mencionan enriquecimiento de datos externos (BORME, esquelas, Registro Civil, prensa).",
      trigger: (b) =>
        hasTokenInArrayField(b, "external_data_sources_mentioned", ["name", "purpose"], ["borme", "esquela", "registro civil", "boe", "prensa", "scraping"]) ||
        hasTokenInArrayField(b, "ai_native_opportunity_signals", ["title", "description"], ["enrich", "enriquec", "scraping", "esquela", "borme"]),
    },
    {
      flag: "scraping_public_sources",
      evidence: "Se planea extraer datos de fuentes públicas online.",
      trigger: (b) =>
        hasTokenInArrayField(b, "external_data_sources_mentioned", ["name", "purpose"], ["scraping", "scrape", "boe", "borme", "esquela", "prensa local"]),
    },
    {
      flag: "commercial_prioritization",
      evidence: "Hay priorización comercial automatizada (matching, scoring, ranking).",
      trigger: (b) =>
        hasTokenInArrayField(b, "ai_native_opportunity_signals", ["title", "description"], ["matching", "scoring", "ranking", "priorizac", "priorit"]),
    },
    {
      flag: "gdpr_article_22_risk",
      evidence: "Decisiones automatizadas con efecto comercial sobre personas (Art. 22 RGPD).",
      trigger: (b) =>
        hasTokenInArrayField(b, "ai_native_opportunity_signals", ["title", "description"], ["matching", "scoring", "ranking", "priorizac", "decisi"]) &&
        existing.has("personal_data_processing"),
    },
    {
      flag: "legal_basis_required",
      evidence: "Procesamiento de datos personales requiere base legal documentada.",
      trigger: (_b) => existing.has("personal_data_processing") || existing.has("profiling"),
    },
    {
      flag: "human_in_the_loop_required",
      evidence: "Decisiones sensibles deberían tener revisión humana antes de impacto comercial.",
      trigger: (_b) => existing.has("personal_data_processing") || existing.has("profiling"),
    },
    {
      flag: "data_retention_required",
      evidence: "Se necesita política de retención y borrado para datos personales recolectados.",
      trigger: (_b) => existing.has("personal_data_processing"),
    },
  ];

  for (const r of rules) {
    if (existing.has(r.flag)) continue;
    if (r.trigger(briefing)) {
      v2.initial_compliance_flags.push({
        flag: r.flag,
        evidence: r.evidence,
        _inferred_by: "normalizer_v1",
      });
      existing.add(r.flag);
      changes.push({
        type: "compliance_flag_inferred",
        field: "initial_compliance_flags",
        after: r.flag,
        reason: r.evidence,
      });
    }
  }
}

// ── 6. Quote validator for numeric signals ───────────────────────────

const NUMERIC_PATTERN = /\b(\d{1,4})\s*(visitas|llamadas|propietarios|meses|semanas|años|%|euros|€|edificios|inmuebles|reuniones)\b/gi;

function applyQuoteValidator(briefing: any, changes: NormalizationChange[]) {
  const v2 = briefing?.business_extraction_v2;
  if (!v2) return;
  const quotes = (v2.source_quotes || []).map((q: string) => (q || "").toLowerCase());

  const FIELDS_TO_CHECK = ["observed_facts", "quantified_economic_pains", "business_catalysts"];
  for (const field of FIELDS_TO_CHECK) {
    const arr = v2[field];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const text = `${item.title || ""} ${item.description || ""}`.toLowerCase();
      const matches = Array.from(text.matchAll(NUMERIC_PATTERN));
      if (matches.length === 0) continue;
      const unverified: string[] = [];
      for (const m of matches) {
        const fragment = `${m[1]} ${m[2]}`;
        const inQuotes = quotes.some((q: string) => q.includes(fragment) || q.includes(m[1]));
        if (!inQuotes) unverified.push(fragment);
      }
      if (unverified.length > 0) {
        item._unverified_number = true;
        item._unverified_fragments = unverified;
        changes.push({
          type: "unverified_number",
          field,
          after: unverified,
          reason: "Cifra no encontrada literal en source_quotes; revisar manualmente.",
        });
      }
    }
  }
}

// ── Main entrypoint ──────────────────────────────────────────────────

export async function normalizeBrief(
  inputBriefing: any,
  ctx: NormalizationContext,
): Promise<NormalizationResult> {
  // Deep clone so we don't mutate the caller's object.
  const briefing = JSON.parse(JSON.stringify(inputBriefing || {}));
  const changes: NormalizationChange[] = [];

  // 1. Naming
  applyNamingSplit(briefing, ctx, changes);

  // 2. Sector cleanup (deep, but skip _-prefixed keys)
  if (briefing.business_extraction_v2) {
    briefing.business_extraction_v2 = applySectorCleanup(briefing.business_extraction_v2, changes, ["business_extraction_v2"]);
  }

  // 2b. Off-topic / forbidden topics filter (whole-item removal).
  applyForbiddenTopicsFilter(briefing, ctx, changes);

  // 3a. Deterministic cleanup BEFORE the LLM, so the model sees fewer
  // already-translated fragments and focuses on the rest.
  applyDeterministicSpanishCleanup(briefing, changes);

  // 3b. Language normalization (single LLM call, non-blocking)
  const langResult = await applyLanguageNormalization(briefing, changes);

  // 3c. Deterministic cleanup AGAIN to catch any new English the LLM left.
  applyDeterministicSpanishCleanup(briefing, changes);

  // 3d. Last-resort word-level swap for residual English bridge tokens.
  applyResidualWordSwap(briefing, changes);

  // 4. Semantic dedup (uses canonical override from ctx if provided)
  applySemanticDedup(briefing, changes, ctx);

  // 4b. Inject canonical catalysts that the LLM missed.
  applyCanonicalCatalysts(briefing, ctx, changes);

  // 4c. Ensure every required canonical component is present.
  ensureCanonicalComponentsPresent(briefing, ctx, changes);

  // 5. Compliance expansion
  applyComplianceExpansion(briefing, changes);

  // 6. Quote validator
  applyQuoteValidator(briefing, changes);

  // 7. Manual review alerts (project-specific, optional)
  applyManualReviewAlerts(briefing, ctx, changes);

  // Attach log.
  briefing._normalization_log = {
    version: "1.1.0",
    applied_at: new Date().toISOString(),
    changes_count: changes.length,
    changes,
    language_llm_called: langResult.called,
    canonical_components_used: (ctx.canonicalComponents || []).map((c) => c.canonical),
    manual_review_alerts_count: (ctx.manualReviewAlerts || []).length,
  };

  return {
    briefing,
    changes,
    llmCalled: langResult.called,
    tokensInput: langResult.tokensInput,
    tokensOutput: langResult.tokensOutput,
  };
}
