

## Plan: Migrate PRD generation to Lovable-Ready (V11) ✅ DONE

### Changes applied
1. **`src/config/projectPipelinePrompts.ts`** — Replaced with V11 (1081 lines). Step 7 model changed to `gemini-pro`. 5 new prompt builders for PRD generation.
2. **`supabase/functions/project-wizard-step/index.ts`** — `generate_prd` block replaced: 4 Gemini Pro calls + 1 Claude validation. Blueprint extracted as separate field. Specs D1/D2 included.

### What did NOT change
- Phases 2-6, 8-9: same prompts, same models
- Helper functions: `callGeminiFlash`, `callGeminiPro`, `callClaudeSonnet`, `recordCost` — reused as-is
- UI components — PRD renders as Markdown, no changes needed
