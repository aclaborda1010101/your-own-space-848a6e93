/**
 * f4a-deterministic-detectors.ts — Pure, LLM-free gap detectors for F4a.
 *
 * Each detector consumes the Step 2 briefing and the Step 25 component_registry
 * and emits a list of `PreDetectedGap` objects with stable, idempotent shape.
 * The F4a orchestrator runs these BEFORE the LLM call (pre-warm pattern) so the
 * LLM is forced to confirm/reject hardcoded findings rather than starting from
 * a blank page. This is the lesson learned from F2: "el prompt prometía y no
 * entregaba" — deterministic guards are the safety net.
 *
 * Created: 2026-04-25
 */

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────

export type GapType =
  | "missing_component"
  | "component_should_be_split"
  | "missing_data_source"
  | "missing_form"
  | "missing_rag"
  | "missing_agent"
  | "missing_moe_route"
  | "missing_compliance_control"
  | "missing_dataset_readiness"
  | "weak_evidence"
  | "phase_mismatch";

export type GapSeverity = "low" | "medium" | "high" | "critical";

export type SuggestedAction =
  | "add_component"
  | "split_component"
  | "defer_to_roadmap"
  | "add_prerequisite"
  | "add_dataset_requirement"
  | "add_human_review"
  | "no_action";

export interface SuggestedComponentCandidate {
  name: string;
  family: string;
  layer: string;
  priority: string;
  suggested_delivery_phase: string;
  business_job: string;
  business_justification: string;
}

export interface PreDetectedGap {
  /** Synthesised id assigned by orchestrator. Helpers leave this empty. */
  gap_id?: string;
  /** Stable dedupe key — orchestrator uses this to avoid duplicates. */
  dedupe_key: string;
  title: string;
  gap_type: GapType;
  severity: GapSeverity;
  evidence: string[];
  affected_registry_components: string[];
  suggested_action: SuggestedAction;
  suggested_component_candidate?: SuggestedComponentCandidate;
  reason: string;
  /** Tag so we can audit which detector produced what. */
  detector: string;
}

interface RegistryComponent {
  component_id?: string;
  id?: string;
  name?: string;
  family?: string;
  layer?: string;
  business_job?: string;
  external_sources?: string[];
  signal_ids?: string[];
  status?: string;
  soul_dependency?: string;
  compliance_flags?: string[];
  dataset_readiness_required?: boolean;
}

interface ComponentRegistry {
  components?: RegistryComponent[];
  legacy_components?: RegistryComponent[];
  dpia?: { required?: boolean; status?: string };
}

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────────

function lowerJoin(...parts: unknown[]): string {
  return parts
    .map((p) => {
      if (p == null) return "";
      if (typeof p === "string") return p;
      try {
        return JSON.stringify(p);
      } catch {
        return String(p);
      }
    })
    .join(" \n ")
    .toLowerCase();
}

function allComponents(registry: ComponentRegistry | undefined | null): RegistryComponent[] {
  if (!registry) return [];
  const a = Array.isArray(registry.components) ? registry.components : [];
  const b = Array.isArray(registry.legacy_components) ? registry.legacy_components : [];
  return [...a, ...b];
}

function hasFamily(registry: ComponentRegistry | undefined | null, ...families: string[]): boolean {
  const set = new Set(families.map((f) => f.toLowerCase()));
  return allComponents(registry).some((c) => {
    const fam = (c.family ?? "").toLowerCase();
    return set.has(fam);
  });
}

function findByFamily(registry: ComponentRegistry | undefined | null, ...families: string[]): RegistryComponent[] {
  const set = new Set(families.map((f) => f.toLowerCase()));
  return allComponents(registry).filter((c) => set.has((c.family ?? "").toLowerCase()));
}

function compId(c: RegistryComponent): string {
  return c.component_id || c.id || "<unknown>";
}

function briefMentionsAny(briefText: string, terms: string[]): string[] {
  const hits: string[] = [];
  for (const t of terms) {
    if (briefText.includes(t.toLowerCase())) hits.push(t);
  }
  return hits;
}

