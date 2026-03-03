

## Plan: Migrate PRD generation to Lovable-Ready (V11)

### What changes

**File 1: `src/config/projectPipelinePrompts.ts`** -- Full replacement (700 lines -> 1081 lines)
- `STEP_MODELS[7]` changes from `"claude-sonnet"` to `"gemini-pro"`
- `PRD_SYSTEM_PROMPT` rewritten with forced Lovable stack (React+Vite+Supabase, explicit prohibition of Next.js/Express/AWS)
- `buildPrdPrompt` removed, replaced by 5 new builders:
  - `buildPrdPart1Prompt` -- Sections 1-5 (Executive Summary, Objectives, Scope, Personas, Flows)
  - `buildPrdPart2Prompt` -- Sections 6-10 (Modules, Functional Reqs, NFRs, Data Model, Integrations)
  - `buildPrdPart3Prompt` -- Sections 11-15 (AI, Telemetry, Risks, Phases, Annexes)
  - `buildPrdPart4Prompt` -- Lovable Blueprint (copy/paste) + Specs D1 (RAG) + D2 (Patterns)
  - `buildPrdValidationPrompt` + `PRD_VALIDATION_SYSTEM_PROMPT` -- Cross-validation with Claude as auditor
- Phases 2-6, 8-9: no functional changes (same prompts, same models)

**File 2: `supabase/functions/project-wizard-step/index.ts`** -- Replace only the `generate_prd` block (lines 489-581)
- 4 sequential generative calls with Gemini Pro 2.5 (was 2 calls with Gemini Flash)
- 1 validation call with Claude Sonnet as cross-auditor
- `output_data` now includes: `document` (full PRD), `blueprint` (copy/paste section), `specs` (D1+D2), `validation` (audit result)
- Blueprint saved as separate document in `project_documents`
- Cost metadata includes per-part breakdown and validation data
- Accepts `targetPhase` in `stepData` for phase-specific Blueprint
- Fallback: if Gemini Pro fails on any part, falls back to Claude Sonnet

### What does NOT change
- `callGeminiFlash`, `callGeminiFlashMarkdown`, `callClaudeSonnet`, `callGeminiPro` -- reused as-is
- `recordCost`, `truncate` -- reused as-is
- All other actions (extract, generate_scope, run_audit, etc.) -- untouched
- UI components -- PRD already renders as Markdown, new structure displays correctly

### Cost impact
- Before: ~$0.01 per PRD (2 Gemini Flash calls)
- After: ~$0.44 per PRD (4 Gemini Pro + 1 Claude validation)
- Eliminates need for separate `project-generate-lovable-prompt` edge function

### Deployment
- Edge function auto-deploys on save
- No database migration needed
- No UI changes needed

