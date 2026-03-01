
## Diagnosis: 7 blocking issues preventing shared users from seeing data

I've found the root causes across 3 layers: frontend queries, RLS policies, and edge functions.

### Layer 1: Frontend — Hardcoded `user_id` filters

These files explicitly filter by `user_id = user.id`, which blocks shared users even though RLS would allow them through:

| File | Line | Filter |
|------|------|--------|
| `src/pages/Projects.tsx` | 88 | `.eq("user_id", user.id)` in useQuery |
| `src/hooks/usePatternDetector.tsx` | 147 | `.eq("user_id", user.id)` in fetchRuns |

**Fix**: Remove these `.eq("user_id", ...)` filters. RLS already handles access control — adding client-side filters on top blocks shared records.

### Layer 2: RLS — Missing shared access on auxiliary tables

These tables still use `auth.uid() = user_id` without shared access:

| Table | Current policy | Needs |
|-------|---------------|-------|
| `project_wizard_steps` | `auth.uid() = user_id` | `user_owns_business_project(project_id)` — already updated to include sharing |
| `project_documents` | `auth.uid() = user_id` | Same — use `user_owns_business_project` |
| `project_costs` (SELECT) | `auth.uid() = user_id` | Include `has_shared_access_via_project` |
| `user_owns_rag_project` function | Only checks `user_id = auth.uid()` | Add `OR has_shared_access(auth.uid(), 'rag_project', p_rag_id)` |
| `signal_registry` | `auth.uid() = user_id` | Add shared access via run's project |
| `model_backtests` | `auth.uid() = user_id` | Same |
| `economic_backtests` | `auth.uid() = user_id` | Same |
| `signal_credibility_matrix` | `auth.uid() = user_id` | Same |
| `pattern_discovery_log` | `auth.uid() = user_id` | Same |
| `rag_jobs` (user SELECT) | Checks `rag_projects.user_id = auth.uid()` | Use updated `user_owns_rag_project` |

### Layer 3: Edge Functions — Ownership checks that ignore sharing

Both edge functions use the **service_role key** (bypasses RLS), so they manually check `.eq("user_id", userId)`:

**rag-architect** (~15 places): `handleList`, `handleStatus`, `handleQuery`, `handleExport`, `handleRebuild`, `handleConfirm`, `handleDelete`, and all `manage_api_keys` actions all query with `.eq("user_id", userId)`.

**Fix**: Update these to use `.or(\`user_id.eq.${userId},id.in.(select resource_id from resource_shares ...)\`)` — or simpler, create a helper function in the edge function that queries `resource_shares` to check access, then use `.eq("id", ragId)` without the `user_id` filter (since we've already verified access).

**pattern-detector-pipeline**: The `status` and `run_all` actions don't check ownership at all (they use service role). The `create` action takes `user_id` from the body. No changes needed here — the frontend filter was the blocker.

### Implementation plan

**Migration SQL**:
1. Update `user_owns_rag_project` to include `has_shared_access('rag_project')`
2. Update RLS on `project_wizard_steps`, `project_documents`, `project_costs` to use `user_owns_business_project(project_id)`
3. Add shared-access helper function `has_shared_access_for_run` for pattern detector auxiliary tables
4. Update RLS on `signal_registry`, `model_backtests`, `economic_backtests`, `signal_credibility_matrix`, `pattern_discovery_log` to include shared access
5. Update `rag_jobs` user SELECT policy to use updated `user_owns_rag_project`

**Frontend changes**:
1. `src/pages/Projects.tsx` line 88: Remove `.eq("user_id", user.id)`
2. `src/hooks/usePatternDetector.tsx` line 147: Remove `.eq("user_id", user.id)`

**Edge function changes** (rag-architect):
1. Add helper function `async function verifyRagAccess(ragId, userId)` that checks ownership OR shared access via `resource_shares` table
2. Replace all `.eq("user_id", userId)` in rag queries with the new helper
3. Update `handleList` to return both owned and shared RAGs (query `resource_shares` for shared ones and merge)
