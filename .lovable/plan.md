

## Problem

`navigateToStep(2)` does nothing because step 2 has status `"pending"` and `step (2) > currentStep (1)`. The guard condition in `useProjectWizard.ts` blocks navigation.

## Fix

**`src/hooks/useProjectWizard.ts` — `navigateToStep` function:**
Change the condition to also allow navigating to the **next step after the last approved one** (i.e., `step <= maxApprovedStep + 1`):

```ts
const navigateToStep = (step: number) => {
  const stepData = steps[step - 1];
  if (!stepData) return;
  const maxApproved = steps.reduce((max, s) => 
    s.status === "approved" && s.stepNumber > max ? s.stepNumber : max, 0);
  if (stepData.status === "approved" || stepData.status === "review" || 
      stepData.status === "editing" || step <= maxApproved + 1) {
    setCurrentStep(step);
  }
};
```

Also set `currentStep` to 2 after creating the project (since step 1 is auto-approved), so the DB `current_step` reflects the actual next actionable step. In `createWizardProject`, update `current_step: 2` in the insert, and after redirect the wizard will load at step 2 directly.

