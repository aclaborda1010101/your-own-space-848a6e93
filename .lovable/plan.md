

## Corrección Estructural Completa: PRD → Manifest → Publish to Forge

### Analysis of Current State

After thorough review, here's what's **already correct** and what **needs fixing**:

**Already correct (no changes needed):**
- `publish-to-forge/index.ts`: Lines 10-76 already have complete 5-layer interpretation rules, manifest precedence, anti-invention rules, Soul governance, phase blocking. Lines 243-288 already forward `architecture_manifest` in payload. **This file is done.**
- `index.ts` lines 1064-1068: State management rule already correct.
- `index.ts` lines 1340-1413: Manifest compilation, validation, repair already works.
- `index.ts` lines 1543-1570: Manifest saved to `output_data.architecture_manifest` already.
- `manifest-schema.ts` lines 395-443: Already has checklist, governance rules, fuente primaria rule, anti-invention rules.

**Needs fixing (5 targeted changes):**

---

### File 1: `supabase/functions/project-wizard-step/index.ts`

**Change 1a — Add precedence rule + final check to `prdSystemPrompt` (~line 1075-1081)**

Insert before the closing backtick of `prdSystemPrompt` (before line 1081):

```
## REGLA DE PRECEDENCIA
Si existe contradicción entre PRD narrativo y Architecture Manifest, manda Architecture Manifest.

## CHECK FINAL OBLIGATORIO ANTES DE RESPONDER
Verifica y corrige si ocurre cualquiera de estos fallos:
- Sección 15 no está en estructura 15.1-15.7 por capas A-E
- un componente F2/F3/FN aparece como buildable MVP
- un módulo carece de materialization_target, sensitivity_zone, execution_mode, automation_level o requires_human_approval
- Soul aparece sin governance_rules
- Improvement activa aparece sin feedback_signals ni outcomes_tracked
- el Blueprint incluye componentes fuera del MVP
Si detectas cualquiera de estos fallos, CORRIGE el documento antes de emitirlo.
```

**Change 1b — Add anti-flat-structure guard to `userPrompt4` (~line 1244)**

Insert right after `GENERA SECCIONES 15-20 DEL PRD LOW-LEVEL.` and before the existing `⚠️ INSTRUCCIÓN CRÍTICA`:

```
⚠️ PROHIBIDO ESTRUCTURA PLANA:
No uses estructura plana de "RAGs / Agentes / Motores / Orquestadores / Aprendizaje" como subsecciones de la Sección 15.
La ÚNICA estructura válida es 15.1-15.7 por capas A-E.
Si generas una estructura diferente, el documento será INVÁLIDO y debe corregirse antes de emitirse.
```

**Change 1c — Add MVP absolute block to `userPrompt5` (~line 1268)**

Insert after `REGLAS OBLIGATORIAS:` section and before the numbered rules (1-8):

```
BLOQUEO ABSOLUTO DE MVP:
Todo componente con phase != MVP queda EXCLUIDO de:
- SQL ejecutable de este Blueprint
- rutas/pantallas de este Blueprint
- Edge Functions de este Blueprint
- Inventario IA de este Blueprint
- Checklist P0/P1 de construcción
Solo puede aparecer en "SPECS PARA FASES POSTERIORES" al final.
NO incluir componentes F2/F3/FN en el Lovable Build Blueprint.
Si tienes duda sobre si algo es MVP, la respuesta es NO.
```

Also fix the old naming in the Inventario IA table. Replace:
```
Donde Tipo es uno de:
- RAG (Base de Conocimiento)
- Agente IA (Especialista con LLM)
- Motor Determinista (Cálculo puro sin LLM — poner "—" en Modelo LLM y Temp)
- Orquestador (Enrutador de componentes)
- Módulo Aprendizaje (Feedback loop)
```
With:
```
Donde Tipo corresponde al module_type del componente en la Sección 15:
- knowledge_module (Capa A — RAG/Base de Conocimiento)
- action_module (Capa B — Agente IA con LLM)
- deterministic_engine (Capa C — Motor sin LLM — poner "—" en Modelo LLM y Temp)
- pattern_module (Capa C — Scoring/Predicción)
- router_orchestrator (Capa B — Enrutador MoE)
- executive_cognition_module (Capa D — Soul)
- improvement_module (Capa E — Feedback loop)
```

And replace the old numbering rules that reference "15.1 RAGs", "15.2 Agentes" etc:
```
1. Si la sección 15 tiene N componentes knowledge_module con Fase MVP, esta tabla tiene N filas de ese tipo.
2. Si la sección 15 tiene N action_modules con Fase MVP, esta tabla tiene N filas.
3. Igual para pattern_module, deterministic_engine, router_orchestrator, executive_cognition_module, improvement_module.
4. El TOTAL de filas = Total componentes MVP de la tabla 15.7.
```

