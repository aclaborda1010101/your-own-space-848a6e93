

## Plan: Gap 1 (Chunk Filter) + Gap 2 (Race Condition via Unique Index)

### Gap 1: Chunk-count filter in fan-out (rag-architect)

**File:** `supabase/functions/rag-architect/index.ts`, lines 1673-1681

**Current:** Enqueues `POST_BUILD_KG` for every subdomain without checking chunks.

**Change:** Before inserting each job, query `rag_chunks` for that subdomain. Skip if count is 0.

```text
// Replace lines 1675-1681 with:
let enqueuedCount = 0;
let skippedCount = 0;
for (const sub of subdomains) {
  const { count } = await supabase
    .from("rag_chunks")
    .select("*", { count: "exact", head: true })
    .eq("rag_id", ragId)
    .eq("subdomain", sub.name_technical);
  if ((count || 0) === 0) {
    console.log(`[PostBuild] Skipping subdomain ${sub.name_technical}: 0 chunks`);
    skippedCount++;
    continue;
  }
  await supabase.from("rag_jobs").insert({
    rag_id: ragId,
    job_type: "POST_BUILD_KG",
    payload: { subdomain: sub.name_technical },
  });
  enqueuedCount++;
}
console.log(`[PostBuild] KG fan-out: ${enqueuedCount} enqueued, ${skippedCount} skipped`);
```

### Gap 2: Race condition fix via Opcion A (Unique Partial Index)

**Approach:** Option A — partial unique index on `rag_jobs(rag_id, job_type)` for post-build step types. This is enforced at the DB level, making it impossible for two concurrent workers to insert duplicate cascade jobs.

**SQL Migration:**

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_post_build_job 
ON rag_jobs (rag_id, job_type) 
WHERE job_type IN ('POST_BUILD_TAXONOMY', 'POST_BUILD_CONTRA', 'POST_BUILD_QG');
```

**File:** `supabase/functions/rag-job-runner/index.ts`, lines 586-624

**Change:** Rewrite `maybeEnqueueNextPostBuildStep` to attempt the insert and catch/ignore the unique violation (code `23505`):

```text
async function maybeEnqueueNextPostBuildStep(job: Job, completedJobType: string) {
  let nextJobType: string | null = null;

  if (completedJobType === "POST_BUILD_KG") {
    // Check if any sibling KG jobs are still in-flight
    const { count } = await sb
      .from("rag_jobs")
      .select("*", { count: "exact", head: true })
      .eq("rag_id", job.rag_id)
      .eq("job_type", "POST_BUILD_KG")
      .in("status", ["PENDING", "RETRY", "RUNNING"]);
    if ((count || 0) > 0) {
      console.log(`[POST_BUILD_KG] ${count} KG jobs still pending for rag ${job.rag_id}`);
      return;
    }
    nextJobType = "POST_BUILD_TAXONOMY";
  } else if (completedJobType === "POST_BUILD_TAXONOMY") {
    nextJobType = "POST_BUILD_CONTRA";
  } else if (completedJobType === "POST_BUILD_CONTRA") {
    nextJobType = "POST_BUILD_QG";
  }

  if (!nextJobType) return;

  // Atomic insert — unique partial index prevents duplicates
  const { error } = await sb.from("rag_jobs").insert({
    rag_id: job.rag_id,
    job_type: nextJobType,
    payload: {},
  });

  if (error && error.code === "23505") {
    console.log(`[${completedJobType}] ${nextJobType} already enqueued for rag ${job.rag_id} (dedup by unique index)`);
  } else if (error) {
    console.error(`[${completedJobType}] Failed to enqueue ${nextJobType}:`, error);
    throw error;
  } else {
    console.log(`[${completedJobType}] Done → enqueued ${nextJobType} for rag ${job.rag_id}`);
  }
}
```

Key changes vs current implementation:
- Removed `.neq("id", job.id)` — job is already marked DONE before this runs (line 688), so it won't appear in PENDING/RETRY/RUNNING
- The unique index guarantees at most 1 `POST_BUILD_TAXONOMY` / `POST_BUILD_CONTRA` / `POST_BUILD_QG` per `rag_id`
- If two workers race past the count check simultaneously, the second insert silently fails with `23505`
- For TAXONOMY→CONTRA and CONTRA→QG, no count check needed — the unique index alone prevents duplicates

### Files to modify

1. **SQL Migration** — `CREATE UNIQUE INDEX idx_single_post_build_job`
2. **`supabase/functions/rag-architect/index.ts`** — chunk-count filter in fan-out loop (lines 1675-1681)
3. **`supabase/functions/rag-job-runner/index.ts`** — rewrite `maybeEnqueueNextPostBuildStep` (lines 586-624)

### Deployment order

1. Apply SQL migration (index must exist before new code runs)
2. Deploy both edge functions
3. Verify deployment

