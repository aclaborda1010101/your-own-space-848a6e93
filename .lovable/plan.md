

## Plan: Fix PRD timeout — Save before validation

### Root cause
The edge function `project-wizard-step` hits Supabase's ~400s wall-clock limit. The PRD save (line 1804) happens AFTER the validation call and linter, but the function gets killed during validation. Result: all 6 parts generated successfully but never saved.

### Fix in `supabase/functions/project-wizard-step/index.ts`

**Move the primary save to right after concatenation (line ~1743), BEFORE validation/linting.** Then run validation+linting as a secondary update if time permits.

1. After line 1743 (concatenation + clean), immediately:
   - Build the basic `prdOutputData` with `document: fullPrd`
   - Save to `project_wizard_steps` step 5 and step 3 with `status: "review"`
   - Update `business_projects.current_step = 3`
   - Log success

2. Move validation, linting, cost recording, normalization to run AFTER the save as best-effort enhancements:
   - Wrap in try/catch with AbortController (60s timeout)
   - If validation completes, update the already-saved record with enriched data (validation scores, blueprint, checklist, specs, linter results)
   - If it times out or fails, the PRD is already saved and usable

3. Add an early save of `blueprint`/`checklist`/`specs` extraction (regex-based, instant) in the primary save block since these are deterministic string operations.

### Result
- PRD saves immediately after generation (~6 min mark), well within the timeout
- Validation/linting/normalization become non-blocking enrichments
- If the function is killed during enrichment, the user still gets the full PRD
- Current stuck project will work on next regeneration

### Immediate fix for the stuck project
- The step is stuck at `status: "generating"` with null data. Could add a manual SQL update or a "force reset" button, but regenerating is simpler since the fix prevents recurrence.

