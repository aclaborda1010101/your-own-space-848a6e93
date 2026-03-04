

## Plan: Invalidar pasos posteriores al regenerar

Cuando se regenera un paso N, todos los pasos N+1 a 10 deben resetearse (borrar output_data, volver a status "pending") porque sus datos dependen del output del paso regenerado.

### Cambio: `useProjectWizard.ts`

Add a `clearSubsequentSteps` function that deletes all `project_wizard_steps` rows with `step_number > N` for the current project. Call it at the start of:

- `runExtraction` (step 2) — clears steps 3-10
- `generateScope` (step 3) — clears steps 4-10  
- `runGenericStep(stepNumber)` — clears steps stepNumber+1 to 10

```typescript
const clearSubsequentSteps = async (fromStep: number) => {
  if (!projectId) return;
  await supabase
    .from("project_wizard_steps")
    .delete()
    .eq("project_id", projectId)
    .gt("step_number", fromStep);
  
  // Also reset current_step on the project to fromStep
  await supabase
    .from("business_projects")
    .update({ current_step: fromStep } as any)
    .eq("id", projectId);
};
```

This is called **before** the generation API call in each function, so by the time `loadProject()` runs after generation completes, the subsequent steps are already gone and show as "pending".

Also reset `dataPhaseComplete` to `false` if clearing step 7+.

### Files

| File | Change |
|---|---|
| `src/hooks/useProjectWizard.ts` | Add `clearSubsequentSteps`, call it in `runExtraction`, `generateScope`, `runGenericStep` |

