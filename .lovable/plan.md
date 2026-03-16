

## Plan: Add pre-cleanup to publish-to-forge before architect call

### Root Cause (confirmed)

No direct INSERTs exist in JARVIS code. The `PublishToForgeDialog.tsx` correctly sends only `create_and_architect` with the full PRD to the `publish-to-forge` Edge Function, which forwards it to the Expert Forge gateway.

The issue is that the Expert Forge gateway's deduplication (0.8 similarity threshold) finds stale/generic components from a previous failed or partial run and reuses them instead of creating the correct ones from the PRD.

### Fix: Pre-cleanup in `publish-to-forge/index.ts`

Before calling `architect`, send a `clean_project` action to the gateway to wipe existing components, so deduplication has nothing stale to match against.

**In `supabase/functions/publish-to-forge/index.ts`**, inside the `create_and_architect` block (before `callGateway` with `architect`):

```typescript
// Before architect call:
if (project_id) {
  console.log("[publish-to-forge] Pre-cleanup: removing stale components");
  const cleanRes = await callGateway({
    action: "clean_project",
    project_id,
    user_id: userId,
  });
  console.log(`[publish-to-forge] clean_project status=${cleanRes.status}`);
  if (!cleanRes.ok) {
    console.warn("[publish-to-forge] clean_project failed, continuing:", await cleanRes.text());
  }
}
```

Additionally, add `force_new: true` to the architect payload to signal the gateway to skip deduplication:

```typescript
const payload = {
  action: "architect",
  ...existingFields,
  force_new: true,  // Skip deduplication — create fresh from PRD
};
```

### Enhanced logging

Add diagnostic logs after the gateway response to capture what was actually created:

```typescript
console.log("[publish-to-forge] architect result:", JSON.stringify(result).slice(0, 1000));
```

### Files modified

| File | Change |
|------|--------|
| `supabase/functions/publish-to-forge/index.ts` | Add pre-cleanup call + `force_new: true` + enhanced logging |

### Deployment
Redeploy `publish-to-forge` Edge Function after changes.

