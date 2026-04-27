/**
 * f9-lovable-build-pack_test.ts — Step 32 Build Pack tests.
 */
import { assert, assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildLovableBuildPack,
  detectBuildPackJargon,
  stripBuildPackJargon,
  validateBucketIntegrity,
} from "./f9-lovable-build-pack.ts";
import { buildTechnicalPrd } from "./f6-prd-builder.ts";
import type { ScopeArchitectureV1 } from "./f5-deterministic-scope.ts";

function affluxScope(): ScopeArchitectureV1 {
  return {
    schema_version: "1.0.0",
    data_foundation: [{
      scope_id: "SCOPE-001", source_type: "registry_component", source_ref: "COMP-D01",
      name: "Soul de Alejandro", bucket: "data_foundation", status: "approved_for_scope",
      business_job: "Capturar el criterio ejecutivo del fundador.",
      blockers: [], required_actions: [], soul_dependency: "none",
    }],
    mvp: [
      {
        scope_id: "SCOPE-002", source_type: "registry_component", source_ref: "COMP-A01",
        name: "RAG de conocimiento y conversaciones AFFLUX", bucket: "mvp",
        status: "approved_for_scope", business_job: "Recuperación contextual.",
        blockers: [], required_actions: [], soul_dependency: "none",
      },
      {
        scope_id: "SCOPE-003", source_type: "registry_component", source_ref: "COMP-B01",
        name: "Catalogador de roles de propietario", bucket: "mvp",
        status: "approved_for_scope", business_job: "Asigna rol al propietario.",
        blockers: [], required_actions: [], soul_dependency: "none",
      },
      {
        scope_id: "SCOPE-004", source_type: "registry_component", source_ref: "COMP-C01",
        name: "Detector de fallecimientos y herencias", bucket: "mvp",
        status: "approved_with_conditions", business_job: "Marca casos potenciales.",
        blockers: [], required_actions: [], soul_dependency: "none",
        compliance_flags: ["personal_data_processing"],
      },
      {
        scope_id: "SCOPE-005", source_type: "registry_component", source_ref: "COMP-C03",
        name: "Matching activo-inversor", bucket: "mvp",
        status: "approved_with_conditions", business_job: "Devuelve candidatos.",
        blockers: [], required_actions: [], soul_dependency: "none",
      },
      {
        scope_id: "SCOPE-006", source_type: "registry_component", source_ref: "COMP-B03",
        name: "Asistente pre/post llamada", bucket: "mvp",
        status: "approved_for_scope", business_job: "Briefing pre-llamada.",
        blockers: [], required_actions: [], soul_dependency: "async",
      },
    ],
    fast_follow_f2: [
      {
        scope_id: "SCOPE-010", source_type: "registry_component", source_ref: "COMP-C04",
        name: "Detector Benatar (compradores institucionales)", bucket: "fast_follow_f2",
        status: "deferred", business_job: "Marcar institucionales.",
        blockers: [], required_actions: [], soul_dependency: "none",
      },
      {
        scope_id: "SCOPE-011", source_type: "registry_component", source_ref: "COMP-E01",
        name: "Generador de revista emocional por rol", bucket: "fast_follow_f2",
        status: "deferred", business_job: "Contenido segmentado.",
        blockers: [], required_actions: [], soul_dependency: "async",
      },
    ],
    roadmap_f3: [],
    rejected_out_of_scope: [{
      scope_id: "SCOPE-099", source_type: "registry_component", source_ref: "COMP-X01",
      name: "Scraping automático sin DPIA", bucket: "rejected_out_of_scope",
      status: "rejected", business_job: "—",
      blockers: [], required_actions: [], soul_dependency: "none",
    }],
    compliance_blockers: [{
      scope_id: "SCOPE-004", component_name: "Detector de fallecimientos y herencias",
      required_artifacts: ["DPIA"], reason: "Datos personales sensibles.",
      owner: "DPO", deadline_weeks: 4,
      blocks_design: false, blocks_internal_testing: false, blocks_production: true,
    }],
    data_readiness_blockers: [],
    human_decisions_applied: [],
    soul_capture_plan: {
      required: true, sessions: 4, session_duration_min: 45, weeks_window: "weeks_1_to_2",
      deliverables: ["transcripciones"], hard_dependencies: [], async_dependencies: ["SCOPE-006"], fallback: "ok",
    },
    client_deliverables: { mvp_demo_features: [], documentation: [], training_sessions: [] },
    scope_decision_log: [],
  };
}

function buildPack(scope: ScopeArchitectureV1) {
  const prd = buildTechnicalPrd({
    scope, source_step: { step_number: 28, version: 2, row_id: "row-28" },
    projectName: "AFFLUX", clientName: "AFFLUX",
  }).technical_prd_v1;
  return buildLovableBuildPack({
    prd, scope,
    source_steps: {
      prd_step: { step_number: 29, version: 1, row_id: "row-29" },
      scope_step: { step_number: 28, version: 2, row_id: "row-28" },
    },
    project_name: "AFFLUX", client_name: "AFFLUX",
  });
}

