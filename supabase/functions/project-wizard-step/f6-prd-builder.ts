/**
 * f6-prd-builder.ts — Step 29 deterministic Technical PRD builder.
 *
 * Reads Step 28 scope_architecture_v1 (and optionally Step 2 brief for context)
 * and builds technical_prd_v1 — a structured, traceable spec for Lovable / dev
 * team. NO LLM. Every section is derived deterministically from scope.
 *
 * Hard rules:
 *   • Only components present in Step 28 buckets are included.
 *   • No bucket changes, no new components, no promises outside scope.
 *   • Buckets render in fixed order: data_foundation → mvp → fast_follow_f2 →
 *     roadmap_f3 → rejected_out_of_scope.
 *   • Compliance / data readiness blockers are surfaced from root lists.
 *   • Soul capture plan included verbatim.
 *
 * Created: 2026-04-25
 */

import type {
  ScopeArchitectureV1,
  ScopeComponent,
  ScopeBucket,
} from "./f5-deterministic-scope.ts";

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────

export interface PrdComponentSpec {
  scope_id: string;
  source_ref: string;
  name: string;
  family?: string;
  layer?: string;
  bucket: ScopeBucket;
  status: string;
  business_job?: string;
  required_actions: string[];
  blockers: Array<{
    type: string;
    blocks_design: boolean;
    blocks_internal_testing: boolean;
    blocks_production: boolean;
    required_artifacts: string[];
    reason: string;
  }>;
  soul_dependency: "none" | "async" | "hard";
  acceptance_criteria: string[];
  notes?: string;
}

export interface PrdBucket {
  bucket: ScopeBucket;
  label: string;
  description: string;
  components: PrdComponentSpec[];
}

export interface PrdComplianceBlocker {
  scope_id: string;
  component_name: string;
  required_artifacts: string[];
  owner: string;
  deadline_weeks: number;
  blocks_design: boolean;
  blocks_internal_testing: boolean;
  blocks_production: boolean;
  reason: string;
}

export interface PrdDataReadinessBlocker {
  scope_id: string;
  component_id: string;
  component_name: string;
  dataset_required: string;
  current_readiness_pct: number;
  min_readiness_for_mvp: number;
  unblocking_actions: string[];
  reason: string;
}

export interface PrdSoulCapturePlan {
  required: boolean;
  sessions: number;
  session_duration_min: number;
  weeks_window: string;
  deliverables: string[];
  hard_dependencies: string[];
  async_dependencies: string[];
  fallback: string;
}

export interface TechnicalPrdV1 {
  schema_version: "1.0.0";
  project_name: string;
  client_name: string;
  decision_maker_name?: string;
  generated_at: string;
  source_step: { step_number: 28; version: number; row_id: string };
  executive_summary: {
    counts: Record<ScopeBucket, number>;
    soul_required: boolean;
    compliance_blockers_count: number;
    data_readiness_blockers_count: number;
    human_decisions_applied: string[];
  };
  buckets: PrdBucket[];
  compliance_blockers: PrdComplianceBlocker[];
  data_readiness_blockers: PrdDataReadinessBlocker[];
  soul_capture_plan: PrdSoulCapturePlan;
  scope_decision_log_summary: Array<{
    source: string;
    decision_id: string;
    applied_to: string;
    action: string;
    reason: string;
  }>;
  out_of_scope: PrdComponentSpec[];
}

export interface PrdMeta {
  generated_at: string;
  f6_ms: number;
  components_total: number;
  components_by_bucket: Record<ScopeBucket, number>;
  source_step: { step_number: 28; version: number; row_id: string };
}

export interface F6Output {
  technical_prd_v1: TechnicalPrdV1;
  prd_meta: PrdMeta;
}

// ───────────────────────────────────────────────────────────────────────────────
// Bucket metadata
// ───────────────────────────────────────────────────────────────────────────────

const BUCKET_LABELS: Record<ScopeBucket, { label: string; description: string }> = {
  data_foundation: {
    label: "Data Foundation",
    description:
      "Componentes base que deben existir antes que cualquier otro módulo. Sin esto, ningún componente del MVP puede operar.",
  },
  mvp: {
    label: "MVP",
    description:
      "Alcance comprometido para entrega productiva. Incluye condiciones (DPIA, dataset readiness) que deben cerrarse antes de producción, no antes de diseño/testing interno.",
  },
  fast_follow_f2: {
    label: "Fast Follow (F2)",
    description:
      "Segundo lote, planificable inmediatamente después del MVP. Incluye PoCs y módulos diferidos por decisión humana o feasibility.",
  },
  roadmap_f3: {
    label: "Roadmap (F3)",
    description:
      "Tercera fase. Componentes con valor identificado pero baja prioridad o alta complejidad para el MVP.",
  },
  rejected_out_of_scope: {
    label: "Out of Scope",
    description:
      "Componentes evaluados y rechazados. Documentados aquí para evitar reaparición silenciosa en fases futuras.",
  },
};

