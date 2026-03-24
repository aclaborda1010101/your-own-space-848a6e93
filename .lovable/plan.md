

## Plan: Fix PRD Generation "Unauthorized" Error

### Problem
The chained PRD pipeline (`generate_prd_chained`) makes a recursive HTTP call to itself to trigger `generate_prd` (line 1324). It forwards the original user's `Authorization` header. By Phase 3, approximately 4 minutes have elapsed (scope + audit + pattern detection), and the user's JWT token can become stale or the edge function context changes. The recursive call returns `{"error":"Unauthorized"}`, killing the entire pipeline.

### Root Cause
Line 1327: `Authorization: authHeader || \`Bearer ${SUPABASE_SERVICE_ROLE_KEY}\``

The `authHeader` is still set (it's the original user token), so the fallback to service role key never triggers. But after ~4 minutes, the token may no longer be valid for a new edge function invocation.

### Fix
**File: `supabase/functions/project-wizard-step/index.ts`** (line 1327)

Change the recursive self-call to always use the service role key, since this is a trusted server-to-server call within the same function. The user has already been authenticated at the start of the request.

```
Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
```

This is a 1-line change. The user identity is already validated at the top of the handler (line 497-501) and the `user.id` is passed via `stepData`, so using the service role key for the recursive call is safe and correct.

### Implementation
- Edit line 1327 in `supabase/functions/project-wizard-step/index.ts`
- Replace `authHeader || \`Bearer ${SUPABASE_SERVICE_ROLE_KEY}\`` with `\`Bearer ${SUPABASE_SERVICE_ROLE_KEY}\``
- Deploy edge function

