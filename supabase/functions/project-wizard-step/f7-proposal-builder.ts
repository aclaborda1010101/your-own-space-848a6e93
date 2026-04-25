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
  monthly_retainer?: number;
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

export interface ClientProposalV1 {
  schema_version: "1.0.0";
  project_name: string;
  client_name: string;
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
  };
  client_responsibilities: string[];
  risks_and_mitigations: Array<{ risk: string; mitigation: string }>;
  conditions: string[];
  budget: {
    pricing_model: PricingModel;
    currency: string;
    setup_fee?: number;
    monthly_retainer?: number;
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
  clientName: string;
  briefSummary?: string;
  problemsDetected?: string[];
  commercialTerms: CommercialTermsV1;
}

export function buildClientProposal(input: F7Input): F7Output {
  const t0 = Date.now();
  const { scope, commercialTerms } = input;

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
      `Sesiones de captura de criterio (${scope.soul_capture_plan.sessions} sesiones de ${scope.soul_capture_plan.session_duration_min} minutos) en las primeras ${scope.soul_capture_plan.weeks_window.replace(/_/g, " ")} del proyecto.`,
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
    client_name: input.clientName,
    generated_at: new Date().toISOString(),
    validity_days: validityDays,
    source_step: input.source_step,
    executive_summary:
      `Propuesta para diseñar e implementar la solución a medida acordada con ${input.clientName}. ` +
      `El alcance comprometido incluye ${mvp.length} módulos productivos, ` +
      `${fastFollow.length} módulos planificados como segundo lote y ` +
      `${roadmap.length} módulos contemplados en roadmap posterior. ` +
      (soulRequired
        ? "El proyecto incorpora sesiones de captura de criterio estratégico al inicio para garantizar que la solución refleje fielmente la lógica de decisión del responsable. "
        : "") +
      (hasCompliance
        ? "Las garantías de cumplimiento normativo se preparan en paralelo al diseño y se firman antes de la puesta en producción."
        : ""),
    context:
      input.briefSummary?.trim() ||
      `Solución a medida para ${input.clientName}, basada en el análisis y las decisiones acordadas durante la fase de descubrimiento.`,
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
      monthly_retainer: commercialTerms.monthly_retainer,
      phase_prices: commercialTerms.phase_prices,
      optional_addons: commercialTerms.optional_addons,
      ai_usage_cost_policy: commercialTerms.ai_usage_cost_policy,
      taxes: commercialTerms.taxes,
    },
    payment_terms:
      commercialTerms.payment_terms?.trim() ||
      "50% al inicio del proyecto y 50% contra entrega del MVP. Mensualidades, en su caso, facturadas a mes vencido.",
    support_terms: commercialTerms.support_terms,
    legal_notes: commercialTerms.legal_notes,
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