// ───────────────────────────────────────────────────────────────────────────────
// Deterministic acceptance criteria per bucket / verdict
// ───────────────────────────────────────────────────────────────────────────────

function acceptanceCriteriaFor(c: ScopeComponent): string[] {
  const out: string[] = [];
  if (c.bucket === "data_foundation") {
    out.push("Esquema de datos / contrato del módulo aprobado por arquitectura.");
    out.push("Backfill o seed inicial verificado por el equipo de datos.");
  }
  if (c.bucket === "mvp") {
    out.push("Comportamiento end-to-end demostrable contra el business_job declarado.");
    out.push("Cobertura de tests (unit + integration) para el flujo principal.");
  }
  if (c.bucket === "fast_follow_f2" || c.bucket === "roadmap_f3") {
    out.push("Especificación técnica documentada y estimada antes de iniciar implementación.");
  }
  for (const b of c.blockers) {
    if (b.type === "compliance") {
      out.push("DPIA firmada y artefactos de cumplimiento entregados antes de producción.");
    }
    if (b.type === "data_readiness") {
      out.push("Dataset alcanza el umbral de readiness mínimo definido antes de producción.");
    }
    if (b.type === "poc") {
      out.push("PoC ejecutado con métricas de éxito documentadas antes de comprometer alcance final.");
    }
    if (b.type === "soul_capture") {
      out.push("Sesiones Soul completadas y corpus disponible antes de activar este componente.");
    }
  }
  if (c.soul_dependency === "hard") {
    out.push("Componente queda inactivo hasta que el corpus Soul esté disponible.");
  }
  return Array.from(new Set(out));
}

