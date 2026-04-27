/**
 * f7-proposal-builder.ts — Step 30 deterministic Client Proposal builder.
 *
 * Reads Step 28 scope_architecture_v1, Step 2 brief (optional summary), and
 * commercial_terms_v1 (provided by user). Builds client_proposal_v1 — a single
 * business-friendly document. NO LLM, no internal jargon (no "Step 28", no
 * "F4b", no "registry", no SQL).
 *
 * Created: 2026-04-25
 */

import type { ScopeArchitectureV1, ScopeComponent } from "./f5-deterministic-scope.ts";

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────

export type PricingModel =
  | "fixed_project"
  | "setup_plus_monthly"
  | "phased"
  | "retainer"
  | "mixed";

export interface CommercialTermsV1 {
  pricing_model: PricingModel;
  setup_fee?: number;
  setup_fee_max?: number;
  setup_fee_display?: string;
  monthly_retainer?: number;
  monthly_retainer_max?: number;
  monthly_retainer_display?: string;
  phase_prices?: Array<{ phase: string; price: number; description?: string }>;
  ai_usage_cost_policy?: string;
  payment_terms?: string;
  timeline?: string;
  validity_days?: number;
  taxes?: string;
  currency?: string;
  included_services?: string[];
  excluded_services?: string[];
  optional_addons?: Array<{ name: string; price?: number; description?: string }>;
  support_terms?: string;
  legal_notes?: string;
  notes?: string;
}

export interface ProposalScopeItem {
  title: string;
  description: string;
}

/**
 * Override manual del cronograma. Si está presente y tiene valores válidos,
 * sobrescribe la heurística determinista. Cualquier campo es opcional —
 * se aplican solo los que vengan rellenos.
 */
export interface ImplementationOverride {
  mvp_weeks?: number;
  fast_follow_weeks?: number;
  /** ISO YYYY-MM-DD. Si está, se calculan fechas absolutas. */
  start_date?: string;
  notes?: string;
}

export interface ImplementationPhase {
  name: string;
  duration_weeks: string;
  start_week: number;
  end_week: number;
  start_date?: string; // ISO si start_date global está disponible
  end_date?: string;
  component_count: number;
  key_milestones: string[];
  deliverable: string;
}

export interface ImplementationSchedule {
  phases: ImplementationPhase[];
  total_duration_weeks: string;
  mvp_ready_week: number;
  start_date?: string;
  assumptions: string[];
  notes?: string;
  source: "heuristic" | "override" | "mixed";
}

export interface ClientProposalV1 {
  schema_version: "1.0.0";
  project_name: string;
  /** Compatibilidad: nombre principal mostrado al cliente. Igual a client_company. */
  client_name: string;
  client_company: string;
  decision_maker_name?: string;
  generated_at: string;
  validity_days: number;
  source_step: { step_number: 28; version: number; row_id: string };
  executive_summary: string;
  context: string;
  problems_detected: string[];
  proposed_solution: string;
  mvp_scope: ProposalScopeItem[];
  later_phases: {
    fast_follow: ProposalScopeItem[];
    roadmap: ProposalScopeItem[];
  };
  out_of_scope: string[];
  implementation_plan: {
    summary: string;
    soul_sessions_required: boolean;
    soul_sessions_count: number;
    timeline: string;
    /** F7.1 — Cronograma por fases derivado del scope, con override opcional. */
    schedule?: ImplementationSchedule;
  };
  client_responsibilities: string[];
  risks_and_mitigations: Array<{ risk: string; mitigation: string }>;
  conditions: string[];
  budget: {
    pricing_model: PricingModel;
    currency: string;
    setup_fee?: number;
    setup_fee_max?: number;
    setup_fee_display?: string;
    monthly_retainer?: number;
    monthly_retainer_max?: number;
    monthly_retainer_display?: string;
    phase_prices?: Array<{ phase: string; price: number; description?: string }>;
    optional_addons?: Array<{ name: string; price?: number; description?: string }>;
    ai_usage_cost_policy?: string;
    taxes?: string;
  };
  payment_terms: string;
  support_terms?: string;
  legal_notes?: string;
  next_steps: string[];
}

