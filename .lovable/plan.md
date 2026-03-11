

# Fix: PRD generation timeout

## Problem
The PRD (Step 5) generation takes 6-7 minutes on the backend (6 AI calls + validation + linter retry), but the frontend polling timeout is 300s (5 min). The backend completes successfully, but the client throws "Timeout esperando paso 5 (300s)" before it finishes.

## Solution
Increase the polling timeout for Step 5 specifically, since the 6-part PRD generation is the heaviest operation in the pipeline.

## Changes

### `src/hooks/useProjectWizard.ts`

1. **Increase `pollForStepCompletion` default timeout** from 300s to 600s (10 min) to accommodate the 6-part PRD + validation + linter retry cycle.

2. **Alternative (more targeted)**: Pass a longer timeout specifically for step 5 in `runGenericStep`:
   ```typescript
   // In runGenericStep, line ~450:
   const timeout = stepNumber === 5 ? 600000 : 300000;
   const result = await pollForStepCompletion(stepNumber, timeout);
   ```

This is the minimal, targeted fix. The backend is working correctly — it's only the frontend giving up too early.

