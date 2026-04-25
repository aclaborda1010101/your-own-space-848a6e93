/**
 * normalization-overrides.ts
 *
 * Per-project normalization overrides for the Step 2 brief cleanup pipeline.
 *
 * Sent OPTIONALLY to the `repair_step2_brief` edge function. Projects without
 * an override here send nothing and the normalizer uses generic defaults.
 */

export interface CanonicalComponent {
  canonical: string;
  matchTokens: string[];
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

export interface NormalizationOverrides {
  productName?: string;
  /**
   * Authoritative client_company_name. Used when the project's company on
   * record (`business_projects.company`) is actually a person name and the
   * brief should display the legal/brand entity instead.
   */
  companyNameOverride?: string;
  canonicalComponents?: CanonicalComponent[];
  forbiddenTopics?: string[];
  manualReviewAlerts?: ManualReviewAlert[];
  canonicalCatalysts?: CanonicalCatalyst[];
  /**
   * Pairs of canonical names that MUST NOT be fused even when token overlap
   * is high. Each pair forbids merging the two component names.
   */
  mutexGroups?: Array<[string, string]>;
}

// ── AFFLUX (real estate off-market intelligence) ─────────────────────
const AFFLUX_OVERRIDES: NormalizationOverrides = {
  productName: "AFFLUX",
  companyNameOverride: "AFLU",
  canonicalComponents: [
    { canonical: "RAG de conocimiento AFFLUX", matchTokens: ["rag", "knowledge", "conocimiento", "base de conocimiento"] },
    { canonical: "Pipeline de llamadas, transcripción y análisis", matchTokens: ["transcrip", "pipeline", "grabacion", "recorded call"] },
    { canonical: "Catalogador de propietarios en 7 roles", matchTokens: ["catalog", "propietari", "owner", "7 rol", "siete rol", "clasific"] },
    { canonical: "Analizador de notas comerciales", matchTokens: ["nota comercial", "notas comercial", "commercial note", "analiz nota"] },
    { canonical: "Asistente pre/post llamada y coaching comercial", matchTokens: ["pre/post", "pre llamada", "post llamada", "coach", "asistente comercial", "negotia", "negocia"] },
    { canonical: "Detector de fallecimientos y herencias", matchTokens: ["esquela", "fallecim", "herencia", "obituar", "deceased", "sucesori"] },
    { canonical: "Matching activo-inversor", matchTokens: ["matching", "activo-inversor", "activo inversor", "asset-investor"] },
    { canonical: "Detector de compradores institucionales tipo Benatar", matchTokens: ["benatar", "institucion", "comprador institu", "fondo comprador", "institutional buyer"] },
    { canonical: "Generador de revista emocional y contenido por rol", matchTokens: ["revista", "magazine", "contenido por rol", "marketing emocional", "emocional"] },
    { canonical: "Soul de Alejandro", matchTokens: ["soul", "alejandro", "personalidad fundador", "voz fundador", "voice founder"] },
    { canonical: "Governance RGPD/DPIA", matchTokens: ["rgpd", "gdpr", "dpia", "compliance", "governance", "privacidad"] },
    { canonical: "Motor de valoración con BrainsRE", matchTokens: ["valorac", "brainsre", "valuation", "tasacion"] },
    { canonical: "Centralizador documental y organización de datos", matchTokens: ["document", "organizac", "centraliz", "carpetas", "drive", "documental"] },
  ],
  canonicalCatalysts: [
    {
      title: "Fallecimiento de propietario, herencia o cambio sucesorio como disparador de venta",
      description: "Eventos vitales (fallecimientos, herencias, cambios familiares) son catalizadores clave de venta off-market y deben detectarse activamente vía esquelas, BORME, Registro Civil y prensa local.",
    },
    {
      title: "Detección de compradores institucionales activos (tipo Benatar)",
      description: "La identificación temprana de fondos y compradores institucionales en mercado permite anticipar oferta de edificios completos y cerrar antes que la competencia.",
    },
    {
      title: "Desajuste entre oferta de edificios completos y demanda inversora",
      description: "Existe un desfase recurrente entre activos disponibles (edificios sin división horizontal, proindivisos) y la demanda real de inversores cualificados.",
    },
    {
      title: "Baja respuesta y fricción comercial como catalizador de automatización",
      description: "Las altas tasas de no respuesta y la fricción manual en el contacto comercial justifican la priorización automatizada y el coaching pre/post llamada.",
    },
  ],
  mutexGroups: [
    ["Catalogador de propietarios en 7 roles", "Generador de revista emocional y contenido por rol"],
    ["Analizador de notas comerciales", "Asistente pre/post llamada y coaching comercial"],
    ["Matching activo-inversor", "Detector de compradores institucionales tipo Benatar"],
    ["Soul de Alejandro", "RAG de conocimiento AFFLUX"],
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
      question: "Se detecta la señal 71 como tasa de no respuesta. Confirmar si también existe en la transcripción la señal '71 visitas en 9 meses sin cierre'.",
      source: "afflux_v6_review",
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
