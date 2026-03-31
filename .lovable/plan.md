

# Fix: Pattern Detection Step Stuck at "generating"

## Root Cause

The pattern detection runs as a **fire-and-forget** `fetch()` from `project-wizard-step`. The `.then()` callback that updates step 12's status to `"review"` runs inside the **same Deno isolate** as the parent function. But the parent function returns its response and shuts down **before** the pattern detector finishes (~2 min later). The callback never executes → step 12 stays stuck at `"generating"` forever.

The `pattern-detector-pipeline` function itself **never touches `project_wizard_steps`** — it only writes to its own `pattern_detector_runs` table.

## Fix (two parts)

### 1. Move step 12 status update INTO `pattern-detector-pipeline/index.ts`

At the end of the `pipeline_run` action (after saving all results to `pattern_detector_runs`), add code to also update `project_wizard_steps` step 12 to `"review"` with the results summary. This way the function that actually completes the work is the one that updates the status — no dependency on the parent's `.then()`.

The pipeline already receives `project_id` in the request body, so it has everything needed.

### 2. Remove the `.then()` callback from `project-wizard-step/index.ts`

Remove the dead `.then()` block (lines 1653-1682) that tries to update step 12 after the fetch. Keep only the fire-and-forget `fetch()` and the initial `upsert` that sets step 12 to `"generating"`.

### 3. Immediate fix: update the stuck row now

Run a query to set step 12 to `"review"` for the current project so the UI stops spinning immediately.

## Files Modified
1. `supabase/functions/pattern-detector-pipeline/index.ts` — add step 12 status update at pipeline completion
2. `supabase/functions/project-wizard-step/index.ts` — remove dead `.then()` callback (lines 1653-1682)

