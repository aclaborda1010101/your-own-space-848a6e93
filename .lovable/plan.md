

## Problem

When approving step 4 (MVP — the last step), the backend sets `current_step = stepNumber + 1 = 5`. Since `TOTAL_STEPS = 4`, when the page reloads:
- `currentStep` becomes 5
- No `currentStep === 4` or `currentStep === 5` block renders content
- The pipeline card appears empty, as if nothing was approved

## Fix

### 1. Clamp `currentStep` in the backend (`index.ts` ~line 2843)

Cap the `current_step` update so it never exceeds `TOTAL_STEPS`:

```ts
await supabase.from("business_projects")
  .update({ current_step: Math.min(stepNumber + 1, 4) })
  .eq("id", projectId);
```

This keeps step 4 as the active view after approval.

### 2. Defensive clamp in `useProjectWizard.ts` (frontend)

When loading the project, clamp `currentStep` to the valid range so existing projects with `current_step = 5` in the DB also work:

```ts
const rawStep = proj.current_step || 1;
setCurrentStep(Math.min(rawStep, TOTAL_STEPS));
```

### Files affected

| File | Change |
|------|--------|
| `supabase/functions/project-wizard-step/index.ts` | Clamp `current_step` to max 4 on approve |
| `src/hooks/useProjectWizard.ts` | Clamp loaded `currentStep` to TOTAL_STEPS |

