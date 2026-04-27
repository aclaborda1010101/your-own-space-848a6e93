/**
 * f9-lovable-build-pack.ts — Step 32 Lovable Build Pack builder.
 *
 * Reads a Step 29 technical_prd_v1 + the EXACT Step 28 scope it references
 * and produces a short (1.5k–2.5k words), actionable build-pack markdown
 * that can be pasted directly into Lovable.dev.
 *
 * HARD CONTRACT:
 *   • Append-only: caller inserts with version = max+1.
 *   • Components are NEVER moved between buckets.
 *   • Components are NEVER invented. Components are NEVER omitted.
 *   • data_foundation + mvp → "Qué construir primero".
 *   • fast_follow_f2 + roadmap_f3 + rejected → "Qué NO construir todavía".
 *   • AI section ALWAYS contains the 5 sub-blocks (RAGs, Agents, MoE, Tools, HITL).
 *   • Internal jargon (Step 25/26/28, Component Registry, Edge Function, RLS,
 *     SQL, F4, F5, F6) is detected and stripped.
 *
 * NO LLM. Fully deterministic. Renders markdown from the scope + PRD inputs.
 *
 * Created: 2026-04-27
 */

import type {
  ScopeArchitectureV1,
  ScopeComponent,
  ScopeBucket,
} from "./f5-deterministic-scope.ts";
import type { TechnicalPrdV1 } from "./f6-prd-builder.ts";

// ───────────────────────────────────────────────────────────────────────────────
// Public types
// ───────────────────────────────────────────────────────────────────────────────

export interface ComponentRef {
  scope_id: string;
  source_ref: string;
  name: string;
  bucket: ScopeBucket;
  business_job?: string;
  notes?: string;
}

export interface RagSpec {
  name: string;
  purpose: string;
  sources: string[];
}

export interface AgentSpec {
  name: string;
  scope_ref?: string;
  responsibility: string;
  tools: string[];
  hitl: boolean;
}

export interface MoeSpec {
  routing_rules: string[];
  fallback: string;
  abstain_when: string[];
  deterministic_routes: string[];
  llm_routes: string[];
}

export interface ToolSpec {
  name: string;
  description: string;
}

export interface HitlSpec {
  triggers: string[];
  abstain_threshold: string;
  review_owner: string;
}

export interface RouteSpec {
  path: string;
  purpose: string;
}

export interface EntitySpec {
  name: string;
  fields: string[];
}

export interface FlowSpec {
  name: string;
  steps: string[];
}

export interface IntegrationItem {
  name: string;
  status: "real" | "mock";
  notes?: string;
}

export interface LovableBuildPackV1 {
  schema_version: "1.0.0";
  project_name: string;
  client_name: string;
  generated_at: string;
  source_steps: {
    prd_step: { step_number: 29; version: number; row_id: string };
    scope_step: { step_number: 28; version: number; row_id: string };
  };
  sections: {
    stack: string;
    routes: RouteSpec[];
    data_model: EntitySpec[];
    build_first: { foundation: ComponentRef[]; mvp: ComponentRef[] };
    flows: FlowSpec[];
    ai_architecture: {
      rags: RagSpec[];
      agents: AgentSpec[];
      moe_router: MoeSpec;
      tools: ToolSpec[];
      hitl: HitlSpec;
    };
    integrations: { real: IntegrationItem[]; mock: IntegrationItem[] };
    do_not_build_yet: {
      fast_follow_f2: ComponentRef[];
      roadmap_f3: ComponentRef[];
      exclusions: ComponentRef[];
    };
    acceptance_criteria_mvp: string[];
  };
}

export interface BuildPackMeta {
  generated_at: string;
  word_count: number;
  warnings: string[];
  source_prd_row_id: string;
  source_scope_row_id: string;
  llm_model: "deterministic";
}

export interface F9Input {
  prd: TechnicalPrdV1;
  scope: ScopeArchitectureV1;
  source_steps: LovableBuildPackV1["source_steps"];
  project_name: string;
  client_name: string;
}

export interface F9Output {
  lovable_build_pack_v1: LovableBuildPackV1;
  build_pack_markdown: string;
  build_pack_meta: BuildPackMeta;
}

// ───────────────────────────────────────────────────────────────────────────────
// Internal jargon detector / sanitizer
// ───────────────────────────────────────────────────────────────────────────────