export function renderProposalMarkdown(p: ClientProposalV1): string {
  const c = p.budget.currency;
  const lines: string[] = [];
  lines.push(`# Propuesta — ${p.project_name}`);
  lines.push("");
  lines.push(`**Cliente:** ${p.client_name}`);
  lines.push(`**Fecha:** ${p.generated_at.substring(0, 10)} · **Validez:** ${p.validity_days} días`);
  lines.push("");
  lines.push("## 1. Resumen ejecutivo");
  lines.push("");
  lines.push(p.executive_summary);
  lines.push("");
  lines.push("## 2. Contexto");
  lines.push("");
  lines.push(p.context);
  lines.push("");
  lines.push("## 3. Problemas detectados");
  lines.push("");
  for (const x of p.problems_detected) lines.push(`- ${x}`);
  lines.push("");
  lines.push("## 4. Propuesta de solución");
  lines.push("");
  lines.push(p.proposed_solution);
  lines.push("");
  lines.push("## 5. Alcance MVP");
  lines.push("");
  if (p.mvp_scope.length === 0) {
    lines.push("_Sin módulos definidos en el MVP._");
  } else {
    for (const it of p.mvp_scope) {
      lines.push(`### ${it.title}`);
      lines.push(it.description);
      lines.push("");
    }
  }
  lines.push("## 6. Fases posteriores");
  lines.push("");
  lines.push("### Segundo lote (fast follow)");
  if (p.later_phases.fast_follow.length === 0) {
    lines.push("_No aplica._");
  } else {
    for (const it of p.later_phases.fast_follow) {
      lines.push(`- **${it.title}** — ${it.description}`);
    }
  }
  lines.push("");
  lines.push("### Roadmap posterior");
  if (p.later_phases.roadmap.length === 0) {
    lines.push("_No aplica._");
  } else {
    for (const it of p.later_phases.roadmap) {
      lines.push(`- **${it.title}** — ${it.description}`);
    }
  }
  lines.push("");
  lines.push("## 7. Qué queda fuera");
  lines.push("");
  if (p.out_of_scope.length === 0) {
    lines.push("_No aplica._");
  } else {
    for (const x of p.out_of_scope) lines.push(`- ${x}`);
  }
  lines.push("");
  lines.push("## 8. Plan de implementación");
  lines.push("");
  lines.push(p.implementation_plan.summary);
  if (p.implementation_plan.soul_sessions_required) {
    lines.push("");
    lines.push(`Incluye ${p.implementation_plan.soul_sessions_count} sesiones de captura de criterio estratégico al inicio del proyecto.`);
  }
  lines.push("");
  lines.push(`**Plazos:** ${p.implementation_plan.timeline}`);
  lines.push("");
  lines.push("## 9. Responsabilidades del cliente");
  lines.push("");
  for (const x of p.client_responsibilities) lines.push(`- ${x}`);
  lines.push("");
  lines.push("## 10. Riesgos y mitigaciones");
  lines.push("");
  for (const r of p.risks_and_mitigations) {
    lines.push(`- **Riesgo:** ${r.risk}`);
    lines.push(`  - **Mitigación:** ${r.mitigation}`);
  }
  lines.push("");
  lines.push("## 11. Presupuesto");
  lines.push("");
  lines.push(`**Modalidad:** ${p.budget.pricing_model}`);
  if (p.budget.setup_fee !== undefined) {
    lines.push(`- Cuota inicial: **${fmtMoney(p.budget.setup_fee, c)}**`);
  }
  if (p.budget.monthly_retainer !== undefined) {
    lines.push(`- Mensualidad recurrente: **${fmtMoney(p.budget.monthly_retainer, c)}**`);
  }
  if (p.budget.phase_prices && p.budget.phase_prices.length > 0) {
    lines.push("- Precios por fase:");
    for (const ph of p.budget.phase_prices) {
      lines.push(`  - **${ph.phase}**: ${fmtMoney(ph.price, c)}${ph.description ? ` — ${ph.description}` : ""}`);
    }
  }
  if (p.budget.optional_addons && p.budget.optional_addons.length > 0) {
    lines.push("- Opcionales (no incluidos en el precio base):");
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
  lines.push("## 12. Modalidad de pago");
  lines.push("");
  lines.push(p.payment_terms);
  lines.push("");
  if (p.support_terms) {
    lines.push("## 13. Soporte post-entrega");
    lines.push("");
    lines.push(p.support_terms);
    lines.push("");
  }
  lines.push("## 14. Condiciones");
  lines.push("");
  for (const x of p.conditions) lines.push(`- ${x}`);
  lines.push("");
  if (p.legal_notes) {
    lines.push("## 15. Notas legales");
    lines.push("");
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
  /\bF[0-7]\b/, // F0..F7 phase tags
  /\bregistry_gap_audit\b/i,
  /\bregistry_feasibility_audit\b/i,
  /\bscope_architecture_v1\b/i,
  /\bcomponent_registry\b/i,
  /\bedge function\b/i,
  /\bRLS\b/,
  /\bSQL\b/,
  /\bDPIA\b/, // we use "cumplimiento normativo" in client copy
];

export function detectInternalJargon(markdown: string): string[] {
  const found: string[] = [];
  for (const re of BANNED_PHRASES) {
    const m = markdown.match(re);
    if (m) found.push(m[0]);
  }
  return found;
}
