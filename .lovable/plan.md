

# Fix: Step 4 approval not unlocking Step 5

## Root Cause

The project `b3ac852a` was created with the old 10-step system. The "Auditoría IA" data is stored in the DB as `step_number = 6` (old format). The frontend correctly maps it to display as step 4 via retrocompatibility logic, but when you click "Aprobar", the backend `approve_step` action runs:

```sql
UPDATE project_wizard_steps SET status = 'approved'
WHERE project_id = '...' AND step_number = 4
```

This matches **zero rows** because the actual row has `step_number = 6`. The approval silently fails, and step 5 never unlocks.

## Fix

Modify the `approve_step` action in `supabase/functions/project-wizard-step/index.ts` to handle the old-to-new step mapping. Before updating, check if a row exists for the given step number; if not, try the old step number equivalents (4 -> 6, 5 -> 7).

### Changes

**File: `supabase/functions/project-wizard-step/index.ts`** (approve_step block, ~line 2191)

Add reverse mapping logic before the update query:

```typescript
if (action === "approve_step") {
  const { stepNumber, outputData } = stepData;

  // Reverse map: new step -> possible old step_number in DB
  let dbStepNumber = stepNumber;
  const { data: existing } = await supabase
    .from("project_wizard_steps")
    .select("step_number")
    .eq("project_id", projectId)
    .eq("step_number", stepNumber)
    .limit(1);

  if (!existing || existing.length === 0) {
    // Try old step numbers
    const oldMap: Record<number, number[]> = { 3: [3,4,5], 4: [6], 5: [7] };
    const candidates = oldMap[stepNumber] || [];
    for (const old of candidates) {
      const { data: oldRow } = await supabase
        .from("project_wizard_steps")
        .select("step_number")
        .eq("project_id", projectId)
        .eq("step_number", old)
        .limit(1);
      if (oldRow && oldRow.length > 0) {
        dbStepNumber = old;
        break;
      }
    }
  }

  await supabase
    .from("project_wizard_steps")
    .update({ status: "approved", approved_at: new Date().toISOString(), output_data: outputData || undefined })
    .eq("project_id", projectId)
    .eq("step_number", dbStepNumber)
    .order("version", { ascending: false })
    .limit(1);

  // ... rest unchanged
}
```

This ensures old-format rows get correctly approved when the frontend sends new step numbers. Requires redeploying the `project-wizard-step` Edge Function.