// ───────────────────────────────────────────────────────────────────────────────
// Detectors
// ───────────────────────────────────────────────────────────────────────────────

/**
 * D1 — Missing data pipeline / transcription pipeline when call signals exist.
 */
export function detectMissingDataPipelineFromCallSignals(
  brief: any,
  registry: ComponentRegistry | null | undefined,
): PreDetectedGap[] {
  const briefText = lowerJoin(brief);
  const callTerms = ["llamada", "llamadas", "grabación", "grabaciones", "plaud", "transcripción", "transcripciones", "whisper", "audio comercial"];
  const hits = briefMentionsAny(briefText, callTerms);
  if (hits.length === 0) return [];

  if (hasFamily(registry, "data_pipeline", "transcription_pipeline", "call_pipeline")) {
    return [];
  }

  return [{
    dedupe_key: "missing_call_data_pipeline",
    title: "Pipeline de transcripción / análisis de llamadas no encontrado en el registry",
    gap_type: "missing_component",
    severity: "high",
    evidence: hits.map((h) => `briefing menciona "${h}"`),
    affected_registry_components: [],
    suggested_action: "add_component",
    suggested_component_candidate: {
      name: "Pipeline de transcripción y análisis de llamadas",
      family: "transcription_pipeline",
      layer: "B_action",
      priority: "P1_high",
      suggested_delivery_phase: "F2",
      business_job: "Capturar grabaciones de llamadas comerciales, transcribirlas y extraer señales accionables (intención, objeciones, próximos pasos).",
      business_justification: "El briefing describe llamadas comerciales como input crítico, pero ningún componente las procesa.",
    },
    reason: "El brief menciona llamadas/grabaciones/Plaud sin que exista un componente de transcripción dedicado.",
    detector: "D1_missing_call_data_pipeline",
  }];
}

/**
 * D2 — Institutional buyer detector (Benatar pattern). MUST be a separate
 * component from the deceased-owner detector ("fallecimientos"). Conceptually
 * distinct: one finds owners (sellers), the other finds buyers.
 */
export function detectInstitutionalBuyerDetectorGap(
  brief: any,
  registry: ComponentRegistry | null | undefined,
): PreDetectedGap[] {
  const briefText = lowerJoin(brief);
  const buyerTerms = ["benatar", "comprador institucional", "compradores institucionales", "fondos compradores", "servicer", "servicers", "private equity inmobiliario", "fondo comprador"];
  const hits = briefMentionsAny(briefText, buyerTerms);
  if (hits.length === 0) return [];

  // Look for a dedicated institutional_buyer_detector. The fallecimientos
  // detector does NOT count.
  const dedicated = findByFamily(registry, "institutional_buyer_detector", "buyer_detector");
  if (dedicated.length > 0) return [];

  // If there's a "deceased" detector that someone might be tempted to fuse with,
  // call it out explicitly in the affected list.
  const deceasedDetectors = allComponents(registry).filter((c) => {
    const text = lowerJoin(c.name, c.business_job, c.family);
    return text.includes("fallecim") || text.includes("decease") || text.includes("esquela");
  });

  return [{
    dedupe_key: "missing_institutional_buyer_detector",
    title: "Detector de compradores institucionales (tipo Benatar) no presente — NO fusionar con detector de fallecimientos",
    gap_type: "missing_component",
    severity: "high",
    evidence: hits.map((h) => `briefing menciona "${h}"`),
    affected_registry_components: deceasedDetectors.map(compId),
    suggested_action: "add_component",
    suggested_component_candidate: {
      name: "Detector de compradores institucionales (Benatar)",
      family: "institutional_buyer_detector",
      layer: "C_intelligence",
      priority: "P1_high",
      suggested_delivery_phase: "F2",
      business_job: "Identificar y monitorizar fondos, servicers y compradores institucionales activos en el mercado para alimentar el motor de matching activo-inversor.",
      business_justification: "El brief menciona explícitamente Benatar/compradores institucionales como pieza estratégica. Es conceptualmente distinto del detector de fallecimientos (que descubre vendedores/propietarios).",
    },
    reason: "Señales claras de compradores institucionales en brief, pero no existe componente dedicado. El detector de fallecimientos NO cubre este caso.",
    detector: "D2_missing_institutional_buyer_detector",
  }];
}