const JARGON_PATTERNS: Array<{ rx: RegExp; replacement: string }> = [
  { rx: /\bStep\s*2[5-9]\b/gi, replacement: "el alcance aprobado" },
  { rx: /\bStep\s*3[0-2]\b/gi, replacement: "este documento" },
  { rx: /\bComponent\s+Registry\b/gi, replacement: "inventario de componentes" },
  { rx: /\bEdge\s+Function(s)?\b/gi, replacement: "función backend" },
  { rx: /\bRLS\b/g, replacement: "permisos por usuario" },
  { rx: /\bSQL\b/g, replacement: "base de datos" },
  { rx: /\bF[4-9]\b/g, replacement: "" },
];

export function detectBuildPackJargon(md: string): string[] {
  const found: string[] = [];
  for (const { rx } of JARGON_PATTERNS) {
    const m = md.match(rx);
    if (m && m.length > 0) found.push(...m);
  }
  return Array.from(new Set(found.map((s) => s.trim()).filter(Boolean)));
}

export function stripBuildPackJargon(md: string): string {
  let out = md;
  for (const { rx, replacement } of JARGON_PATTERNS) {
    out = out.replace(rx, replacement);
  }
  // Collapse multiple spaces left by removals
  return out.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n");
}

function countWords(md: string): number {
  return md.trim().split(/\s+/).filter(Boolean).length;
}

// ───────────────────────────────────────────────────────────────────────────────
// Heuristics — derive AI architecture from scope component names
// ───────────────────────────────────────────────────────────────────────────────

const RAG_HINTS = /(rag|conocimiento|knowledge|índice|busqu|search)/i;
const AGENT_HINTS = /(asistente|agente|catalog|analiz|detect|matching|valorador|compliance|soul|revista|generador)/i;

function toRefs(components: ScopeComponent[]): ComponentRef[] {
  return components.map((c) => ({
    scope_id: c.scope_id,
    source_ref: c.source_ref,
    name: c.name,
    bucket: c.bucket,
    business_job: c.business_job,
    notes: c.notes,
  }));
}

function buildRags(scope: ScopeArchitectureV1): RagSpec[] {
  const all = [...scope.data_foundation, ...scope.mvp];
  const rags: RagSpec[] = [];

  for (const c of all) {
    if (RAG_HINTS.test(c.name)) {
      rags.push({
        name: c.name,
        purpose: c.business_job || "Recuperación de conocimiento contextual.",
        sources: ["Datos cargados del cliente", "Conversaciones registradas"],
      });
    }
  }

  // Garantías mínimas siempre presentes para que el LLM downstream tenga el contrato.
  const ensure = (name: string, purpose: string, sources: string[]) => {
    if (!rags.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      rags.push({ name, purpose, sources });
    }
  };

  ensure(
    "RAG de propietarios y llamadas",
    "Recuperar contexto previo de un propietario y su historial de interacciones antes de una llamada.",
    ["Propietarios (entidad)", "Notas de llamadas", "Eventos de calendario"],
  );
  ensure(
    "RAG de activos y valoraciones",
    "Recuperar características de un activo y comparables para apoyar decisiones de valoración.",
    ["Activos (entidad)", "Histórico de valoraciones", "Catastro / fuentes externas mock"],
  );

  return rags;
}

