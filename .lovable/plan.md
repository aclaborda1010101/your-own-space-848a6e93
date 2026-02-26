

## Plan: Fix `newTotalChunks` bug + Re-rebuild Alarmas

### Step 1: Fix the undefined variable bug

In `supabase/functions/rag-architect/index.ts` line 1671, replace `newTotalChunks` with `dbTotalChunks || 0` (which is already defined at line 1643-1646).

```typescript
// Line 1671: change
console.log(`[RAG ${ragId}] BUILD COMPLETED: ${newTotalChunks} chunks...`);
// to
console.log(`[RAG ${ragId}] BUILD COMPLETED: ${dbTotalChunks || 0} chunks...`);
```

### Step 2: Deploy edge function

Deploy `rag-architect` with the fix.

### Step 3: User re-triggers Alarmas rebuild

After deploy, the user clicks "Regenerar" again on the Alarmas RAG from the UI. This time the full pipeline will complete without the `newTotalChunks` error on the last batch.

### Technical detail

The variable `newTotalChunks` was likely left over from a refactor. The correct variable `dbTotalChunks` is already computed at lines 1643-1646 in the same function scope. The fix is a single line change.