---

### File 2: `supabase/functions/project-wizard-step/manifest-schema.ts`

**Change 2a — Strengthen compilation prompt (~line 436)**

Replace line 436 with expanded source priority:

```
ORDEN DE PRIORIDAD PARA COMPILAR EL MANIFEST:
1. Sección 15 del PRD (organizada por capas A-E) — fuente primaria y mandatoria para extraer módulos.
2. Metadata explícita complementaria en secciones técnicas (14, 16, 18) — solo si complementa sin contradecir.
3. Resto del PRD — solo como contexto auxiliar, NUNCA como fuente de módulos.
Si hay contradicción entre fuentes, MANDA la Sección 15.

PROHIBICIONES ADICIONALES:
- NO INVENTAR módulos no sustentados por el PRD.
- NO INFERIR Soul por defecto.
- NO convertir roadmap en MVP.
- NO convertir pattern en action ni knowledge en pattern.
- Si phase != MVP, usar materialization_target = roadmap_only salvo justificación explícita del PRD.
```

**Change 2b — Strengthen `buildManifestCompilationPrompt` (~line 456)**

Replace line 456 with:
```
Extrae los módulos tomando como referencia PRIMARIA la Sección 15 del PRD (organizada por capas A-E). Las demás secciones solo sirven como contexto complementario. Si hay contradicción, manda la Sección 15.
NO inventes módulos que no estén explícitamente definidos en el PRD.
Genera el JSON completo del Architecture Manifest siguiendo el schema v1.0.`;
```

---

### File 3: `src/components/projects/wizard/ManifestViewer.tsx`

**Change 3 — Add governance badges per module**

In the expanded module row (lines ~121-134), add badges for:
- `sensitivity_zone` (colored badge)
- `automation_level` (badge)
- `requires_human_approval` (lock icon if true)
- `execution_mode` (badge, already partially there)

---

### File 4: `src/config/projectPipelinePrompts.ts`

**Change 4 — Add legacy notice**

Replace lines 1-2 with:
```typescript
/**
 * ⚠️ LEGACY / STANDALONE PROMPTS
 * Este fichero NO es la fuente canónica del flujo chained (generate_prd_chained).
 * La fuente canónica activa del pipeline vive en:
 * supabase/functions/project-wizard-step/index.ts
 *
 * Cualquier cambio estructural del pipeline debe hacerse primero en index.ts.
 * Este archivo se mantiene por retrocompatibilidad del flujo standalone.
 */
// ── Project Pipeline Prompts — V13 SIMPLIFIED 5-STEP PIPELINE ────────────
```

---

### File 5: `supabase/functions/publish-to-forge/index.ts`

**Change 5 — Add strict no-re-inference rule**

After line 21 (after the `module_type` list), insert:

```
REGLA DE PRECEDENCIA ABSOLUTA:
Si architecture_manifest existe en el payload:
- PROHIBIDO re-inferir module_type desde document_text
- PROHIBIDO re-inferir layer desde document_text
- PROHIBIDO re-inferir materialization_target desde document_text
- PROHIBIDO re-inferir phase desde document_text
Solo se permite fallback al PRD narrativo para campos AUSENTES en el manifest.
El manifest es el contrato técnico cerrado. El PRD es documentación explicativa.
```

---

### Summary

| File | Change | Purpose |
|------|--------|---------|
| `index.ts` (system prompt) | Precedence rule + final check | Self-correction before emitting |
| `index.ts` (Part 4) | Anti-flat-structure guard | Forces 5-layer Section 15 |
| `index.ts` (Part 5) | MVP absolute block + layer-aligned naming | Stops blueprint inflation |
| `manifest-schema.ts` | Source priority + anti-invention rules | Cleaner manifest compilation |
| `ManifestViewer.tsx` | Governance badges per module | Pre-publish review |
| `projectPipelinePrompts.ts` | Legacy header | Prevents prompt drift |
| `publish-to-forge/index.ts` | No-re-inference rule | Manifest = closed contract |

### What's NOT changing (already correct)
- Manifest compilation flow (Call 6)
- Manifest save to `output_data.architecture_manifest`
- `PublishToForgeDialog` manifest forwarding
- `ProjectWizard.tsx` manifest extraction and viewer rendering
- `validateManifest()` deterministic validator
- `safeParseManifest()` with repair
- Forge interpretation rules (already 5-layer, just adding the no-re-inference clause)

### Deployment
- Deploy `project-wizard-step` and `publish-to-forge` edge functions
- No DB migrations, no new secrets

