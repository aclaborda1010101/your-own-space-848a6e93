
# Refactoring RAG Pipeline: Job Queue + Outbox Architecture

## Status: ✅ IMPLEMENTED

### What was built

1. **SQL Migration** (completed):
   - `rag_jobs` outbox table with RLS policies
   - `rag_sources` extended with `status`, `http_status`, `content_type`, `lang_detected`, `extraction_quality`, `word_count`, `content_hash`, `error`, `updated_at`
   - `rag_chunks` extended with `content_hash` (unique partial index), `lang`, `title`, `quality`
   - Unique index on `(rag_id, source_url)` to prevent duplicate sources
   - RPCs: `pick_next_job`, `mark_job_done`, `mark_job_retry`
   - Triggers: `set_updated_at` for both tables

2. **Edge Function: `rag-job-runner`** (deployed):
   - Stateless worker that picks 1-20 jobs per invocation
   - 6 stage handlers: FETCH → EXTRACT → CLEAN → CHUNK → SCORE → EMBED
   - SHA-256 hash dedup + semantic dedup (cosine > 0.92)
   - OpenAI text-embedding-3-small (1024 dims)
   - Exponential backoff retries, DLQ after 5 failures

3. **Edge Function: `rag-enqueue-sources`** (deployed):
   - Takes `rag_id`, creates FETCH jobs for all NEW sources

4. **Config**: Both functions added to `supabase/config.toml` with `verify_jwt = false`

### Execution flow

```text
1. rag-architect discovers sources → inserts into rag_sources
2. Call rag-enqueue-sources with rag_id → creates FETCH jobs
3. Call rag-job-runner (maxJobs: 20) to drain queue
4. Each source progresses: NEW → FETCHED → EXTRACTED → CLEANED → CHUNKED → SCORED → EMBEDDED
```