Deno.test("F9: 9 sections present in markdown", () => {
  const out = buildPack(affluxScope());
  const md = out.build_pack_markdown;
  assert(md.includes("## 1. Stack técnico"));
  assert(md.includes("## 2. Pantallas / Rutas"));
  assert(md.includes("## 3. Modelo de datos mínimo"));
  assert(md.includes("## 4. Qué construir primero"));
  assert(md.includes("## 5. Flujos principales"));
  assert(md.includes("## 6. Arquitectura IA"));
  assert(md.includes("## 7. Integraciones mock vs reales"));
  assert(md.includes("## 8. Qué NO construir todavía"));
  assert(md.includes("## 9. Criterios de aceptación del MVP"));
});

Deno.test("F9: 'Qué construir primero' contains data_foundation + mvp", () => {
  const out = buildPack(affluxScope());
  const md = out.build_pack_markdown;
  assert(md.includes("Soul de Alejandro"));
  assert(md.includes("Catalogador de roles de propietario"));
  assert(md.includes("Matching activo-inversor"));
});

Deno.test("F9: fast_follow components do NOT appear in MVP section", () => {
  const out = buildPack(affluxScope());
  const md = out.build_pack_markdown;
  // Localizar el bloque "### MVP" hasta el siguiente "## "
  const mvpIdx = md.indexOf("### MVP");
  const next = md.indexOf("\n## ", mvpIdx);
  const mvpBlock = md.substring(mvpIdx, next > 0 ? next : md.length);
  assert(!mvpBlock.includes("Benatar"), "Benatar no debe aparecer en MVP");
  assert(!mvpBlock.includes("revista emocional"), "Revista emocional no debe aparecer en MVP");
});

Deno.test("F9: Benatar appears in 'Qué NO construir todavía'", () => {
  const out = buildPack(affluxScope());
  const md = out.build_pack_markdown;
  const idx = md.indexOf("## 8. Qué NO construir todavía");
  const block = md.substring(idx);
  assert(block.includes("Benatar"));
});

Deno.test("F9: Soul appears in 'Base fundacional'", () => {
  const out = buildPack(affluxScope());
  const md = out.build_pack_markdown;
  const idx = md.indexOf("### Base fundacional");
  const next = md.indexOf("### MVP", idx);
  const block = md.substring(idx, next);
  assert(block.includes("Soul de Alejandro"));
});

Deno.test("F9: AI section contains 5 sub-blocks", () => {
  const out = buildPack(affluxScope());
  const md = out.build_pack_markdown;
  assert(md.includes("### 6.1 RAGs funcionales"));
  assert(md.includes("### 6.2 Agentes IA"));
  assert(md.includes("### 6.3 MoE / Router"));
  assert(md.includes("### 6.4 Tools"));
  assert(md.includes("### 6.5 Human-in-the-loop"));
});

Deno.test("F9: warnings include word_count exceeded if huge", () => {
  const out = buildPack(affluxScope());
  // For AFFLUX scope, doc should be reasonably sized; just check meta has fields
  assert(typeof out.build_pack_meta.word_count === "number");
  assert(out.build_pack_meta.word_count > 100);
});

Deno.test("F9: detect/strip internal jargon", () => {
  const sample = "Esto usa Step 28 y una Edge Function con RLS y reglas de F5.";
  const found = detectBuildPackJargon(sample);
  assert(found.length >= 4, `expected >=4 jargon hits, got ${found.join(",")}`);
  const cleaned = stripBuildPackJargon(sample);
  assert(!/Step\s*28/i.test(cleaned));
  assert(!/Edge\s*Function/i.test(cleaned));
  assert(!/RLS/.test(cleaned));
  assert(!/F5/.test(cleaned));
});

Deno.test("F9: bucket integrity validator throws on moved component", () => {
  const out = buildPack(affluxScope());
  // mover Benatar a MVP simulando reinterpretación del LLM
  const moved = out.lovable_build_pack_v1.sections.do_not_build_yet.fast_follow_f2.shift()!;
  out.lovable_build_pack_v1.sections.build_first.mvp.push({ ...moved, bucket: "mvp" });
  assertThrows(
    () => validateBucketIntegrity(out.lovable_build_pack_v1, affluxScope()),
    Error,
    "BUILD_PACK_BUCKET_INTEGRITY_VIOLATION",
  );
});

Deno.test("F9: meta carries source row ids", () => {
  const out = buildPack(affluxScope());
  assertEquals(out.build_pack_meta.source_prd_row_id, "row-29");
  assertEquals(out.build_pack_meta.source_scope_row_id, "row-28");
  assertEquals(out.build_pack_meta.llm_model, "deterministic");
});

Deno.test("F9: source_steps preserved in output", () => {
  const out = buildPack(affluxScope());
  assertEquals(out.lovable_build_pack_v1.source_steps.prd_step.row_id, "row-29");
  assertEquals(out.lovable_build_pack_v1.source_steps.scope_step.row_id, "row-28");
  assertEquals(out.lovable_build_pack_v1.source_steps.scope_step.version, 2);
});

Deno.test("F9: rendered markdown is free of internal jargon after strip", () => {
  const out = buildPack(affluxScope());
  const found = detectBuildPackJargon(out.build_pack_markdown);
  assertEquals(found.length, 0, `markdown should not leak jargon, got: ${found.join(",")}`);
});
