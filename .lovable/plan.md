
## Plan: Fix batch 26 loop + advance remaining 7 subdomains

### Root cause

The pipeline is stuck in an infinite loop on **batch 26** (`Social-Emotional Learning (SEL)/frontier`). Each iteration:

1. Calls Semantic Scholar with 5 expanded queries
2. Hits 429 rate limits, waits 5s per retry, exhausts the 90s time budget
3. Saves the run as `partial` and self-kicks **the same batch index** (line 1530)
4. Repeat forever (already 4 `partial` + 1 `running` entries)

The self-kick re-entry creates a **new** `rag_research_runs` row each time, so the batch never counts as `completed` and never advances to batch 27.

### Architecture (11 subdomains x 7 levels = 77 batches)

```text
Batch 0-6:   Early Childhood Dev Psychology      ✅ completed
Batch 7-13:  Emotional Regulation                ✅ completed  
Batch 14-20: Child Psychopathology               ✅ completed
Batch 21-27: Social-Emotional Learning (SEL)     ✅ 21-25, ⛔ 26 (frontier STUCK)
Batch 28-34: Attachment Theory                   ❌ never started
Batch 35-41: Parenting Styles                    ❌ never started
Batch 42-48: Behavioral Analysis                 ❌ never started
Batch 49-55: Play Therapy                        ❌ never started
Batch 56-62: EdTech                              ❌ never started
Batch 63-69: AI in Education                     ❌ never started
Batch 70-76: Ethical AI for Minors               ❌ never started
```

### Fix: 2 changes

#### 1. Add max-retry limit for self-kick loops (code change)

**File**: `supabase/functions/rag-architect/index.ts`, lines 1525-1531

Currently when time budget exceeds 90s, it self-kicks the same batch indefinitely. Add a counter: if the same subdomain/level already has 3+ `partial` or `running` runs, mark as `completed` and advance to the next batch instead of looping.

```typescript
// Before self-kicking, check how many partial/running runs exist for this batch
const { count: partialCount } = await supabase
  .from("rag_research_runs")
  .select("*", { count: "exact", head: true })
  .eq("rag_id", ragId)
  .eq("subdomain", subdomainName)
  .eq("research_level", level)
  .in("status", ["partial", "running"]);

if ((partialCount || 0) >= 3) {
  // Too many retries, mark as completed and advance
  console.warn(`[Batch ${idx}] Max retries reached for ${subdomainName}/${level}, advancing`);
  await supabase.from("rag_research_runs")
    .update({ status: "completed", sources_found: sourceIds.length, completed_at: new Date().toISOString() })
    .eq("id", run?.id);
  // Fall through to trigger next batch (line 1642)
} else {
  // Normal self-kick retry
  await supabase.from("rag_research_runs")
    .update({ status: "partial", sources_found: sourceIds.length, completed_at: new Date().toISOString() })
    .eq("id", run?.id);
  EdgeRuntime.waitUntil(triggerBatch(ragId as string, idx));
  return { ragId, batchIndex: idx, status: "self_kicked_timeout" };
}
```

#### 2. Unstick current batch 26 (one-time DB operation)

Mark the current `running` and `partial` SEL/frontier runs as `completed`, then manually trigger batch 27 to resume the pipeline:

```sql
UPDATE rag_research_runs 
SET status = 'completed', completed_at = now()
WHERE rag_id = '8edd368f-31c2-4522-8b47-22a81f4a0000'
  AND subdomain = 'Social-Emotional Learning (SEL)' 
  AND research_level = 'frontier'
  AND status IN ('running', 'partial');
```

Then call `triggerBatch(ragId, 27)` via edge function to continue with SEL/lateral (batch 27), which will cascade through batches 28-76 automatically.

### Files to modify

| File | Change |
|------|--------|
| `supabase/functions/rag-architect/index.ts` | Add max-retry guard at line 1525-1531 |

### DB operations (one-time)

- Mark SEL/frontier runs as `completed`
- Trigger batch 27 via edge function call
