

## Problem Summary

Your PRD pipeline has two gaps:

1. **The PRD Section 15 is generated flat** (RAGs/Agentes/Motores/Orquestadores/Aprendizaje) instead of by the 5 layers (A-E) — despite the prompts already requesting the layer structure. The prompt for Part 4 (Section 15) still uses the old subsection naming (15.1 RAGs, 15.2 Agentes, etc.) which doesn't match the 5-layer prompt in `projectPipelinePrompts.ts`.

2. **The Architecture Manifest is compiled but never sent to ExpertForge.** The `PublishToForgeDialog` sends only `prdText` (the narrative document). The compiled manifest JSON sitting in `output_data.architecture_manifest` is completely ignored during publishing.

3. **Several PRD contradictions** identified in your feedback (useState rule, MVP scope inflation, missing governance metadata per module) stem from prompt inconsistencies between `index.ts` (Part 4 prompt) and `projectPipelinePrompts.ts` (PRD system prompt).

## Plan

### Step 1: Align Part 4 prompt with 5-layer architecture

**File:** `supabase/functions/project-wizard-step/index.ts` (~line 1207-1244)

Rewrite the Part 4 user prompt so Section 15 subsections match exactly:
- 15.1 Capa A — Knowledge Layer
- 15.2 Capa B — Action Layer  
- 15.3 Capa C — Pattern Intelligence Layer
- 15.4 Capa D — Executive Cognition Layer
- 15.5 Capa E — Improvement Layer
- 15.6 Mapa de Interconexiones
- 15.7 Resumen de Infraestructura IA

Add mandatory per-module fields in the prompt: `sensitivity_zone`, `materialization_target`, `execution_mode`, `automation_level`, `requires_human_approval`.

Add Soul governance fields when D is active: `enabled`, `subject_type`, `scope`, `authority_level`, `source_types`, `influences_modules`, `excluded_from_modules`, `governance_rules`.

Add Improvement Layer fields when E is active: `feedback_signals`, `outcomes_tracked`, `evaluation_policy`, `review_cadence`.

### Step 2: Fix useState contradiction in PRD system prompt

**File:** `supabase/functions/project-wizard-step/index.ts` (~line 1068)

Change:
> `Estado: React hooks — NO Redux, NO Zustand`

To:
> `Estado: React hooks + Supabase Realtime como source of truth. useState solo para UI/rendering/cache local. Prohibido usar useState como fuente de verdad de datos de negocio. NO Redux, NO Zustand.`

### Step 3: Send manifest alongside PRD to ExpertForge

**File:** `src/pages/ProjectWizard.tsx` (~line 340-394)

Extract `architecture_manifest` from `step3Out` (alongside `document`) and pass it as a new prop to `PublishToForgeDialog`.

**File:** `src/components/projects/wizard/PublishToForgeDialog.tsx`

Add optional `architectureManifest` prop. When publishing, include it in the payload as `architecture_manifest`.

**File:** `supabase/functions/publish-to-forge/index.ts`

Read `architecture_manifest` from the request body and include it in the gateway payload alongside `document_text`. This gives ExpertForge the structured JSON contract instead of having to infer everything from prose.

### Step 4: Improve manifest compilation prompt for robustness

**File:** `supabase/functions/project-wizard-step/manifest-schema.ts` (~line 395-433)

Enhance `MANIFEST_COMPILATION_SYSTEM_PROMPT` to:
- Explicitly require governance fields for Soul (D) modules
- Require `feedback_signals`/`outcomes_tracked` when E is active
- Add a validation checklist the LLM must run before output
- Strengthen the instruction to use the 5-layer structure from Section 15 as primary source

### Step 5: Add manifest viewer in the wizard UI

**File:** New section in `ProjectWizardGenericStep.tsx` or `ProjectWizard.tsx`

When step 5 (PRD) has `architecture_manifest` in its output, show a collapsible panel with:
- Layers active (A-E badges)
- Module count per layer
- Validation status (errors/warnings/advice counts)
- Expandable module list

This lets you review the manifest before publishing to Forge.

## Technical Details

- The Part 4 prompt (~1200 chars of Section 15 instructions) will be replaced with the 5-layer version already defined in `projectPipelinePrompts.ts` lines 420-497 — ensuring consistency
- The manifest is already compiled in Call 6 and stored in `output_data.architecture_manifest` — no new LLM calls needed
- The `publish-to-forge` edge function already accepts arbitrary fields in its payload, so adding `architecture_manifest` is backward-compatible
- The manifest validator (`validateManifest`) already checks all the governance rules you mentioned — it just needs the PRD to generate them correctly

## Impact

- PRDs will be generated with proper 5-layer Section 15 structure
- Each module will carry governance metadata (sensitivity, automation, approval)
- ExpertForge will receive both the narrative PRD AND the structured manifest
- The useState contradiction will be resolved
- You'll be able to review the manifest before publishing

