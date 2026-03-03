

## Diagnosis: PRD generates but response arrives too late

The edge function logs show the PRD completed successfully (linter passed), but the HTTP connection was already closed by the client/proxy at ~150s. The function finished at ~154s — just 4 seconds too late.

```text
Timeline:
0s    — Request received
88s   — Parts 1-3 done (parallel)  
138s  — Part 4 done
153s  — Validation + Linter done
~150s — HTTP connection killed by proxy/client
154s  — Function tries to respond → "connection closed before message completed"
```

### Root Cause

The `generate_prd` block runs synchronously inside the HTTP handler. Even with parallelization, the total time (~154s) exceeds the HTTP gateway timeout (~150s). The function completes but can't deliver the response.

### Fix: Async execution with `EdgeRuntime.waitUntil()`

Other heavy steps in this project already use this pattern (per project memory). The idea:

1. **Return immediately** with `{ status: "generating", message: "PRD en generación" }`
2. **Run the heavy work** inside `EdgeRuntime.waitUntil(promise)` — this keeps the worker alive after the HTTP response is sent
3. **Save results to DB** at the end (already happens)
4. **Client polls** for completion by checking the step status in `project_wizard_steps`

### Changes

**`supabase/functions/project-wizard-step/index.ts`** — `generate_prd` block:

- Wrap the entire generation logic (Parts 1-4 + validation + linter + DB save) in an async function
- Pass it to `EdgeRuntime.waitUntil()`
- Return HTTP 202 immediately with `{ status: "generating" }`
- On error inside the async block, update the step status to `"error"` in the DB

**`src/hooks/useProjectWizard.ts`** — `runGenericStep` (or a new `runPrdStep`):

- After invoking the edge function, start polling `project_wizard_steps` for `step_number = 7` where `status = 'review'` (success) or `status = 'error'` (failure)
- Poll every 5-10 seconds with a max timeout of ~300s
- Update local state when the step completes

**`src/pages/ProjectWizard.tsx`** — No structural changes needed; the `generating` state already shows a spinner. The polling will flip `generating` off when done.

### Files modified

| File | Change |
|---|---|
| `supabase/functions/project-wizard-step/index.ts` | Wrap `generate_prd` in `waitUntil()`, return 202 immediately |
| `src/hooks/useProjectWizard.ts` | Add polling logic for async steps |

