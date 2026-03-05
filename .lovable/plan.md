

# Plan: Skip RAG Dirigido (Step 9) When RAG Is Disabled

## Problem
When the services_decision from Step 6 has RAG disabled (`rag.necesario = false`) but Pattern Detector enabled, the pipeline still requires the user to go through Step 9 (RAG Dirigido). It should skip directly from Step 8 (Blueprint) to Step 10 (Ejecución de Patrones).

## Approach
Add conditional skip logic in two places:

### 1. Auto-skip Step 9 on approve of Step 8
**File: `src/pages/ProjectWizard.tsx`**

After approving step 8, check `services_decision.rag.necesario`. If false, auto-approve step 9 with a placeholder output (`{ skipped: true, reason: "RAG no recomendado" }`) and navigate directly to step 10.

### 2. Visual indicator in stepper sidebar
When RAG is not needed, Step 9 in the sidebar should show as "Omitido" (skipped) with a muted style, so the user understands it was intentionally bypassed.

### 3. Prevent manual navigation to skipped step
In the step content area, if step 9 is reached but RAG is disabled, show a brief message ("RAG no necesario para este proyecto — paso omitido") and auto-advance.

## Changes

| File | Change |
|------|--------|
| `src/pages/ProjectWizard.tsx` | Add skip logic after step 8 approval; add guard for step 9 rendering |
| `src/hooks/useProjectWizard.ts` | No changes needed — `approveStep` already supports passing outputData |

## Implementation Detail

In `ProjectWizard.tsx`, wrap the `onApprove` for the generic step to intercept step 8:

```ts
onApprove={async () => {
  await approveStep(currentStep);
  // If step 8 approved and RAG not needed, skip step 9
  if (currentStep === 8) {
    const sd = steps.find(s => s.stepNumber === 6)?.outputData?.services_decision;
    if (!sd?.rag?.necesario) {
      await approveStep(9, { skipped: true, reason: "RAG no recomendado en servicios" });
      navigateToStep(10);
    }
  }
}}
```

This is a ~15-line change in one file.