function buildAgents(scope: ScopeArchitectureV1): AgentSpec[] {
  const buildable = [...scope.data_foundation, ...scope.mvp];
  const agents: AgentSpec[] = [];

  for (const c of buildable) {
    if (!AGENT_HINTS.test(c.name)) continue;
    const lower = c.name.toLowerCase();
    const tools: string[] = [];
    if (/catalog|propietario|rol/.test(lower)) tools.push("search_owner_profile", "classify_owner_role");
    if (/llamada|nota|analiz/.test(lower)) tools.push("search_call_history", "analyze_note");
    if (/asistente|pre|post/.test(lower)) tools.push("prepare_call_brief", "save_next_action");
    if (/falleci|herenc/.test(lower)) tools.push("check_dpia_status", "require_human_review");
    if (/matching|activo.*invers|invers.*activo/.test(lower)) tools.push("compute_match_candidates", "abstain_if_low_evidence");
    if (/valor|brains/.test(lower)) tools.push("search_asset_profile");
    if (/compliance|dpia/.test(lower)) tools.push("check_dpia_status", "require_human_review");
    if (/soul/.test(lower)) tools.push("save_next_action");
    if (/whatsapp|cadencia|mensaj/.test(lower)) tools.push("save_next_action", "require_human_review");

    agents.push({
      name: c.name,
      scope_ref: c.scope_id,
      responsibility: c.business_job || "Operación principal asignada por el alcance.",
      tools: Array.from(new Set(tools.length ? tools : ["search_owner_profile"])),
      hitl: /compliance|dpia|falleci|matching|valor|whatsapp|cadencia/.test(lower),
    });
  }

  // Agente Compliance / HITL explícito — SIEMPRE presente, aunque ningún componente
  // del scope dispare el hint de compliance directamente. Es estructural para AFFLUX.
  if (!agents.some((a) => /compliance|hitl/i.test(a.name))) {
    agents.push({
      name: "Agente Compliance / HITL",
      responsibility:
        "Revisar si una acción está bloqueada por DPIA, datos personales, falta de consentimiento o baja confianza, y enrutar a revisión humana cuando proceda.",
      tools: ["check_dpia_status", "require_human_review", "abstain_if_low_evidence"],
      hitl: true,
    });
  }

  return agents;
}

function buildMoe(scope: ScopeArchitectureV1): MoeSpec {
  const hasCompliance = (scope.compliance_blockers ?? []).length > 0;
  const hasDataReadiness = (scope.data_readiness_blockers ?? []).length > 0;

  const abstain: string[] = [];
  if (hasDataReadiness) abstain.push("Datos insuficientes o por debajo del umbral de preparación del dataset.");
  if (hasCompliance) abstain.push("Acción que dispara tratamiento de datos personales sin DPIA confirmada.");
  abstain.push("Confianza del modelo por debajo del umbral configurado.");

  return {
    routing_rules: [
      "Tareas con plantilla fija o reglas claras → ruta determinista (sin LLM).",
      "Catalogación / clasificación con baja ambigüedad → modelo rápido.",
      "Análisis de notas largas o razonamiento multi-paso → modelo de razonamiento.",
      "Generación de texto cara al cliente → revisión humana antes de envío.",
    ],
    fallback: "Si el modelo principal falla o agota cuota, reintentar una vez en modelo secundario; si vuelve a fallar, registrar el caso para revisión humana.",
    abstain_when: abstain,
    deterministic_routes: [
      "Búsquedas por id en entidades del modelo de datos.",
      "Clasificación de roles por reglas explícitas conocidas.",
      "Cálculo de coincidencias por filtros estructurados.",
    ],
    llm_routes: [
      "Resumen y briefing pre-llamada.",
      "Análisis libre de notas.",
      "Generación de propuestas de siguiente acción.",
    ],
  };
}

function buildTools(): ToolSpec[] {
  return [
    { name: "search_owner_profile", description: "Recuperar el perfil de un propietario por id o por nombre normalizado." },
    { name: "search_call_history", description: "Listar interacciones previas con un propietario (cronológico)." },
    { name: "classify_owner_role", description: "Asignar rol/segmento a un propietario según reglas + señales." },
    { name: "analyze_note", description: "Extraer hechos, intenciones y próximas acciones de una nota libre." },
    { name: "prepare_call_brief", description: "Generar briefing pre-llamada con contexto, objetivos y riesgos." },
    { name: "save_next_action", description: "Persistir la próxima acción acordada y vincularla al propietario/activo." },
    { name: "check_dpia_status", description: "Verificar si la operación requiere DPIA antes de proceder." },
    { name: "require_human_review", description: "Marcar el caso para revisión humana y bloquear su ejecución automática." },
    { name: "compute_match_candidates", description: "Devolver candidatos activo↔inversor con score y justificación." },
    { name: "abstain_if_low_evidence", description: "Devolver una abstención explícita cuando la evidencia no supere el umbral." },
    { name: "search_asset_profile", description: "Recuperar la ficha de un activo y sus comparables." },
    { name: "search_investor_profile", description: "Recuperar la ficha de un inversor y sus criterios declarados." },
  ];
}