export interface ProposalMeta {
  generated_at: string;
  f7_ms: number;
  source_step: { step_number: 28; version: number; row_id: string };
  mvp_count: number;
  fast_follow_count: number;
  roadmap_count: number;
  out_of_scope_count: number;
  has_compliance_blockers: boolean;
  has_data_readiness_blockers: boolean;
  soul_required: boolean;
}

export interface F7Output {
  client_proposal_v1: ClientProposalV1;
  proposal_meta: ProposalMeta;
}

// ───────────────────────────────────────────────────────────────────────────────
// Helpers — translate component → business language
// ───────────────────────────────────────────────────────────────────────────────

function clientLabelFor(c: ScopeComponent): string {
  // Strip technical prefixes and uppercase IDs from name when present.
  const raw = (c.name ?? c.source_ref).trim();
  return raw.replace(/^COMP-[A-Z0-9]+\s*[-—:]?\s*/i, "");
}

function clientDescriptionFor(c: ScopeComponent): string {
  if (c.business_job && c.business_job.trim().length > 0) return c.business_job.trim();
  if (c.notes && c.notes.trim().length > 0) return c.notes.trim();
  return "Funcionalidad incluida en el alcance comprometido.";
}

function toScopeItem(c: ScopeComponent): ProposalScopeItem {
  return {
    title: clientLabelFor(c),
    description: clientDescriptionFor(c),
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Public builder
// ───────────────────────────────────────────────────────────────────────────────

export interface F7Input {
  scope: ScopeArchitectureV1;
  source_step: { step_number: 28; version: number; row_id: string };
  projectName: string;
  /** Backwards-compat: si no se pasa clientCompany, se usa clientName. */
  clientName?: string;
  /** Empresa cliente (cabecera/portada). p.ej. "AFLU / AFFLUX". */
  clientCompany?: string;
  /** Persona física que decide. p.ej. "Alejandro Gordo". */
  decisionMakerName?: string;
  briefSummary?: string;
  problemsDetected?: string[];
  commercialTerms: CommercialTermsV1;
}

// ───────────────────────────────────────────────────────────────────────────────
// Internal: weeks_window → ES nativo
// ───────────────────────────────────────────────────────────────────────────────

const WEEKS_WINDOW_ES: Record<string, string> = {
  weeks_1_to_2: "semanas 1 y 2",
  weeks_1_to_3: "semanas 1 a 3",
  weeks_1_to_4: "semanas 1 a 4",
  weeks_2_to_4: "semanas 2 a 4",
  weeks_2_to_6: "semanas 2 a 6",
};

function weeksWindowEs(raw: string | undefined | null): string {
  if (!raw) return "primeras semanas";
  if (WEEKS_WINDOW_ES[raw]) return WEEKS_WINDOW_ES[raw];
  // Fallback genérico: weeks_X_to_Y → "semanas X a Y"
  const m = raw.match(/^weeks?_(\d+)_to_(\d+)$/i);
  if (m) {
    const a = m[1], b = m[2];
    return Number(b) - Number(a) === 1 ? `semanas ${a} y ${b}` : `semanas ${a} a ${b}`;
  }
  // Último fallback: limpiar guiones bajos.
  return raw.replace(/_/g, " ");
}

/**
 * Limpia frases con lenguaje interno (margen, coste interno, tarifa por hora,
 * horas estimadas, rentabilidad) que NUNCA deben aparecer en el documento cliente.
 * Trabaja sentence-by-sentence para preservar el resto del texto.
 */
function scrubInternalLeak(text: string | undefined | null): string {
  if (!text) return "";
  const sentences = String(text).split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((s) => {
    const lower = s.toLowerCase();
    return !(
      /\bmargen\b/.test(lower) ||
      /\bmargin\b/.test(lower) ||
      /coste\s+interno/.test(lower) ||
      /tarifa\s+(?:por\s+hora|interna|hora)/.test(lower) ||
      /hourly\s*rate/.test(lower) ||
      /horas?\s+(?:estimadas|internas|de\s+consultor)/.test(lower) ||
      /\brentabilidad\b/.test(lower) ||
      /margen\s+de\s+consultor/.test(lower)
    );
  });
  return kept.join(" ").trim();
}

export function buildClientProposal(input: F7Input): F7Output {
  const t0 = Date.now();
  const { scope, commercialTerms } = input;

  // ── Guard: presupuesto debe traer importes reales ──
  const hasBudget =
    typeof commercialTerms.setup_fee === "number" ||
    typeof commercialTerms.monthly_retainer === "number" ||
    (typeof commercialTerms.setup_fee_display === "string" && commercialTerms.setup_fee_display.trim().length > 0) ||
    (typeof commercialTerms.monthly_retainer_display === "string" && commercialTerms.monthly_retainer_display.trim().length > 0) ||
    (commercialTerms.phase_prices?.length ?? 0) > 0;
  if (!hasBudget) {
    throw new Error("MISSING_BUDGET_AMOUNTS: la propuesta no puede generarse sin importes (setup_fee, monthly_retainer o phase_prices).");
  }

  // ── Guard: el scope de Step 28 debe tener al menos 1 componente productivo ──
  const totalScope =
    (scope.data_foundation?.length ?? 0) +
    (scope.mvp?.length ?? 0) +
    (scope.fast_follow_f2?.length ?? 0) +
    (scope.roadmap_f3?.length ?? 0);
  if (totalScope === 0) {
    throw new Error("EMPTY_SCOPE: el alcance aprobado en Step 28 está vacío.");
  }

  // REGLA DE ORO: si no hay clientCompany real, mostrar el projectName
  // del usuario (nunca dejar "Cliente" genérico ni una variante OCR).
  const projectNameClean = (input.projectName || "").trim() || "Proyecto";
  const rawClientCompany = (input.clientCompany ?? input.clientName ?? "").trim();
  const clientCompany = rawClientCompany.length > 0 ? rawClientCompany : projectNameClean;
  const decisionMakerName = input.decisionMakerName?.trim() || undefined;

  const currency = commercialTerms.currency ?? "EUR";
  const validityDays = commercialTerms.validity_days ?? 30;

  const mvp = (scope.data_foundation ?? [])
    .concat(scope.mvp ?? [])
    .map(toScopeItem);
  const fastFollow = (scope.fast_follow_f2 ?? []).map(toScopeItem);
  const roadmap = (scope.roadmap_f3 ?? []).map(toScopeItem);
  const outOfScope = (scope.rejected_out_of_scope ?? []).map((c) => clientLabelFor(c));

  const hasCompliance = (scope.compliance_blockers?.length ?? 0) > 0;
  const hasDataReadiness = (scope.data_readiness_blockers?.length ?? 0) > 0;
  const soulRequired = !!scope.soul_capture_plan?.required;

  const conditions: string[] = [];
  if (hasCompliance) {
    conditions.push(
      "Cumplimiento normativo (DPIA, base legal, política de retención y protocolo HITL) firmado por el responsable legal del cliente antes de la puesta en producción. No bloquea diseño ni testing interno.",
    );
  }
  if (hasDataReadiness) {
    conditions.push(
      "Acceso a los datasets requeridos por el cliente, con un nivel mínimo de preparación acordado antes de comprometer la fase productiva de los módulos afectados.",
    );
  }
  if (soulRequired) {
    conditions.push(
      `Sesiones de captura de criterio (${scope.soul_capture_plan.sessions} sesiones de ${scope.soul_capture_plan.session_duration_min} minutos) en las primeras ${weeksWindowEs(scope.soul_capture_plan.weeks_window)} del proyecto.`,
    );
  }
  conditions.push(
    "Costes de terceros (proveedores de IA, APIs externas, infraestructura) facturados según consumo real conforme a la política definida más adelante.",
  );
  conditions.push(
    "Cualquier cambio sobre el alcance comprometido se gestiona como ampliación y se valora aparte.",
  );

  const risks: Array<{ risk: string; mitigation: string }> = [];
  if (soulRequired) {
    risks.push({
      risk: "Retraso en las sesiones de captura de criterio puede atrasar los módulos que dependen de ellas.",
      mitigation:
        "Reglas heurísticas y proxy operativo documentado para los componentes con dependencia asíncrona; los componentes con dependencia dura quedan inactivos hasta disponer del corpus.",
    });
  }
  if (hasCompliance) {
    risks.push({
      risk: "Demora en la firma de los artefactos de cumplimiento puede retrasar la puesta en producción.",
      mitigation:
        "Diseño y testing interno avanzan en paralelo. El bloqueo aplica únicamente al despliegue productivo.",
    });
  }
  if (hasDataReadiness) {
    risks.push({
      risk: "Datasets por debajo del umbral mínimo de preparación pueden afectar la calidad del componente.",
      mitigation:
        "Plan de acciones de desbloqueo definido por componente (limpieza, enriquecimiento, ampliación de cobertura) priorizado al inicio del proyecto.",
    });
  }
  risks.push({
    risk: "Cambios estratégicos en el negocio del cliente durante el proyecto pueden alterar el alcance acordado.",
    mitigation: "Revisiones de alcance al cierre de cada fase con valoración formal de impacto.",
  });

  const clientResponsibilities: string[] = [
    "Designar un interlocutor único con capacidad de decisión durante todo el proyecto.",
    "Facilitar el acceso a sistemas, datos y stakeholders necesarios en los plazos acordados.",
    "Validar entregables al cierre de cada fase dentro de los plazos definidos.",
  ];
  if (soulRequired) {
    clientResponsibilities.push(
      "Asegurar la disponibilidad del responsable estratégico para las sesiones de captura de criterio.",
    );
  }
  if (hasCompliance) {
    clientResponsibilities.push(
      "Aprobar los artefactos de cumplimiento normativo (DPIA, base legal, política de retención, protocolo HITL) antes de producción.",
    );
  }
  if (hasDataReadiness) {
    clientResponsibilities.push(
      "Proveer y mantener los datasets requeridos en las condiciones mínimas de calidad acordadas.",
    );
  }

  const nextSteps: string[] = [
    `Validar y firmar esta propuesta dentro de los próximos ${validityDays} días.`,
    "Programar reunión de arranque con el equipo asignado.",
  ];
  if (soulRequired) {
    nextSteps.push("Reservar las sesiones de captura de criterio en las primeras semanas.");
  }
  if (hasCompliance) {
    nextSteps.push("Iniciar el proceso interno de cumplimiento normativo en paralelo al diseño.");
  }

  const proposal: ClientProposalV1 = {
    schema_version: "1.0.0",
    project_name: input.projectName,
    client_name: clientCompany,
    client_company: clientCompany,
    decision_maker_name: decisionMakerName,
    generated_at: new Date().toISOString(),
    validity_days: validityDays,
    source_step: input.source_step,
    executive_summary:
      `Propuesta para diseñar e implementar la solución a medida acordada con ${clientCompany}. ` +
      `El alcance comprometido incluye ${mvp.length} módulos productivos` +
      (fastFollow.length > 0 ? ` y ${fastFollow.length} módulos planificados como segundo lote` : "") +
      (roadmap.length > 0 ? `, además de ${roadmap.length} módulos contemplados en roadmap posterior` : "") +
      ". " +
      (soulRequired
        ? "El proyecto incorpora sesiones de captura de criterio estratégico al inicio para garantizar que la solución refleje fielmente la lógica de decisión del responsable. "
        : "") +
      (hasCompliance
        ? "Las garantías de cumplimiento normativo se preparan en paralelo al diseño y se firman antes de la puesta en producción."
        : ""),
    context:
      input.briefSummary?.trim() ||
      `Solución a medida para ${clientCompany}, basada en el análisis y las decisiones acordadas durante la fase de descubrimiento.`,
    problems_detected:
      input.problemsDetected && input.problemsDetected.length > 0
        ? [...input.problemsDetected]
        : [
            "Procesos críticos del negocio sin soporte tecnológico estructurado.",
            "Decisiones estratégicas dependientes de criterio individual no formalizado.",
            "Oportunidades comerciales identificables que hoy no se capturan de forma sistemática.",
          ],
    proposed_solution:
      "Plataforma a medida que combina captura estructurada de información, automatización de los procesos clave y soporte a la toma de decisiones, entregada en fases acotadas y verificables.",
    mvp_scope: mvp,
    later_phases: {
      fast_follow: fastFollow,
      roadmap,
    },
    out_of_scope: outOfScope,
    implementation_plan: {
      summary:
        "El proyecto se ejecuta en fases. Cada fase tiene entregables verificables y un cierre formal antes de iniciar la siguiente.",
      soul_sessions_required: soulRequired,
      soul_sessions_count: soulRequired ? scope.soul_capture_plan.sessions : 0,
      timeline:
        commercialTerms.timeline?.trim() ||
        "Plazos detallados a confirmar al cierre de la sesión de arranque, una vez validados disponibilidad y prioridades.",
    },
    client_responsibilities: clientResponsibilities,
    risks_and_mitigations: risks,
    conditions,
    budget: {
      pricing_model: commercialTerms.pricing_model,
      currency,
      setup_fee: commercialTerms.setup_fee,
      setup_fee_max: commercialTerms.setup_fee_max,
      setup_fee_display: commercialTerms.setup_fee_display,
      monthly_retainer: commercialTerms.monthly_retainer,
      monthly_retainer_max: commercialTerms.monthly_retainer_max,
      monthly_retainer_display: commercialTerms.monthly_retainer_display,
      phase_prices: commercialTerms.phase_prices,
      optional_addons: commercialTerms.optional_addons,
      ai_usage_cost_policy: commercialTerms.ai_usage_cost_policy,
      taxes: commercialTerms.taxes,
    },
    payment_terms: scrubInternalLeak(commercialTerms.payment_terms) ||
      "50% al inicio del proyecto y 50% contra entrega del MVP. Mensualidades, en su caso, facturadas a mes vencido.",
    support_terms: scrubInternalLeak(commercialTerms.support_terms) || undefined,
    legal_notes: scrubInternalLeak(commercialTerms.legal_notes) || undefined,
    next_steps: nextSteps,
  };

  return {
    client_proposal_v1: proposal,
    proposal_meta: {
      generated_at: proposal.generated_at,
      f7_ms: Date.now() - t0,
      source_step: input.source_step,
      mvp_count: mvp.length,
      fast_follow_count: fastFollow.length,
      roadmap_count: roadmap.length,
      out_of_scope_count: outOfScope.length,
      has_compliance_blockers: hasCompliance,
      has_data_readiness_blockers: hasDataReadiness,
      soul_required: soulRequired,
    },
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Markdown renderer
// ───────────────────────────────────────────────────────────────────────────────

function fmtMoney(n: number | undefined, currency: string): string {
  if (typeof n !== "number" || !isFinite(n)) return "—";
  return `${n.toLocaleString("es-ES", { maximumFractionDigits: 2 })} ${currency}`;
}

const PRICING_MODEL_LABEL_ES: Record<string, string> = {
  fixed_project: "Proyecto cerrado",
  setup_plus_monthly: "Cuota inicial + mensualidad recurrente",
  subscription: "Suscripción mensual",
  phased: "Pago por fases",
  retainer: "Iguala mensual",
  mixed: "Modelo mixto",
};

export function renderProposalMarkdown(p: ClientProposalV1): string {
  const c = p.budget.currency;
  const lines: string[] = [];

  // ── Cabecera ──
  // REGLA DE ORO: el title y el CONFIDENCIAL salen del project_name (lo
  // que escribió el usuario). client_company puede ser "AFLU / AFFLUX" o
  // similar y se muestra solo en la portada como dato adicional.
  const headerCompany = p.client_company && p.client_company !== p.project_name
    ? p.client_company
    : p.project_name;
  lines.push(`# Propuesta — ${p.project_name}`);
  lines.push("");
  lines.push(`> **CONFIDENCIAL — ${p.project_name}**`);
  lines.push("");
  lines.push(`**Proyecto / Producto:** ${p.project_name}`);
  lines.push(`**Cliente / empresa:** ${headerCompany}`);
  if (p.decision_maker_name) {
    lines.push(`**Decisor:** ${p.decision_maker_name}`);
  }
  lines.push(`**Fecha:** ${p.generated_at.substring(0, 10)} · **Validez:** ${p.validity_days} días`);
  lines.push("");

  // ── Numeración dinámica ──
  let n = 1;
  const section = (title: string) => {
    lines.push(`## ${n++}. ${title}`);
    lines.push("");
  };

  section("Resumen ejecutivo");
  lines.push(p.executive_summary);
  lines.push("");

  section("Contexto");
  lines.push(p.context);
  lines.push("");

  section("Problemas detectados");
  for (const x of p.problems_detected) lines.push(`- ${x}`);
  lines.push("");

  section("Propuesta de solución");
  lines.push(p.proposed_solution);
  lines.push("");

  section("Alcance MVP");
  if (p.mvp_scope.length === 0) {
    lines.push("_Sin módulos definidos en el MVP._");
  } else {
    for (const it of p.mvp_scope) {
      lines.push(`### ${it.title}`);
      lines.push(it.description);
      lines.push("");
    }
  }

  // Fases posteriores: solo si hay algo que mostrar
  const hasFastFollow = p.later_phases.fast_follow.length > 0;
  const hasRoadmap = p.later_phases.roadmap.length > 0;
  if (hasFastFollow || hasRoadmap) {
    section("Fases posteriores");
    if (hasFastFollow) {
      lines.push("### Segundo lote (fast follow)");
      for (const it of p.later_phases.fast_follow) {
        lines.push(`- **${it.title}** — ${it.description}`);
      }
      lines.push("");
    }
    if (hasRoadmap) {
      lines.push("### Roadmap posterior");
      for (const it of p.later_phases.roadmap) {
        lines.push(`- **${it.title}** — ${it.description}`);
      }
      lines.push("");
    }
  }

  // Out of scope: solo si hay algo que mostrar
  if (p.out_of_scope.length > 0) {
    section("Qué queda fuera");
    for (const x of p.out_of_scope) lines.push(`- ${x}`);
    lines.push("");
  }

  section("Plan de implementación");
  lines.push(p.implementation_plan.summary);
  if (p.implementation_plan.soul_sessions_required) {
    lines.push("");
    lines.push(`Incluye ${p.implementation_plan.soul_sessions_count} sesiones de captura de criterio estratégico al inicio del proyecto.`);
  }
  lines.push("");
  lines.push(`**Plazos:** ${p.implementation_plan.timeline}`);
  lines.push("");

  section("Responsabilidades del cliente");
  for (const x of p.client_responsibilities) lines.push(`- ${x}`);
  lines.push("");

  section("Riesgos y mitigaciones");
  for (const r of p.risks_and_mitigations) {
    lines.push(`- **Riesgo:** ${r.risk}`);
    lines.push(`  - **Mitigación:** ${r.mitigation}`);
  }
  lines.push("");

  section("Presupuesto");
  const modelLabel = PRICING_MODEL_LABEL_ES[p.budget.pricing_model] ?? p.budget.pricing_model;
  lines.push(`**Modalidad:** ${modelLabel}`);
  lines.push("");

  // Helper: prefiere display si está; si no, formatea el número.
  const displaySetup = p.budget.setup_fee_display ??
    (p.budget.setup_fee !== undefined ? fmtMoney(p.budget.setup_fee, c) : undefined);
  const displayMonthly = p.budget.monthly_retainer_display ??
    (p.budget.monthly_retainer !== undefined ? fmtMoney(p.budget.monthly_retainer, c) : undefined);

  if (displaySetup) {
    lines.push(`- **Cuota inicial:** ${displaySetup}`);
  }
  if (displayMonthly) {
    lines.push(`- **Mensualidad recurrente:** ${displayMonthly}`);
  }
  // Total de referencia (orientativo a 12 meses) — solo si tenemos números
  // numéricos exactos (no rangos). Si hay rango (max definido), no calculamos.
  if (
    p.budget.setup_fee !== undefined &&
    p.budget.monthly_retainer !== undefined &&
    p.budget.setup_fee_max === undefined &&
    p.budget.monthly_retainer_max === undefined
  ) {
    const total12 = p.budget.setup_fee + p.budget.monthly_retainer * 12;
    lines.push(`- **Total estimado primer año:** ${fmtMoney(total12, c)} _(cuota inicial + 12 mensualidades)_`);
  }
  if (p.budget.phase_prices && p.budget.phase_prices.length > 0) {
    lines.push("- **Precios por fase:**");
    for (const ph of p.budget.phase_prices) {
      lines.push(`  - **${ph.phase}**: ${fmtMoney(ph.price, c)}${ph.description ? ` — ${ph.description}` : ""}`);
    }
  }
  if (p.budget.optional_addons && p.budget.optional_addons.length > 0) {
    lines.push("- **Opcionales (no incluidos en el precio base):**");
    for (const a of p.budget.optional_addons) {
      lines.push(`  - **${a.name}**${a.price !== undefined ? `: ${fmtMoney(a.price, c)}` : ""}${a.description ? ` — ${a.description}` : ""}`);
    }
  }
  if (p.budget.ai_usage_cost_policy) {
    lines.push("");
    lines.push(`**Costes de IA / terceros:** ${p.budget.ai_usage_cost_policy}`);
  }
  if (p.budget.taxes) {
    lines.push("");
    lines.push(`**Impuestos:** ${p.budget.taxes}`);
  }
  lines.push("");

  section("Modalidad de pago");
  lines.push(p.payment_terms);
  lines.push("");

  if (p.support_terms) {
    section("Soporte post-entrega");
    lines.push(p.support_terms);
    lines.push("");
  }

  section("Condiciones");
  for (const x of p.conditions) lines.push(`- ${x}`);
  lines.push("");

  if (p.legal_notes) {
    section("Notas legales");
    lines.push(p.legal_notes);
    lines.push("");
  }

  lines.push("## Próximos pasos");
  lines.push("");
  for (const x of p.next_steps) lines.push(`- ${x}`);
  return lines.join("\n");
}

// ───────────────────────────────────────────────────────────────────────────────
// Internal-jargon guard — fails the build if banned phrases leak into output
// ───────────────────────────────────────────────────────────────────────────────

const BANNED_PHRASES = [
  /\bstep\s*2[5-9]\b/i,
  /\bstep\s*3[0-1]\b/i,
  /\bF[0-9]\b/, // F0..F9 phase tags (e.g., F4b, F5)
  /\bregistry_gap_audit\b/i,
  /\bregistry_feasibility_audit\b/i,
  /\bscope_architecture_v1\b/i,
  /\bcomponent_registry\b/i,
  /\bedge function\b/i,
  /\bRLS\b/,
  /\bSQL\b/,
  // Internal pricing leak — never in client docs.
  /margen\s+de\s+consultor[ií]a/i,
  /\bmargen\s+(?:del?\s+)?\d+\s*%/i,
  /coste\s+interno/i,
  /tarifa\s+(?:por\s+hora|interna)/i,
  /hourly\s*rate/i,
  /horas?\s+(?:estimadas|internas)/i,
];

export function detectInternalJargon(markdown: string): string[] {
  const found: string[] = [];
  for (const re of BANNED_PHRASES) {
    const m = markdown.match(re);
    if (m) found.push(m[0]);
  }
  return found;
}