function toSpec(c: ScopeComponent): PrdComponentSpec {
  return {
    scope_id: c.scope_id,
    source_ref: c.source_ref,
    name: c.name,
    family: c.family,
    layer: c.layer,
    bucket: c.bucket,
    status: c.status,
    business_job: c.business_job,
    required_actions: [...(c.required_actions ?? [])],
    blockers: (c.blockers ?? []).map((b) => ({
      type: b.type,
      blocks_design: b.blocks_design,
      blocks_internal_testing: b.blocks_internal_testing,
      blocks_production: b.blocks_production,
      required_artifacts: [...(b.required_artifacts ?? [])],
      reason: b.reason,
    })),
    soul_dependency: c.soul_dependency ?? "none",
    acceptance_criteria: acceptanceCriteriaFor(c),
    notes: c.notes,
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Public builder
// ───────────────────────────────────────────────────────────────────────────────

export interface F6Input {
  scope: ScopeArchitectureV1;
  source_step: { step_number: 28; version: number; row_id: string };
  projectName: string;
  clientName: string;
  decisionMakerName?: string;
}

export function buildTechnicalPrd(input: F6Input): F6Output {
  const t0 = Date.now();
  const { scope } = input;

  const buckets: PrdBucket[] = (
    ["data_foundation", "mvp", "fast_follow_f2", "roadmap_f3"] as ScopeBucket[]
  ).map((b) => {
    const meta = BUCKET_LABELS[b];
    const list = (scope[b] ?? []).map(toSpec);
    return {
      bucket: b,
      label: meta.label,
      description: meta.description,
      components: list,
    };
  });

  const counts: Record<ScopeBucket, number> = {
    data_foundation: scope.data_foundation.length,
    mvp: scope.mvp.length,
    fast_follow_f2: scope.fast_follow_f2.length,
    roadmap_f3: scope.roadmap_f3.length,
    rejected_out_of_scope: scope.rejected_out_of_scope.length,
  };

  const prd: TechnicalPrdV1 = {
    schema_version: "1.0.0",
    project_name: input.projectName,
    client_name: input.clientName,
    decision_maker_name: input.decisionMakerName,
    generated_at: new Date().toISOString(),
    source_step: input.source_step,
    executive_summary: {
      counts,
      soul_required: !!scope.soul_capture_plan?.required,
      compliance_blockers_count: scope.compliance_blockers?.length ?? 0,
      data_readiness_blockers_count: scope.data_readiness_blockers?.length ?? 0,
      human_decisions_applied: (scope.human_decisions_applied ?? []).map((d) => d.decision_id),
    },
    buckets,
    compliance_blockers: (scope.compliance_blockers ?? []).map((b) => ({
      scope_id: b.scope_id,
      component_name: b.component_name,
      required_artifacts: [...(b.required_artifacts ?? [])],
      owner: b.owner,
      deadline_weeks: b.deadline_weeks,
      blocks_design: b.blocks_design,
      blocks_internal_testing: b.blocks_internal_testing,
      blocks_production: b.blocks_production,
      reason: b.reason,
    })),
    data_readiness_blockers: (scope.data_readiness_blockers ?? []).map((b) => ({
      scope_id: b.scope_id,
      component_id: b.component_id,
      component_name: b.component_name,
      dataset_required: b.dataset_required,
      current_readiness_pct: b.current_readiness_pct,
      min_readiness_for_mvp: b.min_readiness_for_mvp,
      unblocking_actions: [...(b.unblocking_actions ?? [])],
      reason: b.reason,
    })),
    soul_capture_plan: {
      required: scope.soul_capture_plan.required,
      sessions: scope.soul_capture_plan.sessions,
      session_duration_min: scope.soul_capture_plan.session_duration_min,
      weeks_window: scope.soul_capture_plan.weeks_window,
      deliverables: [...scope.soul_capture_plan.deliverables],
      hard_dependencies: [...scope.soul_capture_plan.hard_dependencies],
      async_dependencies: [...scope.soul_capture_plan.async_dependencies],
      fallback: scope.soul_capture_plan.fallback,
    },
    scope_decision_log_summary: (scope.scope_decision_log ?? []).slice(0, 50).map((e) => ({
      source: e.source,
      decision_id: e.decision_id,
      applied_to: e.applied_to,
      action: e.action,
      reason: e.reason,
    })),
    out_of_scope: (scope.rejected_out_of_scope ?? []).map(toSpec),
  };

  return {
    technical_prd_v1: prd,
    prd_meta: {
      generated_at: prd.generated_at,
      f6_ms: Date.now() - t0,
      components_total:
        counts.data_foundation +
        counts.mvp +
        counts.fast_follow_f2 +
        counts.roadmap_f3 +
        counts.rejected_out_of_scope,
      components_by_bucket: counts,
      source_step: input.source_step,
    },
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Markdown renderer (for PDF export downstream)
// ───────────────────────────────────────────────────────────────────────────────

export function renderPrdMarkdown(prd: TechnicalPrdV1): string {
  const lines: string[] = [];
  lines.push(`# PRD Técnico de Construcción — ${prd.project_name}`);
  lines.push("");
  lines.push(`> **Cliente / empresa:** ${prd.client_name}`);
  if (prd.decision_maker_name) {
    lines.push(`> **Decisor:** ${prd.decision_maker_name}`);
  }
  lines.push(`> **Proyecto / Producto:** ${prd.project_name}`);
  lines.push(`> **Fuente de alcance:** \`scope_architecture_v1\` (Step ${prd.source_step.step_number} v${prd.source_step.version}, row \`${prd.source_step.row_id}\`)`);
  lines.push(`> **Generado:** ${prd.generated_at} · **Pipeline:** v2 determinista (sin LLM)`);
  lines.push("");
  lines.push("_Este documento es el PRD técnico para construcción (Lovable). La propuesta cliente es un documento separado._");
  lines.push("");
  lines.push("## Resumen ejecutivo");
  lines.push("");
  lines.push(`- Data foundation: **${prd.executive_summary.counts.data_foundation}**`);
  lines.push(`- MVP: **${prd.executive_summary.counts.mvp}**`);
  lines.push(`- Fast follow (F2): **${prd.executive_summary.counts.fast_follow_f2}**`);
  lines.push(`- Roadmap (F3): **${prd.executive_summary.counts.roadmap_f3}**`);
  lines.push(`- Out of scope: **${prd.executive_summary.counts.rejected_out_of_scope}**`);
  lines.push(`- Compliance blockers: **${prd.executive_summary.compliance_blockers_count}**`);
  lines.push(`- Data readiness blockers: **${prd.executive_summary.data_readiness_blockers_count}**`);
  lines.push(`- Soul capture requerido: **${prd.executive_summary.soul_required ? "Sí" : "No"}**`);
  if (prd.executive_summary.human_decisions_applied.length > 0) {
    lines.push(`- Decisiones humanas aplicadas: ${prd.executive_summary.human_decisions_applied.join(", ")}`);
  }
  lines.push("");

  for (const b of prd.buckets) {
    lines.push(`## ${b.label}`);
    lines.push("");
    lines.push(b.description);
    lines.push("");
    if (b.components.length === 0) {
      lines.push("_Sin componentes en este bucket._");
      lines.push("");
      continue;
    }
    for (const c of b.components) {
      lines.push(`### ${c.scope_id} — ${c.name}`);
      lines.push("");
      lines.push(`- **Source ref:** \`${c.source_ref}\``);
      if (c.family) lines.push(`- **Family:** ${c.family}`);
      if (c.layer) lines.push(`- **Layer:** ${c.layer}`);
      lines.push(`- **Status:** ${c.status}`);
      if (c.soul_dependency !== "none") {
        lines.push(`- **Soul dependency:** ${c.soul_dependency}`);
      }
      if (c.business_job) {
        lines.push(`- **Business job:** ${c.business_job}`);
      }
      if (c.required_actions.length > 0) {
        lines.push(`- **Required actions:**`);
        for (const a of c.required_actions) lines.push(`  - ${a}`);
      }
      if (c.blockers.length > 0) {
        lines.push(`- **Blockers:**`);
        for (const blk of c.blockers) {
          lines.push(
            `  - \`${blk.type}\` · design:${blk.blocks_design} · testing:${blk.blocks_internal_testing} · prod:${blk.blocks_production}`,
          );
          if (blk.required_artifacts.length > 0) {
            lines.push(`    - Artefactos: ${blk.required_artifacts.join(", ")}`);
          }
          lines.push(`    - Razón: ${blk.reason}`);
        }
      }
      if (c.acceptance_criteria.length > 0) {
        lines.push(`- **Criterios de aceptación:**`);
        for (const ac of c.acceptance_criteria) lines.push(`  - ${ac}`);
      }
      if (c.notes) {
        lines.push(`- **Notas:** ${c.notes}`);
      }
      lines.push("");
    }
  }

  lines.push("## Compliance blockers");
  lines.push("");
  if (prd.compliance_blockers.length === 0) {
    lines.push("_Sin compliance blockers activos._");
  } else {
    for (const b of prd.compliance_blockers) {
      lines.push(`### ${b.scope_id} — ${b.component_name}`);
      lines.push(`- Owner: ${b.owner} · Deadline: ${b.deadline_weeks} semanas`);
      lines.push(`- Bloquea producción: ${b.blocks_production} · diseño: ${b.blocks_design} · testing interno: ${b.blocks_internal_testing}`);
      lines.push(`- Artefactos requeridos: ${b.required_artifacts.join(", ")}`);
      lines.push(`- Razón: ${b.reason}`);
      lines.push("");
    }
  }
  lines.push("");

  lines.push("## Data readiness blockers");
  lines.push("");
  if (prd.data_readiness_blockers.length === 0) {
    lines.push("_Sin data readiness blockers activos._");
  } else {
    for (const b of prd.data_readiness_blockers) {
      lines.push(`### ${b.scope_id} — ${b.component_name} (${b.component_id})`);
      lines.push(`- Dataset requerido: ${b.dataset_required}`);
      lines.push(`- Readiness actual: ${b.current_readiness_pct}% · mínimo MVP: ${b.min_readiness_for_mvp}%`);
      lines.push(`- Acciones de desbloqueo:`);
      for (const a of b.unblocking_actions) lines.push(`  - ${a}`);
      lines.push(`- Razón: ${b.reason}`);
      lines.push("");
    }
  }
  lines.push("");

  lines.push("## Soul capture plan");
  lines.push("");
  if (prd.soul_capture_plan.required) {
    lines.push(`- Sesiones: ${prd.soul_capture_plan.sessions} × ${prd.soul_capture_plan.session_duration_min} min durante ${humanizeWeeksWindow(prd.soul_capture_plan.weeks_window)}`);
    lines.push(`- Hard dependencies: ${prd.soul_capture_plan.hard_dependencies.join(", ") || "—"}`);
    lines.push(`- Async dependencies: ${prd.soul_capture_plan.async_dependencies.join(", ") || "—"}`);
    lines.push(`- Deliverables:`);
    for (const d of prd.soul_capture_plan.deliverables) lines.push(`  - ${d}`);
    lines.push(`- Fallback: ${prd.soul_capture_plan.fallback}`);
  } else {
    lines.push("_No requerido._");
  }
  lines.push("");

  lines.push("## Out of scope");
  lines.push("");
  if (prd.out_of_scope.length === 0) {
    lines.push("_Sin componentes rechazados._");
  } else {
    for (const c of prd.out_of_scope) {
      lines.push(`- **${c.scope_id} — ${c.name}** (\`${c.source_ref}\`) · ${c.notes ?? ""}`);
    }
  }

  return lines.join("\n");
}
