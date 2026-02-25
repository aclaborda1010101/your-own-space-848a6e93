

## Plan: Recovery of Orphaned RAGs via Updated rag-recovery

### Current State (verified via DB queries)

| RAG | Status | quality_verdict | POST_BUILD jobs |
|-----|--------|----------------|-----------------|
| Farmacias (`8a3b722d`) | `building` | NULL | 0 |
| Psicología (`bcb87cf0`) | `completed` | `PRODUCTION_READY` (false positive) | 0 |

### What needs to happen

1. **Psicología status reset**: Must be forced back to `building` with `quality_verdict = NULL` (Farmacias is already `building`)
2. **Trigger post-build fan-out for BOTH RAGs**: Call `rag-architect` with `{ action: "post-build", ragId, step: "knowledge_graph" }` using service role key
3. **Collect telemetry**: Check logs and `rag_jobs` table for enqueued `POST_BUILD_KG` jobs

### File to modify

**`supabase/functions/rag-recovery/index.ts`** — Rewrite to:

1. Force both RAGs to `building` status with `quality_verdict = NULL`
2. Call `rag-architect` post-build synchronously (await response) for both RAGs sequentially
3. Return the response bodies so we can see the fan-out counts

The key change vs the current version: the old recovery only triggered post-build for Psicología and kicked `rag-job-runner` directly for Farmacias. The new version triggers `rag-architect` post-build (which does the fan-out + kicks the runner) for BOTH.

### After deployment

1. Deploy `rag-recovery`
2. Invoke it via curl
3. Read `rag-architect` logs to count enqueued/skipped subdomain jobs
4. Query `rag_jobs` for POST_BUILD_KG counts
5. Verify `rag-job-runner` is consuming the queue

