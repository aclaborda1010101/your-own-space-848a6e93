

## Problem

The SaaS evaluation (step 201) never persists to the database. The edge function uses `upsert` with `onConflict: "project_id,step_number"`, but there is **no unique constraint** on `(project_id, step_number)` in `project_wizard_steps`. This causes the upsert to silently fail. The result is returned to the frontend (so it displays), but when the user navigates away and returns, the data is gone.

## Fix

### 1. Add unique constraint on `project_wizard_steps(project_id, step_number)`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS project_wizard_steps_project_step_unique 
ON project_wizard_steps (project_id, step_number);
```

This fixes the upsert for step 201 **and** for all other steps that use the same pattern throughout the codebase.

### 2. Deduplicate existing rows (if any)

Before adding the constraint, delete duplicate rows (keep the latest per project+step):

```sql
DELETE FROM project_wizard_steps a
USING project_wizard_steps b
WHERE a.project_id = b.project_id
  AND a.step_number = b.step_number
  AND a.created_at < b.created_at;
```

### 3. Edge function — fallback to INSERT if upsert still fails

Change the save logic in `evaluate-saas-opportunity/index.ts` to use a delete-then-insert pattern as a safety net, avoiding dependency on the constraint:

```ts
await supabase
  .from("project_wizard_steps")
  .delete()
  .eq("project_id", projectId)
  .eq("step_number", 201);

await supabase
  .from("project_wizard_steps")
  .insert({ ... });
```

### Files affected

| File | Change |
|------|--------|
| Migration SQL | Add unique index on `(project_id, step_number)` after dedup |
| `supabase/functions/evaluate-saas-opportunity/index.ts` | Replace upsert with delete+insert for reliability |