/**
 * D3 — External data sources mentioned in brief but not declared in any
 * component's `external_sources` field.
 */
export function detectExternalSourceGaps(
  brief: any,
  registry: ComponentRegistry | null | undefined,
): PreDetectedGap[] {
  const briefText = lowerJoin(brief);
  // Each entry: [canonical_name, search_terms[]]
  const sources: Array<[string, string[]]> = [
    ["BORME", ["borme"]],
    ["CNAE", ["cnae"]],
    ["Licencias municipales", ["licencia municipal", "licencias municipales", "ayuntamiento"]],
    ["Esquelas", ["esquela", "esquelas"]],
    ["BOE", ["boe ", " boe", "boletín oficial"]],
    ["BrainsRE", ["brainsre", "brains re"]],
    ["HubSpot", ["hubspot"]],
    ["Gmail", ["gmail"]],
    ["Google Drive", ["google drive", " drive "]],
  ];

  // Aggregate declared sources across all components.
  const declared = new Set<string>();
  for (const c of allComponents(registry)) {
    if (Array.isArray(c.external_sources)) {
      for (const s of c.external_sources) {
        if (typeof s === "string") declared.add(s.toLowerCase());
      }
    }
  }

  const gaps: PreDetectedGap[] = [];
  for (const [canon, terms] of sources) {
    const hits = briefMentionsAny(briefText, terms);
    if (hits.length === 0) continue;
    const isDeclared = [...declared].some((d) => terms.some((t) => d.includes(t.trim())));
    if (isDeclared) continue;
    gaps.push({
      dedupe_key: `missing_external_source__${canon.toLowerCase()}`,
      title: `Fuente externa "${canon}" mencionada en brief pero no declarada en ningún componente`,
      gap_type: "missing_data_source",
      severity: "medium",
      evidence: hits.map((h) => `briefing menciona "${h.trim()}"`),
      affected_registry_components: [],
      suggested_action: "add_prerequisite",
      reason: `El brief referencia "${canon}" como fuente, pero ningún componente la lista en external_sources.`,
      detector: "D3_missing_external_source",
    });
  }
  return gaps;
}

/**
 * D4 — Required forms (post-call form, role validation, owner/investor/asset
 * cards) absent from registry.
 */
