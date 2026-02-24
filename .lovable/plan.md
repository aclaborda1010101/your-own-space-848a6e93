

# Diagnosis: The external-worker actions already exist

## Finding

The three actions (`external-worker-poll`, `external-worker-complete`, `external-worker-fail`) are **already implemented** in `supabase/functions/rag-architect/index.ts` (lines 3307-3345). They were added as part of the CAMBIO B3 implementation.

The code flow is:
1. Line 3307: actions are listed in the service-role guard
2. Lines 3323-3332: `external-worker-poll` calls `pick_external_job` RPC and returns job + source URL
3. Lines 3333-3339: `external-worker-complete` calls `complete_external_job` RPC
4. Lines 3340-3345: `external-worker-fail` calls `mark_job_retry` RPC

## Root cause of 401

The edge function auth check (line 3310) compares the Bearer token against `SUPABASE_SERVICE_ROLE_KEY`. The worker on Railway must send:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...SERVICE_ROLE_KEY_HERE
```

The 401s in logs show requests every ~15s (worker polling), all returning 401 with ~100ms execution time. This confirms the requests reach the function code but fail auth.

## What to fix (on Railway, not in Lovable)

Check the `SUPABASE_SERVICE_KEY` environment variable in Railway. The worker.py likely uses this to set the `Authorization` header. Make sure:

1. The variable name matches what worker.py reads (probably `SUPABASE_SERVICE_KEY` or `SUPABASE_SERVICE_ROLE_KEY`)
2. The value is the **service role key** (starts with `eyJhbG...`, role `service_role`), NOT the anon key
3. The header format is `Authorization: Bearer <key>` (with the `Bearer ` prefix)

## No code changes needed in Lovable

The implementation is complete. This is a Railway environment variable configuration issue.

