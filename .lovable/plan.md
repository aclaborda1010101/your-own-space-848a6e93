
# Refactoring RAG Pipeline: Job Queue + Outbox Architecture

## What changes

The current RAG build pipeline is a single 2500-line edge function (`rag-architect`) that chains batches via self-invocation. The new architecture splits the heavy processing into a separate **job runner** edge function driven by a `rag_jobs` outbox table. Each processing stage (FETCH, EXTRACT, CLEAN, CHUNK, SCORE, EMBED) becomes an independent, idempotent job.

## Why this matters

- **Reliability**: Each stage retries independently with exponential backoff. A failed scrape doesn't kill the whole batch.
- **Observability**: Every job has status, attempt count, error log. You can see exactly where things stall.
- **Deduplication**: Content hash (`sha256`) unique index on `rag_chunks` prevents duplicates at DB level, plus semantic dedup via existing `check_chunk_duplicate`.
- **Source tracking**: `rag_sources` gets proper status tracking (NEW -> FETCHED -> EXTRACTED -> CLEANED -> CHUNKED -> SCORED -> EMBEDDED).

## Database changes (SQL migration)

### 1. New table: `rag_jobs` (outbox)

```text
rag_jobs (
  id uuid PK,
  rag_id uuid NOT NULL,
  job_type text NOT NULL,  -- FETCH|EXTRACT|CLEAN|CHUNK|SCORE|EMBED
  source_id uuid,
  payload jsonb DEFAULT '{}',
  status text DEFAULT 'PENDING',  -- PENDING|RUNNING|RETRY|DONE|FAILED|DLQ
  attempt int DEFAULT 0,
  run_after timestamptz DEFAULT now(),
  locked_by text,
  locked_at timestamptz,
  error jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

Indexes: `(status, run_after, created_at)` for job picking, `(rag_id)`, `(source_id)`.

### 2. Alter `rag_sources`

Add columns the current table is missing:
- `status text DEFAULT 'NEW'` (NEW|FETCHED|EXTRACTED|CLEANED|CHUNKED|SCORED|EMBEDDED|SKIPPED|FAILED)
- `url text` (alias for source_url, or just use source_url)
- `http_status int`
- `content_type text`
- `lang_detected text`
- `extraction_quality text`
- `word_count int`
- `content_hash text`
- `error jsonb`
- `updated_at timestamptz DEFAULT now()`

Plus unique index on `(rag_id, source_url)` to prevent duplicate source URLs.

### 3. Alter `rag_chunks`

Add column:
- `content_hash text NOT NULL` with unique index on `(rag_id, content_hash)` for fast hash-based dedup
- `lang text DEFAULT 'es'`
- `title text`
- `quality jsonb DEFAULT '{}'`

### 4. New SQL RPCs

- **`pick_next_job(worker_id text)`**: Atomically picks and locks next available job using `FOR UPDATE SKIP LOCKED`
- **`mark_job_done(job_id uuid)`**: Marks job as DONE
- **`mark_job_retry(job_id uuid, err jsonb)`**: Increments attempt, applies exponential backoff, moves to DLQ after 5 failures

## New edge function: `rag-job-runner`

A stateless worker that:
1. Calls `pick_next_job(worker_id)` to grab one job
2. Dispatches to the appropriate handler (FETCH, EXTRACT, CLEAN, CHUNK, SCORE, EMBED)
3. Marks done or retry
4. Returns result

### Stage handlers

| Stage | Input | Action | Output |
|-------|-------|--------|--------|
| FETCH | source_id | HTTP fetch URL, store raw content, update source status | Enqueues EXTRACT job |
| EXTRACT | source_id | Strip HTML (scripts/styles/tags), extract main text | Enqueues CLEAN job (or SKIPPED if < 250 words) |
| CLEAN | source_id + mainText in payload | Apply `cleanScrapedContent` regex cleanup | Enqueues CHUNK job (or SKIPPED if < 250 words) |
| CHUNK | source_id + cleaned text | Split into 150-400 word chunks by paragraph boundaries | Enqueues SCORE job |
| SCORE | source_id + chunks | Score each chunk (length, noise ratio) -> KEEP/REPAIR/DROP | Enqueues EMBED job with only KEEP+REPAIR chunks |
| EMBED | source_id + scored chunks | Generate embeddings, hash dedup + semantic dedup, insert to rag_chunks | Done |

### Key design decisions

- Uses existing `generateEmbedding` (OpenAI text-embedding-3-small, 1024 dims)
- Uses existing `cleanScrapedContent` logic (ported from rag-architect)
- SHA-256 content hash for fast dedup before expensive semantic dedup
- No LLM calls in the pipeline stages (cheap chunking by paragraphs). LLM-based chunking remains in rag-architect for the initial build flow.
- Worker processes ONE job per invocation for simplicity

## New edge function: `rag-enqueue-sources`

Takes a `rag_id`, finds all `rag_sources` with status='NEW', creates FETCH jobs for each.

## Integration with existing `rag-architect`

The existing `rag-architect` function keeps its current flow (domain analysis, confirm, query, export, etc.). The new job runner is an **additional** processing path:

1. After `rag-architect` builds sources during `handleBuildBatch`, it can optionally also insert them into `rag_jobs` for reprocessing
2. Or the user can call `rag-enqueue-sources` manually to reprocess sources through the quality pipeline
3. Both paths coexist -- the monolithic build keeps working, the job runner adds a second pass for quality

## Config changes

Add to `supabase/config.toml`:
```text
[functions.rag-job-runner]
verify_jwt = false

[functions.rag-enqueue-sources]
verify_jwt = false
```

## Files affected

| File | Change |
|------|--------|
| New SQL migration | rag_jobs table, rag_sources columns, rag_chunks columns, 3 RPCs |
| `supabase/functions/rag-job-runner/index.ts` | New: job runner worker |
| `supabase/functions/rag-enqueue-sources/index.ts` | New: source enqueue function |
| `supabase/config.toml` | Add 2 new function configs |
| `src/integrations/supabase/types.ts` | Auto-updated by migration |

## Execution flow

```text
1. User creates RAG (existing flow via rag-architect)
2. rag-architect discovers sources and inserts into rag_sources
3. Call rag-enqueue-sources with rag_id
4. rag-enqueue-sources creates FETCH jobs for all NEW sources
5. Call rag-job-runner N times (or via cron) to drain the queue
6. Each call picks one job, processes it, enqueues the next stage
7. Sources progress: NEW -> FETCHED -> EXTRACTED -> CLEANED -> CHUNKED -> SCORED -> EMBEDDED
```
