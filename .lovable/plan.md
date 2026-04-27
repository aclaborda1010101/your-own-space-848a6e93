# Plan — Step 32 "Lovable Build Pack" (con ajustes obligatorios)

## Objetivo

Generar un documento corto y accionable (~1.500–2.500 palabras) que se pueda **pegar directamente en Lovable.dev** para construir AFFLUX por fases. El PRD técnico (Step 29) sigue siendo la referencia técnica completa; el Build Pack es su versión operativa.

**Confirmado por inspección del código:**
- Step 31 = `audit_final_deliverables` (ocupado por F8). **No se toca.**
- Step 32 = libre. Se usará para el Build Pack.

---

## 1. Nuevo módulo `f9-lovable-build-pack.ts`

Archivo: `supabase/functions/project-wizard-step/f9-lovable-build-pack.ts`

### Tipos

```ts
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
  warnings: string[]; // ej: "exceeds 2500 words", "internal jargon detected"
  source_prd_row_id: string;
  source_scope_row_id: string;
  llm_model: string;
}
```

### Función principal

```ts
export async function buildLovableBuildPack(input: F9Input, opts: F9Options): Promise<F9Output>
```

- **Determinista primero**: extrae componentes de `scope_architecture_v1` por bucket (data_foundation → foundation, mvp → MVP, fast_follow_f2 + roadmap_f3 + rejected → do_not_build_yet) y construye un esqueleto JSON que **mapea 1:1 al scope**.
- **LLM enriquece, no muta**: Gemini Pro recibe el esqueleto + el PRD markdown y solo redacta texto humano, ordena flujos y completa la sección IA. Se valida después que **ningún componente cambió de bucket**.
- **Renderizador markdown** `renderBuildPackMarkdown(pack)` produce las 9 secciones en orden fijo.

### Validaciones post-LLM (críticas)

1. Cada `scope_id` aparece en exactamente el mismo bucket que en Step 28.
2. Soul (data_foundation) presente en `build_first.foundation`.
3. Componentes MVP del scope presentes en `build_first.mvp`.
4. Componentes F2/F3 presentes en `do_not_build_yet`, **nunca en MVP**.
5. Sección IA contiene los 5 sub-bloques (RAGs / Agentes / MoE / Tools / HITL).
6. `word_count <= 2500` o se añade warning.
7. **Jerga interna prohibida**: `Step 25`, `Step 26`, `Step 28`, `Component Registry`, `Edge Function`, `RLS`, `SQL`, `F4`, `F5`, `F6`. Detector con regex; cualquier match → warning + sustitución silenciosa.

---

## 2. Ajuste 2 — Selección de fuente (PRD source guard)

En `index.ts`, nueva acción `generate_lovable_build_pack`:

1. Aceptar opcionalmente `prd_step_row_id`. Si se pasa, usar ese exactamente.
2. Si no:
   - Buscar Step 29 con `status='approved'` más reciente.
   - Si no hay aprobado, último Step 29 por `version DESC, created_at DESC`.
3. Validar que el Step 29 elegido contiene `technical_prd_v1`. Si no → **error 422 `STALE_OR_INVALID_PRD`**.
4. Leer `source_step` del Step 29 para localizar el **Step 28 exacto** (no buscar otro). Cargar ese row por `row_id`.
5. Si Step 28 referenciado no existe → error `STALE_OR_INVALID_PRD` con detalle.

---

## 3. Ajuste 3 — Anti-reinterpretación del scope

Esquema de prompt LLM con **contrato explícito**:

```
REGLAS INVIOLABLES:
- NO mover componentes entre buckets.
- NO inventar componentes nuevos.
- NO omitir componentes del scope.
- data_foundation → "Base fundacional"
- mvp → "MVP"
- fast_follow_f2 → "NO construir todavía / Fase 2"
- roadmap_f3 → "NO construir todavía / Roadmap"
- rejected_out_of_scope → "Exclusiones"
```

Tras la respuesta del LLM, validador determinista compara `scope_id → bucket` antes/después. Si hay desviación → **rechazo y regeneración** con el JSON corregido (1 retry). Si vuelve a fallar, se descarta el output del LLM y se usa el esqueleto determinista solo.

---

## 4. Ajuste 4 — Sección IA explícita (6.1–6.5)

El esqueleto determinista pre-puebla la sección IA inferiendo de los componentes del scope:

- **6.1 RAGs funcionales**: detecta del scope componentes con `rag_*` o tipo "knowledge". Para AFFLUX se garantiza presencia de:
  - RAG conocimiento/conversaciones AFFLUX
  - RAG propietarios y llamadas
  - RAG activos y valoraciones
  - RAG inversores/compradores (si fase posterior)
  - RAG compliance/DPIA
- **6.2 Agentes**: uno por componente accionable del scope (catalogador, analizador llamadas, asistente pre/post llamada, detector fallecimientos, matching, BrainsRE valorador, compliance/HITL, Soul, revista emocional F2, Benatar F2).
- **6.3 MoE / Router**: bloque fijo con routing por tipo de tarea, fallback, cuándo HITL, cuándo abstenerse, qué es determinista vs LLM.
- **6.4 Tools por agente**: contrato de tools (no implementación) — `search_owner_profile`, `classify_owner_role`, `analyze_note`, `prepare_call_brief`, `save_next_action`, `check_dpia_status`, `require_human_review`, `compute_match_candidates`, `abstain_if_low_evidence`, `search_asset_profile`, `search_investor_profile`, `search_call_history`.
- **6.5 HITL y abstención**: cuándo el agente debe pedir revisión, cuándo abstenerse, umbral de evidencia.

