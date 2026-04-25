/**
 * normalization-overrides.ts
 *
 * Per-project normalization overrides for the Step 2 brief cleanup pipeline.
 *
 * The wizard sends these fields to the `repair_step2_brief` edge function as
 * an OPTIONAL block. Projects without an override here send nothing and the
 * normalizer falls back to its generic defaults.
 *
 * Shape of each override:
 *   - canonicalComponents: rewrites the dedup taxonomy used by the normalizer.
 *   - forbiddenTopics: regexes (as strings) of topics to strip from the brief
 *     because they belong to other domains.
 *   - manualReviewAlerts: alerts appended to "open questions" so the user
 *     reviews them before approving.
 */

export interface CanonicalComponent {
  canonical: string;
  matchTokens: string[];
}

export interface ManualReviewAlert {
  signal: string;
  question: string;
  source?: string;
}

export interface NormalizationOverrides {
  productName?: string;
  canonicalComponents?: CanonicalComponent[];
  forbiddenTopics?: string[];
  manualReviewAlerts?: ManualReviewAlert[];
}

// ── AFFLUX (real estate off-market intelligence) ─────────────────────
const AFFLUX_OVERRIDES: NormalizationOverrides = {
  productName: "AFFLUX",
  canonicalComponents: [
    { canonical: "RAG de conocimiento AFFLUX", matchTokens: ["rag", "knowledge", "conocimiento", "base"] },
    { canonical: "Pipeline de llamadas, transcripción y análisis", matchTokens: ["call", "llamada", "transcrip", "analisis", "pipeline"] },
    { canonical: "Catalogador de propietarios en 7 roles", matchTokens: ["catalog", "propietari", "owner", "rol", "clasific"] },
    { canonical: "Analizador de notas comerciales", matchTokens: ["nota", "note", "comercial", "analiz"] },
    { canonical: "Asistente pre/post llamada y coaching comercial", matchTokens: ["call", "llamada", "coach", "asistente", "negotia", "negocia", "post", "pre"] },
    { canonical: "Detector de fallecimientos y herencias", matchTokens: ["esquela", "fallecim", "herencia", "obituar", "deceased"] },
    { canonical: "Matching activo-inversor", matchTokens: ["matching", "match", "inversor", "investor", "activo", "asset"] },
    { canonical: "Detector de compradores institucionales tipo Benatar", matchTokens: ["benatar", "institucion", "fondo", "institutional", "buyer", "comprador"] },
    { canonical: "Generador de revista emocional y contenido por rol", matchTokens: ["copy", "magazine", "revista", "marketing", "content", "contenido", "emocional", "publicacion"] },
    { canonical: "Soul de Alejandro", matchTokens: ["soul", "alejandro", "personalidad", "voz", "founder", "voice"] },
    { canonical: "Governance RGPD/DPIA", matchTokens: ["rgpd", "gdpr", "dpia", "compliance", "governance", "privacidad"] },
    { canonical: "Motor de valoración con BrainsRE", matchTokens: ["valorac", "brainsre", "valuation", "tasacion", "precio"] },
  ],
  forbiddenTopics: [
    "\\b(weather|pollen|allergy|allergy\\s+medicine|hay\\s+fever)\\b",
    "\\b(clima|polen|alergia|fiebre\\s+del\\s+heno)\\b",
    "medicamento(s)?\\s+(de\\s+)?alergia",
    "\\bmarket\\s+trends?\\b(?!.*(real\\s+estate|inmobil|off-?market))",
  ],
  manualReviewAlerts: [
    {
      signal: "Señal '71'",
      question: "Se detecta la señal 71 como tasa de no respuesta. Confirmar si también existe la señal '71 visitas en 9 meses sin cierre'.",
      source: "afflux_v4_review",
    },
  ],
};

// ── Registry: matches by lowercased name OR company substring ─────────
const REGISTRY: Array<{ match: (name: string, company: string) => boolean; overrides: NormalizationOverrides }> = [
  {
    match: (name, company) =>
      name.toLowerCase().includes("afflux") ||
      name.toLowerCase().includes("aflu") ||
      company.toLowerCase().includes("afflux") ||
      company.toLowerCase().includes("aflu"),
    overrides: AFFLUX_OVERRIDES,
  },
];

export function getNormalizationOverrides(projectName: string, company: string): NormalizationOverrides {
  const name = projectName || "";
  const co = company || "";
  for (const entry of REGISTRY) {
    if (entry.match(name, co)) return entry.overrides;
  }
  return {};
}