function buildHitl(scope: ScopeArchitectureV1): HitlSpec {
  const triggers = [
    "Cualquier comunicación que vaya a salir hacia un tercero (mensaje, email, llamada agendada).",
    "Decisiones que afecten a datos personales sensibles o compliance.",
    "Acciones de matching con score por debajo del umbral o evidencia escasa.",
  ];
  if ((scope.compliance_blockers ?? []).length > 0) {
    triggers.push("Cualquier acción afectada por bloqueadores de cumplimiento listados en el alcance.");
  }
  return {
    triggers,
    abstain_threshold: "Umbral configurable por agente (por defecto: confianza < 0,7 o evidencia insuficiente).",
    review_owner: "Operador funcional asignado al proyecto (configurable por entorno).",
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Routes / data model / flows / integrations — derive from scope semantics
// ───────────────────────────────────────────────────────────────────────────────

function buildRoutes(scope: ScopeArchitectureV1): RouteSpec[] {
  const routes: RouteSpec[] = [
    { path: "/", purpose: "Dashboard del operador (KPIs y trabajo pendiente)." },
    { path: "/propietarios", purpose: "Listado y ficha de propietarios." },
    { path: "/propietarios/:id", purpose: "Ficha del propietario (datos, notas, próximas acciones)." },
    { path: "/llamadas", purpose: "Bandeja de llamadas registradas y briefings." },
    { path: "/activos", purpose: "Listado de activos con filtros." },
    { path: "/activos/:id", purpose: "Ficha de activo (datos, valoración, candidatos)." },
  ];
  if (scope.mvp.some((c) => /matching/i.test(c.name))) {
    routes.push({ path: "/matching", purpose: "Cola de matching activo↔inversor con justificación." });
  }
  if (scope.mvp.some((c) => /compliance|dpia/i.test(c.name))) {
    routes.push({ path: "/compliance", purpose: "Estado de cumplimiento y casos en revisión humana." });
  }
  routes.push({ path: "/ajustes", purpose: "Configuración de la organización y umbrales." });
  return routes;
}

function buildDataModel(scope: ScopeArchitectureV1): EntitySpec[] {
  const entities: EntitySpec[] = [
    { name: "owners (propietarios)", fields: ["id", "nombre", "rol", "contacto", "consentimiento", "creado_en"] },
    { name: "buildings (edificios)", fields: ["id", "direccion", "ciudad", "division_horizontal", "numero_propietarios", "estado", "catastro_ref"] },
    { name: "calls (llamadas)", fields: ["id", "owner_id", "fecha", "resumen", "transcripcion_url", "siguiente_accion"] },
    { name: "notes (notas)", fields: ["id", "owner_id", "texto", "etiquetas", "creado_en"] },
    { name: "assets (activos / oportunidades)", fields: ["id", "building_id", "tipo", "ubicacion", "valoracion_estimada", "estado", "owner_id"] },
  ];
  if (scope.mvp.some((c) => /matching|invers/i.test(c.name))) {
    entities.push({ name: "investors (inversores)", fields: ["id", "nombre", "criterios", "ticket_min", "ticket_max"] });
    entities.push({ name: "match_candidates", fields: ["id", "asset_id", "investor_id", "score", "evidencia", "estado"] });
  }
  // compliance_cases siempre presente: el agente Compliance/HITL es estructural
  entities.push({ name: "compliance_cases", fields: ["id", "scope_id", "estado", "dpia_ok", "motivo", "owner_revisor", "creado_en"] });
  return entities;
}

function buildFlows(scope: ScopeArchitectureV1): FlowSpec[] {
  const flows: FlowSpec[] = [
    {
      name: "Pre-llamada de propietario",
      steps: [
        "El operador abre la ficha del propietario.",
        "Se ejecuta el agente asistente pre-llamada y devuelve briefing.",
        "El operador valida y marca objetivos para la llamada.",
      ],
    },
    {
      name: "Post-llamada → próxima acción",
      steps: [
        "El operador adjunta nota o transcripción.",
        "Se ejecuta el análisis de notas y se propone una próxima acción.",
        "El operador confirma; la acción queda persistida con vencimiento.",
      ],
    },
  ];
  if (scope.mvp.some((c) => /matching|invers/i.test(c.name))) {
    flows.push({
      name: "Matching activo↔inversor",
      steps: [
        "Al guardar/actualizar un activo, se calculan candidatos.",
        "Se filtra por umbral de score y por consentimiento del inversor.",
        "El operador revisa la cola y aprueba el contacto manualmente.",
      ],
    });
  }
  if (scope.mvp.some((c) => /falleci|herenc/i.test(c.name))) {
    flows.push({
      name: "Detección de fallecimientos / herencias",
      steps: [
        "Ingreso controlado de señales (mock o fuente aprobada).",
        "El agente detector marca casos potenciales.",
        "Revisión humana obligatoria antes de cualquier acción comercial.",
      ],
    });
  }
  return flows;
}

function buildIntegrations(scope: ScopeArchitectureV1): { real: IntegrationItem[]; mock: IntegrationItem[] } {
  const real: IntegrationItem[] = [
    { name: "Lovable Cloud (datos + auth + storage)", status: "real" },
    { name: "Lovable AI Gateway (modelos LLM)", status: "real" },
    { name: "Carga manual o importación controlada de datos del cliente", status: "real" },
  ];
  if (scope.mvp.some((c) => /rag|conocimiento|knowledge/i.test(c.name))) {
    real.push({ name: "Embeddings + búsqueda semántica para los RAGs aprobados", status: "real" });
  }

  const mock: IntegrationItem[] = [];
  if (scope.mvp.some((c) => /falleci|herenc/i.test(c.name))) {
    mock.push({ name: "Fuentes externas de fallecimientos / esquelas / boletines oficiales", status: "mock", notes: "Sin acceso real hasta DPIA." });
  }
  if (scope.mvp.some((c) => /brains|valor/i.test(c.name))) {
    mock.push({ name: "BrainsRE (valoraciones)", status: "mock", notes: "Mock controlado hasta firmar acceso." });
  }
  if (scope.mvp.some((c) => /matching|predict/i.test(c.name))) {
    mock.push({ name: "Scoring predictivo final", status: "mock", notes: "Sin dataset suficiente para modelo aprendido." });
  }
  mock.push({ name: "WhatsApp / canales de mensajería automatizados", status: "mock", notes: "Sin envío automático sin consentimiento explícito." });
  return { real, mock };
}

function buildAcceptance(scope: ScopeArchitectureV1): string[] {
  const acc: string[] = [
    "El operador puede crear, ver y editar propietarios, activos y notas sin errores.",
    "Cada propietario tiene un briefing pre-llamada generado bajo demanda.",
    "Cada nota produce una próxima acción propuesta y persistida tras confirmación.",
  ];
  if (scope.mvp.some((c) => /matching/i.test(c.name))) {
    acc.push("El módulo de matching devuelve candidatos con score y justificación, y exige aprobación humana antes de contactar.");
  }
  if (scope.compliance_blockers?.length) {
    acc.push("Cualquier acción afectada por compliance queda bloqueada hasta confirmar DPIA.");
  }
  acc.push("Ningún componente de fases posteriores aparece operativo en el MVP.");
  return acc;
}

// ───────────────────────────────────────────────────────────────────────────────
// Build the structured pack (deterministic)
// ───────────────────────────────────────────────────────────────────────────────

export function buildLovableBuildPack(input: F9Input): F9Output {
  const { scope, prd, source_steps, project_name, client_name } = input;

  const foundation = toRefs(scope.data_foundation ?? []);
  const mvp = toRefs(scope.mvp ?? []);
  const fastFollow = toRefs(scope.fast_follow_f2 ?? []);
  const roadmap = toRefs(scope.roadmap_f3 ?? []);
  const exclusions = toRefs(scope.rejected_out_of_scope ?? []);

  const pack: LovableBuildPackV1 = {
    schema_version: "1.0.0",
    project_name,
    client_name,
    generated_at: new Date().toISOString(),
    source_steps,
    sections: {
      stack: "React + Vite + TypeScript en el frontend, Lovable Cloud (Supabase gestionado) para datos, autenticación y storage, y Lovable AI Gateway para los modelos. Tailwind con tokens semánticos para todo el diseño visual.",
      routes: buildRoutes(scope),
      data_model: buildDataModel(scope),
      build_first: { foundation, mvp },
      flows: buildFlows(scope),
      ai_architecture: {
        rags: buildRags(scope),
        agents: buildAgents(scope),
        moe_router: buildMoe(scope),
        tools: buildTools(),
        hitl: buildHitl(scope),
      },
      integrations: buildIntegrations(scope),
      do_not_build_yet: {
        fast_follow_f2: fastFollow,
        roadmap_f3: roadmap,
        exclusions,
      },
      acceptance_criteria_mvp: buildAcceptance(scope),
    },
  };

  // Validate bucket integrity (component IDs cannot move).
  validateBucketIntegrity(pack, scope);

  // Render markdown.
  const rawMd = renderBuildPackMarkdown(pack);
  const detected = detectBuildPackJargon(rawMd);
  const cleanMd = stripBuildPackJargon(rawMd);
  const wc = countWords(cleanMd);

  const warnings: string[] = [];
  if (detected.length > 0) warnings.push(`internal_jargon_stripped:${detected.join("|")}`);
  if (wc > 2500) warnings.push(`exceeds_2500_words:${wc}`);
  if (wc < 800) warnings.push(`below_minimum_length:${wc}`);

  return {
    lovable_build_pack_v1: pack,
    build_pack_markdown: cleanMd,
    build_pack_meta: {
      generated_at: new Date().toISOString(),
      word_count: wc,
      warnings,
      source_prd_row_id: source_steps.prd_step.row_id,
      source_scope_row_id: source_steps.scope_step.row_id,
      llm_model: "deterministic",
    },
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Bucket-integrity validator (defensive: ensure scope_id → bucket is preserved)
// ───────────────────────────────────────────────────────────────────────────────

export function validateBucketIntegrity(
  pack: LovableBuildPackV1,
  scope: ScopeArchitectureV1,
): void {
  const expected = new Map<string, ScopeBucket>();
  const buckets: ScopeBucket[] = [
    "data_foundation",
    "mvp",
    "fast_follow_f2",
    "roadmap_f3",
    "rejected_out_of_scope",
  ];
  for (const b of buckets) {
    for (const c of (scope as any)[b] ?? []) expected.set(c.scope_id, b);
  }

  const actual = new Map<string, ScopeBucket>();
  for (const c of pack.sections.build_first.foundation) actual.set(c.scope_id, "data_foundation");
  for (const c of pack.sections.build_first.mvp) actual.set(c.scope_id, "mvp");
  for (const c of pack.sections.do_not_build_yet.fast_follow_f2) actual.set(c.scope_id, "fast_follow_f2");
  for (const c of pack.sections.do_not_build_yet.roadmap_f3) actual.set(c.scope_id, "roadmap_f3");
  for (const c of pack.sections.do_not_build_yet.exclusions) actual.set(c.scope_id, "rejected_out_of_scope");

  const errors: string[] = [];
  for (const [id, bucket] of expected) {
    const got = actual.get(id);
    if (!got) errors.push(`missing:${id}@${bucket}`);
    else if (got !== bucket) errors.push(`moved:${id}:${bucket}->${got}`);
  }
  for (const [id] of actual) {
    if (!expected.has(id)) errors.push(`invented:${id}`);
  }
  if (errors.length > 0) {
    throw new Error(`BUILD_PACK_BUCKET_INTEGRITY_VIOLATION: ${errors.join(", ")}`);
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// Markdown renderer — fixed 9 sections, fixed order
// ───────────────────────────────────────────────────────────────────────────────

function renderComponentList(list: ComponentRef[]): string {
  if (!list.length) return "_(ninguno)_\n";
  return (
    list
      .map((c) => `- **${c.name}**${c.business_job ? ` — ${c.business_job}` : ""}`)
      .join("\n") + "\n"
  );
}

export function renderBuildPackMarkdown(pack: LovableBuildPackV1): string {
  const s = pack.sections;
  const lines: string[] = [];

  lines.push(`# Lovable Build Pack — ${pack.project_name}`);
  lines.push("");
  lines.push(
    `> Documento operativo generado a partir del PRD técnico aprobado (v${pack.source_steps.prd_step.version}) y su alcance de referencia (v${pack.source_steps.scope_step.version}). Pegar este documento como prompt en Lovable.dev para arrancar la construcción.`,
  );
  lines.push("");

  // 1
  lines.push("## 1. Stack técnico");
  lines.push("");
  lines.push(s.stack);
  lines.push("");

  // 2
  lines.push("## 2. Pantallas / Rutas");
  lines.push("");
  for (const r of s.routes) lines.push(`- \`${r.path}\` — ${r.purpose}`);
  lines.push("");

  // 3
  lines.push("## 3. Modelo de datos mínimo");
  lines.push("");
  for (const e of s.data_model) {
    lines.push(`- **${e.name}**: ${e.fields.join(", ")}`);
  }
  lines.push("");

  // 4
  lines.push("## 4. Qué construir primero");
  lines.push("");
  lines.push("### Base fundacional");
  lines.push("");
  lines.push(renderComponentList(s.build_first.foundation));
  lines.push("### MVP");
  lines.push("");
  lines.push(renderComponentList(s.build_first.mvp));

  // 5
  lines.push("## 5. Flujos principales");
  lines.push("");
  for (const f of s.flows) {
    lines.push(`### ${f.name}`);
    f.steps.forEach((st, i) => lines.push(`${i + 1}. ${st}`));
    lines.push("");
  }

  // 6
  lines.push("## 6. Arquitectura IA");
  lines.push("");
  lines.push("### 6.1 RAGs funcionales a crear");
  lines.push("");
  for (const r of s.ai_architecture.rags) {
    lines.push(`- **${r.name}** — ${r.purpose}`);
    lines.push(`  - Fuentes: ${r.sources.join(", ")}`);
  }
  lines.push("");
  lines.push("### 6.2 Agentes IA a crear");
  lines.push("");
  for (const a of s.ai_architecture.agents) {
    lines.push(`- **${a.name}** — ${a.responsibility}`);
    lines.push(`  - Herramientas: ${a.tools.join(", ")}`);
    lines.push(`  - Revisión humana: ${a.hitl ? "obligatoria" : "opcional"}`);
  }
  lines.push("");
  lines.push("### 6.3 MoE / Router de expertos");
  lines.push("");
  for (const r of s.ai_architecture.moe_router.routing_rules) lines.push(`- ${r}`);
  lines.push(`- **Fallback:** ${s.ai_architecture.moe_router.fallback}`);
  lines.push(`- **Rutas deterministas:** ${s.ai_architecture.moe_router.deterministic_routes.join("; ")}`);
  lines.push(`- **Rutas con LLM:** ${s.ai_architecture.moe_router.llm_routes.join("; ")}`);
  lines.push("");
  lines.push("### 6.4 Tools / acciones por agente");
  lines.push("");
  for (const t of s.ai_architecture.tools) lines.push(`- \`${t.name}\` — ${t.description}`);
  lines.push("");
  lines.push("### 6.5 Human-in-the-loop y abstención");
  lines.push("");
  lines.push("Disparadores de revisión humana:");
  for (const t of s.ai_architecture.hitl.triggers) lines.push(`- ${t}`);
  lines.push(`- **Umbral de abstención:** ${s.ai_architecture.hitl.abstain_threshold}`);
  lines.push(`- **Responsable de revisión:** ${s.ai_architecture.hitl.review_owner}`);
  lines.push("Cuándo abstenerse:");
  for (const a of s.ai_architecture.moe_router.abstain_when) lines.push(`- ${a}`);
  lines.push("");

  // 7
  lines.push("## 7. Integraciones mock vs reales");
  lines.push("");
  lines.push("### Reales / funcionales en MVP");
  lines.push("");
  for (const i of s.integrations.real) lines.push(`- **${i.name}**${i.notes ? ` — ${i.notes}` : ""}`);
  lines.push("");
  lines.push("### Mock o controladas");
  lines.push("");
  for (const i of s.integrations.mock) lines.push(`- **${i.name}**${i.notes ? ` — ${i.notes}` : ""}`);
  lines.push("");

  // 8
  lines.push("## 8. Qué NO construir todavía");
  lines.push("");
  lines.push("### Fase posterior (fast-follow)");
  lines.push("");
  lines.push(renderComponentList(s.do_not_build_yet.fast_follow_f2));
  lines.push("### Roadmap");
  lines.push("");
  lines.push(renderComponentList(s.do_not_build_yet.roadmap_f3));
  lines.push("### Exclusiones explícitas");
  lines.push("");
  lines.push(renderComponentList(s.do_not_build_yet.exclusions));

  // 9
  lines.push("## 9. Criterios de aceptación del MVP");
  lines.push("");
  for (const a of s.acceptance_criteria_mvp) lines.push(`- ${a}`);
  lines.push("");

  return lines.join("\n");
}