---

## 5. Persistencia (append-only, mismo patrón que Step 28)

En `index.ts`, acción `generate_lovable_build_pack`:

1. `SELECT max(version)` para `step_number = 32, project_id = X`.
2. `INSERT` con `version = max + 1` (nunca update).
3. `output_data` contiene: `lovable_build_pack_v1`, `build_pack_markdown`, `build_pack_meta`.
4. `status = 'review'` por defecto.
5. Guardar `source_prd_row_id`, `source_scope_row_id`, `generated_from_source_hash` en meta.
6. **No se ejecuta en auto-chain**. Solo bajo petición explícita del usuario.

---

## 6. UI

### a) En el panel del Step 3 (PRD técnico) — `ProjectWizard.tsx`

Bajo el card del PRD técnico, nuevo card "Lovable Build Pack" con:

- Botón **"Generar Build Pack para Lovable"** (deshabilitado si no hay Step 29 con `technical_prd_v1`).
- Si existe Step 32:
  - **"Copiar prompt para Lovable"** (copia `build_pack_markdown` al portapapeles).
  - **"Descargar .md"**.
  - **"Descargar PDF"** (vía `generate-document` con `stepNumber: 32`, `contentType: "markdown"`, **sin reescritura LLM** — solo render del markdown exacto).
  - Badge con versión, word count y warnings.

### b) En `PipelineQAPanel` (Avanzado / Interno)

Añadir botón `generate_lovable_build_pack` con `step: "Step 32"` en `ACTION_META`. Mostrar raw JSON + metadata como el resto.

### c) En `ProjectDocumentsPanel`

Añadir Step 32 al listado de documentos descargables (`STEP_NAMES[32] = "Lovable Build Pack"`, `STEP_CONTENT_TYPE[32] = "markdown"`).

---

## 7. Renderer PDF (sin LLM)

En `generate-document`:

- Para `stepNumber: 32`, leer `build_pack_markdown` del output.
- Pasar **tal cual** al renderer markdown→PDF.
- **No** invocar LLM para reformatear, resumir o reescribir.
- Header: "Lovable Build Pack — {projectName}" + versión + fecha.

---

## 8. Tests obligatorios

Archivo: `supabase/functions/project-wizard-step/f9-lovable-build-pack_test.ts`

1. ✅ Step 32 se inserta append-only (`version = max + 1`).
2. ✅ Bloquea con `STALE_OR_INVALID_PRD` si no hay Step 29 con `technical_prd_v1`.
3. ✅ Usa el `scope_step.row_id` que viene en Step 29 (no busca otro Step 28).
4. ✅ Markdown contiene las 9 secciones por título exacto.
5. ✅ "Qué construir primero" contiene componentes de `data_foundation` + `mvp`.
6. ✅ Componentes de `fast_follow_f2` no aparecen en sección MVP.
7. ✅ Si Benatar está en F2 → aparece en "NO construir todavía".
8. ✅ Si Matching está en MVP → aparece en sección MVP.
9. ✅ Soul (data_foundation) aparece en "Base fundacional".
10. ✅ Sección IA contiene los 5 sub-bloques (RAGs, Agentes, MoE, Tools, HITL).
11. ✅ Si word count > 2500 → warning en `build_pack_meta.warnings`.
12. ✅ No incluye jerga: `Step 25|26|28`, `Component Registry`, `Edge Function`, `RLS`, `SQL`, `F4`, `F5`.
13. ✅ Validador post-LLM rechaza si un `scope_id` cambia de bucket.

---

## 9. Lo que NO se toca

- ❌ Step 25, 26, 27, 28 (lectura solo).
- ❌ Step 29 (lectura solo).
- ❌ Step 30 (propuesta cliente).
- ❌ Step 31 (`audit_final_deliverables`).
- ❌ Presupuesto.
- ❌ Auto-chain de aprobar briefing (Step 32 es manual).
- ❌ Generación de propuesta no depende del Build Pack.

---

## Criterio de aceptación final (AFFLUX)

Al pulsar "Generar Build Pack" sobre el Step 29 actual de AFFLUX, el documento producido debe:

- Citar el Step 29 y Step 28 exactos en metadata.
- Tener Soul de Alejandro en "Base fundacional".
- Tener Matching activo-inversor en "MVP".
- Tener Detector de fallecimientos en "MVP".
- Tener BrainsRE en "MVP" si Step 28 lo dejó ahí.
- Tener Benatar en "NO construir todavía / F2".
- Tener Generador de revista emocional en "F2" si el scope lo dejó ahí.
- Incluir las 5 sub-secciones IA explícitas.
- Ser copiable como prompt único para Lovable.dev.
- Quedar entre 1.500 y 2.500 palabras (warning si se pasa).
- Tener PDF descargable que es renderizado fiel del markdown, sin reescritura.

---

## Orden de implementación

1. `f9-lovable-build-pack.ts` (tipos + esqueleto determinista + render markdown).
2. Acción `generate_lovable_build_pack` en `index.ts` con source guard y append-only.
3. Tests Deno (los 13 listados).
4. UI Step 3 (card Build Pack con copiar/descargar).
5. UI `PipelineQAPanel` (botón Step 32).
6. UI `ProjectDocumentsPanel` (Step 32 en listado).
7. `generate-document` soporte para `stepNumber: 32` (markdown passthrough).
8. Deploy + smoke test sobre AFFLUX.

Sin migraciones SQL — el Build Pack reusa la tabla existente `pipeline_steps` con `step_number = 32`.
