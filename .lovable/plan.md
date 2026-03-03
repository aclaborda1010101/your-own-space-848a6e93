

## Plan: Fix RAG stuck in post_processing loop

### Root cause
The auto-heal resets RUNNING jobs to RETRY (attempt stays at 0), but `mark_job_retry` (which increments attempt and sends to DLQ after 5) is only called by the job runner on actual errors. When a job silently times out (edge function CPU limit), it never hits `mark_job_retry` — the auto-heal just resets it with attempt=0 forever.

### Fix 1: Auto-heal should increment attempt counter (`rag-architect/index.ts`)
In the `handleStatus` auto-heal block, when resetting a stuck RUNNING job:
- Increment `attempt` by 1
- If `attempt >= 4`, send to DLQ instead of RETRY
- This breaks the infinite loop

```typescript
// Instead of just resetting to RETRY:
const newAttempt = (sj.attempt || 0) + 1;
const newStatus = newAttempt >= 4 ? 'DLQ' : 'RETRY';
await supabase.from("rag_jobs").update({ 
  status: newStatus, locked_by: null, locked_at: null, attempt: newAttempt 
}).eq("id", sj.id);
```

### Fix 2: Auto-completion should treat DLQ jobs as terminal
The auto-completion query currently only checks for `PENDING/RUNNING/RETRY`. DLQ jobs are already excluded — this is correct. But the query needs to work after Fix 1 sends stuck jobs to DLQ.

Currently works correctly — no change needed here.

### Fix 3: Orphan FETCH jobs cleanup in auto-heal
Add a cleanup step in `handleStatus` for `post_processing` RAGs: move orphan FETCH jobs (status=RETRY, no source_id, attempt >= 3) to DLQ.

### Fix 4: Immediate data cleanup (one-time SQL)
Run SQL to unblock the current RAG:
- Send the 94 orphan FETCH jobs to DLQ
- Send the 3 stuck KG + 1 CONTRA jobs to DLQ (they've been cycling for hours)
- Enqueue POST_BUILD_QG
- Kick the job runner

### Files to modify
1. `supabase/functions/rag-architect/index.ts` — auto-heal increments attempt, sends to DLQ after 4 resets; orphan cleanup
2. SQL migration — one-time cleanup for the current stuck RAG

