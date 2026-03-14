

## Problem

When approving Auditoría IA (step 4), the backend correctly sets `current_step = 5` (PRD) in the database. But on reload, `mapOldStepNumber(5)` in `useProjectWizard.ts` line 86 maps it back to step 3 ("Documento de Alcance") because it assumes the old 10-step numbering where step 5 was part of the scope phase.

The mapping function cannot distinguish between "old step 5" and "new step 5" since they overlap.

## Root cause

```typescript
// Line 53: old steps 3-5 → new step 3
if (oldStep <= 5) return 3;
```

This catches `current_step = 5` (which is now the PRD step in the new system) and maps it to 3.

## Fix

Change `mapOldStepNumber` to only apply legacy mapping when `current_step > 6` (the new system only uses 1-6, so any value > 6 is definitely old numbering). For values 1-6, return them as-is since the approve_step backend now writes correct new-system numbers.

**File:** `src/hooks/useProjectWizard.ts`

Replace `mapOldStepNumber` (lines 51-58) with:

```typescript
const mapOldStepNumber = (rawStep: number): number => {
  // New system uses steps 1-6. Only remap if > 6 (legacy 10-step system)
  if (rawStep <= 6) return rawStep;
  if (rawStep === 7) return 5;   // Old step 7 → PRD
  if (rawStep === 8) return 6;   // Old step 8 → MVP
  return 6;                       // Old steps 9-10 → MVP
};
```

This preserves retrocompatibility for truly legacy projects (which have `current_step` values 7-10) while stopping the harmful remapping of values 3-5 that are now valid in the new system.

