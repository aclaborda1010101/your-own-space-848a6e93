

# Diagnosis: PRD Not Showing Due to DataSnapshot Gate

## Root Cause

The `dataPhaseComplete` state is stored in React `useState` (initialized to `false`). Every time the page reloads or Lovable rebuilds the app (which happened when I edited `ProjectWizardGenericStep.tsx` moments ago), this state resets to `false`.

The rendering logic at line 259 of `ProjectWizard.tsx`:

```
if (currentStep === 7 && !dataPhaseComplete) {
  const needsData = sd?.rag?.necesario || sd?.pattern_detector?.necesario;
  if (needsData) {
    return <ProjectDataSnapshot ... />;  // BLOCKS the PRD view
  }
}
```

Since `pattern_detector.necesario = true` for this project, and `dataPhaseComplete` resets to `false` on reload, the UI always shows the DataSnapshot sub-phase instead of the PRD generating spinner or the PRD result -- even though the PRD successfully generated in the backend (confirmed in edge function logs: "Background generation completed successfully").

The PRD IS generated and saved in the database. The user just can't see it because the DataSnapshot gate blocks the view.

## Fix

When loading project data, auto-detect if step 7 already has output or is in "generating"/"review" status, and if so, set `dataPhaseComplete = true` automatically. This way, after a page reload, the DataSnapshot phase is skipped if the PRD already exists.

### Changes

**File: `src/pages/ProjectWizard.tsx`** (or `src/hooks/useProjectWizard.ts`)

Add an effect that checks: if step 7 has `outputData` or `status === "generating"` or `status === "review"`, set `dataPhaseComplete(true)`. This runs once after `steps` are loaded.

```ts
// In ProjectWizardEdit or useProjectWizard
useEffect(() => {
  const step7 = steps.find(s => s.stepNumber === 7);
  if (step7 && (step7.outputData || step7.status === "generating" || step7.status === "review")) {
    setDataPhaseComplete(true);
  }
}, [steps]);
```

This is a 5-line fix in one file. No backend changes needed.

