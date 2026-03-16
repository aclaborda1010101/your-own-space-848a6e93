## Plan: PRD Dual Output — Lovable Build PRD + Expert Forge Input Spec ✅ DONE

### Changes applied

1. **`src/config/projectPipelinePrompts.ts`** — Added `buildPrdNormalizationPrompt()` with system+user prompt for dual-output restructuring. Defines exact structure for Document A (Lovable Build PRD: 15 sections, MVP-only) and Document B (Expert Forge Input Spec: 8 sections, IA architecture only).

2. **`supabase/functions/project-wizard-step/index.ts`** — Added Call 7 after PRD concatenation (line ~1770). Uses `callGeminiFlashMarkdown` with fallback to `callClaudeSonnet`. Splits output by `===DOCUMENT_SPLIT===` marker into `lovable_build_prd` and `expert_forge_spec` keys in `output_data`. Non-blocking: if normalization fails, PRD saves normally without dual output.

3. **`src/components/projects/wizard/ProjectWizardGenericStep.tsx`** — Added Tabs component for step 3 (PRD). When `outputData.lovable_build_prd` exists, renders 3 tabs: "PRD Completo", "Lovable Build PRD", "Expert Forge Spec". Falls back to single view for legacy data.

4. **`src/pages/ProjectWizard.tsx`** — Updated Publish to Forge flow to prefer `expert_forge_spec` over raw PRD document when available.

### What does NOT change
- 6-part parallel generation pipeline (calls 1-6)
- Validation call
- Database schema
- `document` key in output_data (backward compatible)
- Steps 1, 2, 4 (Entrada, Briefing, MVP)
- Budget, Proposal, Executive Summary flows
