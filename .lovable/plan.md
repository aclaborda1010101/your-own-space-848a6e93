

# Plan: PRD Dual Output — Lovable Build PRD + Expert Forge Input Spec

## Problem

The current PRD generation (6-part LLD, ~25 sections) produces a single monolithic document that mixes build-ready specs (SQL, Edge Functions, screens, routes) with IA architecture specs (RAGs, specialists, router logic, Soul, hydration). This makes it suboptimal for both automated consumption paths:
- **Lovable** gets noise from IA architecture that doesn't apply to the build
- **Expert Forge** gets noise from SQL schemas and UI wireframes that don't apply to RAG/specialist generation

The content quality is good. The structure needs normalization into two separate, clean artifacts.

## Approach

Split the PRD generation output into two documents stored as separate keys in `output_data`. The existing 6-call parallel pipeline stays the same, but a **7th call** (post-concatenation) restructures the monolithic PRD into two normalized documents. The UI adds tabs to view/export each document independently.

## Changes

### 1. Edge Function: Add Document Splitting Call (post-generation)

**File**: `supabase/functions/project-wizard-step/index.ts`

After the 6 parts are concatenated and validated (line ~1707), add a new AI call that takes the full PRD and produces two structured documents:

- **Call 7**: "Normalize into dual output" — takes `fullPrd` and produces:
  - `lovable_build_prd`: Stripped to resumen ejecutivo, problema, objetivos, alcance MVP cerrado, modulos MVP (each with objetivo/entidades/pantallas/edge functions/dependencias), pantallas y rutas, flujos principales, RF mapped to entidad+pantalla+funcion, RNF, modelo de datos MVP, edge functions MVP, RBAC, QA checklist, exclusiones, matriz trazabilidad. No Soul, no RAG specs, no future phases detail.
  - `expert_forge_spec`: Knowledge Domains, Core Entities, Proposed RAGs (name/purpose/entities/sources/doc types/priority/quality/restrictions), Proposed Specialists (name/mission/inputs/outputs/RAGs/behavior rules/abstention/success criteria), Router Logic, Soul Inputs, Hydration Plan, Deterministic vs Probabilistic Boundary.

Update `output_data` structure:
```typescript
const prdOutputData = {
  document: fullPrd,          // keep original for backward compat
  lovable_build_prd: string,  // NEW: normalized Lovable PRD
  expert_forge_spec: string,  // NEW: normalized Expert Forge spec
  blueprint,                  // keep existing
  checklist,                  // keep existing
  specs,                      // keep existing
  validation: validationData,
};
```

### 2. System Prompt for Call 7

New prompt that:
- Takes the full 25-section PRD as input
- Outputs two markdown documents separated by `===DOCUMENT_A===` and `===DOCUMENT_B===`
- Document A follows the exact Lovable Build PRD structure from the user's spec
- Document B follows the exact Expert Forge Input Spec structure (8 sections)
- Rules: no content invention, only restructuring; P0/P1 vs post-MVP separation; ontology in machine-readable format; variables grouped by domain/entity/type/unit; patterns split into MVP rules vs Future rules; external data sources tagged with `requires_external_source`; traceability matrix at the end of Doc A

### 3. UI: Tabs for Dual Output

**File**: `src/components/projects/wizard/ProjectWizardGenericStep.tsx`

When `stepNumber === 3` (PRD in new pipeline) and `outputData.lovable_build_prd` exists, render tabs:
- **PRD Completo** (existing `document`)
- **Lovable Build PRD** (new `lovable_build_prd`)
- **Expert Forge Spec** (new `expert_forge_spec`)

Each tab shows the markdown content and has its own download button.

### 4. Publish to Forge uses new spec

**File**: `src/pages/ProjectWizard.tsx` (lines ~225-250)

When building `fullDocumentText` for `PublishToForgeDialog`, prefer `step3Out.expert_forge_spec` over the raw PRD if available.

### 5. Prompt file update

**File**: `src/config/projectPipelinePrompts.ts`

Add exported prompt builder `buildPrdNormalizationPrompt(fullPrd: string)` for the dual-output restructuring call, keeping prompt logic centralized.

## Cost Impact

One additional AI call (~8-12K tokens input, ~12-20K output) per PRD generation. Estimated ~$0.05-0.10 additional cost per project. Uses same model as PRD (Gemini Pro, fallback Claude).

## What Does NOT Change

- The 6-part parallel generation pipeline (calls 1-6)
- Validation call (call 7 becomes call 8)
- Database schema
- The `document` key in output_data (backward compatible)
- Steps 1, 2, 4 (Entrada, Briefing, MVP)
- Budget, Proposal, Executive Summary flows