export function detectMissingForms(
  brief: any,
  registry: ComponentRegistry | null | undefined,
): PreDetectedGap[] {
  const briefText = lowerJoin(brief);
  const components = allComponents(registry);

  // Each: [canonical_name, trigger_terms_in_brief, registry_match_terms]
  const forms: Array<{ name: string; trigger: string[]; match: string[]; reason: string }> = [
    {
      name: "Formulario post-llamada",
      trigger: ["llamada", "llamadas", "post-llamada", "postllamada", "ficha de llamada", "resumen de llamada"],
      match: ["formulario post-llamada", "post-call form", "ficha de llamada", "resumen llamada"],
      reason: "Brief describe llamadas comerciales que necesitan ser registradas estructuradamente.",
    },
    {
      name: "Validación de rol de usuario",
      trigger: ["rol", "roles", "permisos", "validación de usuario", "perfil de usuario"],
      match: ["validación de rol", "role validation", "validador de rol"],
      reason: "Brief menciona múltiples roles que requieren validación.",
    },
    {
      name: "Ficha de propietario",
      trigger: ["propietario", "propietarios", "owner"],
      match: ["ficha de propietario", "owner card", "owner form"],
      reason: "Brief menciona propietarios como entidad a gestionar.",
    },
    {
      name: "Ficha de inversor / comprador",
      trigger: ["inversor", "inversores", "comprador", "compradores", "investor"],
      match: ["ficha de inversor", "ficha de comprador", "investor card", "buyer card"],
      reason: "Brief menciona inversores/compradores como entidad a gestionar.",
    },
    {
      name: "Ficha de activo",
      trigger: ["activo", "activos", "edificio", "edificios", "inmueble", "inmuebles"],
      match: ["ficha de activo", "asset card", "asset form"],
      reason: "Brief menciona activos/edificios como entidad a gestionar.",
    },
  ];

  const gaps: PreDetectedGap[] = [];
  for (const f of forms) {
    const hits = briefMentionsAny(briefText, f.trigger);
    if (hits.length === 0) continue;

    const matched = components.some((c) => {
      const text = lowerJoin(c.name, c.business_job, c.family);
      return f.match.some((m) => text.includes(m.toLowerCase()));
    });
    if (matched) continue;

    gaps.push({
      dedupe_key: `missing_form__${f.name.toLowerCase().replace(/\s+/g, "_")}`,
      title: `Formulario faltante: ${f.name}`,
      gap_type: "missing_form",
      severity: "medium",
      evidence: hits.slice(0, 3).map((h) => `briefing menciona "${h}"`),
      affected_registry_components: [],
      suggested_action: "add_component",
      suggested_component_candidate: {
        name: f.name,
        family: "form",
        layer: "B_action",
        priority: "P2_medium",
        suggested_delivery_phase: "MVP",
        business_job: `Capturar ${f.name.toLowerCase()} de forma estructurada para alimentar el resto del sistema.`,
        business_justification: f.reason,
      },
      reason: f.reason,
      detector: "D4_missing_form",
    });
  }
  return gaps;
}

/**
 * D5 — MoE / intent router missing when there are 3+ specialized
 * agents/RAGs that need orchestration.
 */
export function detectMoERoutingGap(registry: ComponentRegistry | null | undefined): PreDetectedGap[] {
  const components = allComponents(registry);
  const specialists = components.filter((c) => {
    const fam = (c.family ?? "").toLowerCase();
    return fam.includes("agent") || fam.includes("rag") || fam.includes("specialist") || fam.includes("classifier");
  });
  if (specialists.length < 3) return [];

  if (hasFamily(registry, "moe_router", "intent_classifier", "router", "orchestrator")) return [];

  return [{
    dedupe_key: "missing_moe_router",
    title: `Hay ${specialists.length} especialistas/agentes/RAGs sin router MoE`,
    gap_type: "missing_moe_route",
    severity: "high",
    evidence: specialists.slice(0, 5).map((c) => `${compId(c)} (${c.family})`),
    affected_registry_components: specialists.map(compId),
    suggested_action: "add_component",
    suggested_component_candidate: {
      name: "Router de intención (MoE)",
      family: "moe_router",
      layer: "C_intelligence",
      priority: "P1_high",
      suggested_delivery_phase: "MVP",
      business_job: "Clasificar la intención del usuario y enrutar a los especialistas/RAGs adecuados (clasificación, copy, compliance, matching, valoración).",
      business_justification: "Sin router MoE, los especialistas no se orquestan y la experiencia se vuelve incoherente.",
    },
    reason: "Múltiples especialistas/RAGs sin un router que decida cuál usar.",
    detector: "D5_missing_moe_router",
  }];
}

/**
 * D6 — Soul coverage gap: founder commitment signals or 3+ components
 * depending on Soul, but no D_soul module exists. (Safety net — F2 backfill
 * already covers this, but we re-check at F4a level.)
 */
