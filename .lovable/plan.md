

## Plan: Recovery Edge Function + config.toml update

### Verified Current State

| RAG | Status | Pending Jobs | Detail |
|-----|--------|-------------|--------|
| Farmacias `8a3b722d` | `completed` | 134 EXTRACT + 1 EXTERNAL_SCRAPE + 8 FETCH RETRY = 143 | 135 sources stuck in FETCHED |
| Psicología `bcb87cf0` | `completed` | 0 | 72 chunks ready, 0 KG nodes |

### Changes

#### 1. `supabase/config.toml` — add recovery function config
Add `[functions.rag-recovery] verify_jwt = false` entry.

#### 2. `supabase/functions/rag-recovery/index.ts` — new file

Single-use edge function with service role client:

**Step A — Farmacias (`8a3b722d-5def-4dc9-98f8-421f56843d63`):**
1. `UPDATE rag_projects SET status = 'ingesting', updated_at = now() WHERE id = '8a3b722d...'`
2. `UPDATE rag_jobs SET status = 'PENDING', locked_by = NULL, locked_at = NULL, run_after = now() WHERE rag_id = '8a3b722d...' AND status IN ('PENDING', 'RETRY')` — unlocks the 143 stale jobs
3. Fire-and-forget `POST rag-job-runner` with `{ rag_id: "8a3b722d...", maxJobs: 20 }`

**Step B — Psicología (`bcb87cf0-c4d5-47f4-8b8c-51f0e95a01c0`):**
1. `UPDATE rag_projects SET status = 'post_processing', quality_verdict = NULL, updated_at = now() WHERE id = 'bcb87cf0...'`
2. Fire-and-forget `POST rag-architect` with `{ action: "post-build", ragId: "bcb87cf0...", step: "knowledge_graph" }` using service role Bearer token

**Returns:** JSON summary with rows affected per operation.

#### 3. Deploy + invoke immediately
After creating the files, deploy `rag-recovery` and invoke it via `curl_edge_functions` to execute the recovery.

#### 4. Post-recovery cleanup
Once both RAGs complete, delete the function and remove the config entry.

### Technical Notes
- The 107 existing chunks in Farmacias are untouched (jobs only target FETCHED sources).
- The 72 chunks in Psicología are untouched; `handlePostBuild` reads them to build KG.
- `handlePostBuild` requires `{ ragId, step }` and service role auth (confirmed in lines 3378-3391).
- The self-kick in `rag-job-runner` will auto-drain remaining jobs after the initial 20.

