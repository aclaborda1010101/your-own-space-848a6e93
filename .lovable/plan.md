

## Plan: Drop Edge Type CHECK Constraint + Add Error Logging + Re-trigger Both RAGs

### Step 1: SQL Migration — Drop CHECK constraint

Create a migration to remove `rag_knowledge_graph_edges_edge_type_check`:

```sql
ALTER TABLE rag_knowledge_graph_edges 
  DROP CONSTRAINT IF EXISTS rag_knowledge_graph_edges_edge_type_check;
```

This allows the LLM to produce semantically rich edge types (e.g., `"regula"`, `"interactúa_con"`, `"metaboliza"`) instead of being limited to 6 hardcoded values.

### Step 2: Fix silent error suppression in `rag-architect/index.ts`

**File:** `supabase/functions/rag-architect/index.ts`, line 2093

Replace:
```typescript
    }).then(() => {}).catch(() => {});
```

With:
```typescript
    }).then(() => {}).catch((err) => {
      console.error(`[KG Edge Insert Error] Failed edge ${srcLabel} -> ${tgtLabel}:`, err);
    });
```

### Step 3: Data cleanup (both RAGs)

Execute via insert tool:
```sql
DELETE FROM rag_jobs 
WHERE rag_id IN ('8a3b722d-5def-4dc9-98f8-421f56843d63', 'bcb87cf0-c4d5-47f4-8b8c-51f0e95a01c0') 
  AND job_type LIKE 'POST_BUILD_%';

UPDATE rag_projects 
SET status = 'building', quality_verdict = NULL 
WHERE id IN ('8a3b722d-5def-4dc9-98f8-421f56843d63', 'bcb87cf0-c4d5-47f4-8b8c-51f0e95a01c0');
```

### Step 4: Update `rag-recovery` to trigger both RAGs

Rewrite `rag-recovery/index.ts` to POST `{ action: "post-build", ragId, step: "knowledge_graph" }` for both Farmacias and Psicología sequentially, then deploy and invoke.

### Step 5: Verify

- Query `rag_jobs` for `POST_BUILD_KG` counts per RAG
- Confirm runner is active
- After completion, check `rag_knowledge_graph_edges` counts for both RAGs

### Deployment order

1. Apply SQL migration (constraint must be dropped before edge inserts run)
2. Deploy `rag-architect` with error logging fix
3. Execute data cleanup
4. Deploy + invoke `rag-recovery` to trigger both RAGs

