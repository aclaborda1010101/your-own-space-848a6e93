

## Plan: Fix Schema Mismatch in Knowledge Graph + Re-trigger Farmacias

### Step 1: SQL Migration — Add missing columns

Create migration file to add `description` (text) and `source_count` (integer, default 1) to `rag_knowledge_graph_nodes`:

```sql
ALTER TABLE rag_knowledge_graph_nodes 
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS source_count integer DEFAULT 1;
```

This aligns the table with what `buildKGForSubdomain` (lines 2062-2068) and the `search_graph_nodes` RPC expect.

### Step 2: Fix edge column names in rag-architect

**File:** `supabase/functions/rag-architect/index.ts`, lines 2087-2093

Replace:
```typescript
source_node_id: srcId,
target_node_id: tgtId,
relation: (edge.relation as string) || "related_to",
```

With:
```typescript
source_node: srcId,
target_node: tgtId,
edge_type: (edge.relation as string) || "related_to",
```

No other code changes needed — node inserts (lines 2062-2068) will work once the migration adds `description` and `source_count`. The `increment_node_source_count` RPC already references the correct column name and will work once it exists.

### Step 3: Clean up old jobs + re-trigger Farmacias

Execute data operations:
1. `DELETE FROM rag_jobs WHERE rag_id = '8a3b722d-...' AND job_type LIKE 'POST_BUILD_%'` — removes old DONE jobs that would block the unique index
2. `UPDATE rag_projects SET status = 'building', quality_verdict = NULL WHERE id = '8a3b722d-...'`
3. POST to `rag-architect` with `{ action: "post-build", ragId: "8a3b722d-...", step: "knowledge_graph" }`

### Step 4: Verify

- Check `rag-architect` logs for enqueued POST_BUILD_KG counts
- Query `rag_jobs` to confirm jobs are RUNNING
- Watch for successful KG node inserts (no more `column does not exist` errors)

### Deployment order

1. Apply SQL migration (columns must exist before code runs)
2. Deploy `rag-architect` with edge column fix
3. Execute data cleanup + re-trigger

