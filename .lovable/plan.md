

# Fix: `resume-build` missing from service-role gate

## Problem

The edge function logs confirm the issue clearly:

```
Job 674d29a3 failed: resume-build failed: 401 {"error":"Unauthorized"}
```

Line 2815 of `rag-architect/index.ts` has the service-role gate:

```typescript
if (action === "build-batch" || action === "post-build" || action === "execute-domain-analysis")
```

`"resume-build"` is **not listed** in this condition, so the request falls through to the JWT authentication path, which fails because the job runner uses the service-role key. The handler code for `resume-build` exists at line 2829 inside the block, but the gate never lets it in.

## Fix

One-line change on line 2815:

```typescript
if (action === "build-batch" || action === "post-build" || action === "execute-domain-analysis" || action === "resume-build")
```

## File affected

| File | Change |
|------|--------|
| `supabase/functions/rag-architect/index.ts` | Add `"resume-build"` to the service-role gate condition (line 2815) |

## After deploy

The stuck RESUME_BUILD job (`674d29a3`) will be retried automatically by the job runner on its next cycle.