export function detectSoulCoverageGap(
  brief: any,
  registry: ComponentRegistry | null | undefined,
): PreDetectedGap[] {
  const components = allComponents(registry);
  const dependents = components.filter((c) => {
    const dep = (c.soul_dependency ?? "none").toLowerCase();
    return dep === "consults_soul" || dep === "requires_soul_approval";
  });

  const briefText = lowerJoin(brief);
  const founderHit = briefMentionsAny(briefText, ["alejandro", "founder", "ceo ", "criterio del fundador", "know-how", "soul"]);

  const triggered = dependents.length >= 3 || founderHit.length > 0;
  if (!triggered) return [];

  const hasSoul = components.some((c) => {
    const fam = (c.family ?? "").toLowerCase();
    const layer = (c.layer ?? "").toLowerCase();
    return fam === "soul_module" || layer === "d_soul";
  });
  if (hasSoul) return [];

  return [{
    dedupe_key: "missing_soul_module",
    title: "Soul del fundador no presente pese a múltiples dependencias o señales de criterio del fundador",
    gap_type: "missing_component",
    severity: "critical",
    evidence: [
      ...founderHit.map((h) => `briefing menciona "${h}"`),
      ...(dependents.length > 0 ? [`${dependents.length} componentes dependen del Soul`] : []),
    ],
    affected_registry_components: dependents.map(compId),
    suggested_action: "add_component",
    suggested_component_candidate: {
      name: founderHit.includes("alejandro") ? "Soul de Alejandro" : "Soul del fundador",
      family: "soul_module",
      layer: "D_soul",
      priority: "P0_critical",
      suggested_delivery_phase: "MVP",
      business_job: "Capturar y operacionalizar el criterio estratégico del fundador para que los agentes lo consulten de forma consistente.",
      business_justification: "Múltiples componentes dependen del Soul, o el brief menciona criterio del fundador, pero no existe componente D_soul.",
    },
    reason: "Red de seguridad post-F2: si F2 falló al inyectar Soul, F4a lo marca como gap crítico.",
    detector: "D6_missing_soul_module",
  }];
}

/**
 * D7 — Overloaded component that should be split. Heuristic: business_job
 * lists 4+ distinct action verbs OR component covers 4+ heterogeneous signal_ids.
 */
export function detectOverloadedComponentSplit(
  registry: ComponentRegistry | null | undefined,
): PreDetectedGap[] {
  const verbs = ["captur", "transcrib", "analiz", "clasific", "notific", "valor", "match", "buscar", "extraer", "scor", "rankear", "generar"];
  const gaps: PreDetectedGap[] = [];

  for (const c of allComponents(registry)) {
    const job = (c.business_job ?? "").toLowerCase();
    const verbHits = verbs.filter((v) => job.includes(v));
    const signals = Array.isArray(c.signal_ids) ? c.signal_ids : [];

    const overloadedByVerbs = verbHits.length >= 4;
    const overloadedBySignals = signals.length >= 4;
    if (!overloadedByVerbs && !overloadedBySignals) continue;

    gaps.push({
      dedupe_key: `overloaded__${compId(c)}`,
      title: `Componente ${compId(c)} (${c.name ?? "?"}) tiene demasiadas responsabilidades`,
      gap_type: "component_should_be_split",
      severity: "medium",
      evidence: [
        overloadedByVerbs ? `business_job contiene ${verbHits.length} verbos de acción: ${verbHits.join(", ")}` : "",
        overloadedBySignals ? `cubre ${signals.length} signal_ids` : "",
      ].filter(Boolean),
      affected_registry_components: [compId(c)],
      suggested_action: "split_component",
      reason: "Componente sobrecargado: dificulta gobierno, testing y faseado.",
      detector: "D7_overloaded_component",
    });
  }
  return gaps;
}

// ───────────────────────────────────────────────────────────────────────────────
// Aggregator
// ───────────────────────────────────────────────────────────────────────────────

export function runAllDetectors(
  brief: any,
  registry: ComponentRegistry | null | undefined,
): PreDetectedGap[] {
  const all = [
    ...detectMissingDataPipelineFromCallSignals(brief, registry),
    ...detectInstitutionalBuyerDetectorGap(brief, registry),
    ...detectExternalSourceGaps(brief, registry),
    ...detectMissingForms(brief, registry),
    ...detectMoERoutingGap(registry),
    ...detectSoulCoverageGap(brief, registry),
    ...detectOverloadedComponentSplit(registry),
  ];

  // Dedupe by dedupe_key — last-write-wins.
  const map = new Map<string, PreDetectedGap>();
  for (const g of all) {
    map.set(g.dedupe_key, g);
  }
  return [...map.values()];
}
