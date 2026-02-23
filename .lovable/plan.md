

# RAG Constructor TOTAL -- P0/P1 Implementation

## Current State Analysis

The system has ~85% infrastructure in place. Here is what EXISTS vs what MUST be built:

| Component | Exists | Gap |
|-----------|--------|-----|
| Pipeline (FETCH-EMBED) | Yes (rag-job-runner) | No changes needed |
| RRF hybrid search | Yes (search_rag_hybrid RPC) | Missing: source_tier, evidence_level, authority_score in JOIN |
| Reranking (Gemini) | Yes (rerankChunks) | Missing: MMR diversity pass, source cap |
| Query Rewriting | NO | Must build (3 parallel sub-queries) |
| Source Authority Boosts | NO | rag_sources missing authority_score, evidence_level, peer_reviewed |
| Evidence Mapper + A+B Prompt | NO | Prompt is generic, no claim-to-chunk tracing |
| Evidence loop correction | NO | No hallucination detection/retry |
| Answerability Gate | Partial (empty results) | Missing: low-relevance global check |
| mark_job_retry jitter | NO | Backoff in minutes, no random factor |
| rag_jobs_history + purge | NO | Tables/RPC missing |
| rag_domain_intelligence | NO | Table missing |
| Latency logging | Partial | latency_ms column exists but never populated; chunks_retrieved, reranked_count missing |
| Ingestion Console UI | NO | No visibility into rag_jobs/rag_sources from frontend |
| Evidence Inspector UI | NO | RagChat shows basic sources, no RRF scores, tier badges, claim map |
| MMR (diversity) | NO | No redundancy penalty |
| RLS on all rag tables | Yes | Already in place via user_owns_rag_project |

## Implementation Plan (6 Phases)

### Phase 1 -- SQL Migration

**New tables:**
- `rag_domain_intelligence` (user_input, interpreted_intent, subdomains, source_categories, critical_variables, validation_queries, known_debates, recommended_config, user_confirmed). FK to rag_projects ON DELETE CASCADE. RLS via user_owns_rag_project.
- `rag_jobs_history` (same structure as rag_jobs). RLS: service_role only (used via RPC).

**Alter rag_sources -- add 4 columns:**
- `authority_score NUMERIC(5,2) DEFAULT 0.00`
- `evidence_level TEXT` (meta_analysis, rct, cohort, case_study, opinion, guideline)
- `institution TEXT`
- `peer_reviewed BOOLEAN DEFAULT FALSE`

**Alter rag_query_log -- add 2 columns:**
- `chunks_retrieved INT`
- `reranked_count INT`

**New/Updated RPCs:**

1. `purge_completed_jobs(target_rag_id UUID)` -- moves DONE jobs to rag_jobs_history, returns count.

2. `mark_job_retry` -- REPLACE with jitter backoff:
```text
backoff := make_interval(
  secs => LEAST(3600, 15 * (1 << LEAST(a, 8)) + floor(random() * 10))
);
```

3. `search_rag_hybrid` -- UPDATE to JOIN source authority fields (zero N+1):
```text
Returns: id, content, subdomain, source_name, source_url,
         source_tier, evidence_level, authority_score,
         metadata, quality, similarity, keyword_rank, rrf_score
```
The current RPC already JOINs rag_sources but only returns source_name and source_url. The updated version adds tier, evidence_level, authority_score, and the chunk's quality JSONB.

**New indices:**
- `idx_rag_sources_tier ON rag_sources(rag_id, tier)`
- `idx_rag_query_log_rag ON rag_query_log(rag_id, created_at DESC)`

### Phase 2 -- Edge Function: Query Pipeline Elite

Modify `handleQuery` in rag-architect (lines 2009-2138) with 5 upgrades:

**2A. Query Rewriting (parallel sub-queries)**
Before embedding, call Gemini Flash to generate 2-3 technical sub-queries from the user's question. Strict guardrail prompt: "Use ONLY synonyms and technical terms strictly related to the original query. Do NOT add new concepts."

Run all sub-queries + original in parallel via Promise.all (each gets its own embedding + search_rag_hybrid call). Merge results by chunk_id (dedup), keeping highest rrf_score per chunk.

**2B. Source Authority Boosts (post-RRF)**
For each candidate chunk returned by hybrid search (already includes tier, evidence_level, authority_score from the updated RPC):
- tier = 'tier1_gold': +0.15
- tier = 'tier2_silver': +0.05
- evidence_level IN ('meta_analysis', 'rct'): +0.10
- peer_reviewed = true: +0.05
- quality.score >= 85: +0.05

Re-sort by boosted score.

**2C. MMR (Maximal Marginal Relevance)**
On the top 15 boosted candidates, apply MMR with lambda = 0.7:
- For each candidate, compute max cosine similarity to already-selected chunks (using embeddings from the RPC result via a second small query or by requesting embeddings in the RPC)
- Since embeddings are large, we compute MMR in a simplified way: use the `similarity` field already returned and penalize chunks from the same source_id
- Source Cap: max 2 chunks per source_id in the final selection
- Select 6-8 diverse chunks

**2D. Prompt A+B Elite + Evidence Mapper**
Replace current generic prompt with structured A+B format:

```text
FORMATO DE SALIDA OBLIGATORIO:

## QUE DICE LA EVIDENCIA
[Claims verificados. Cada claim DEBE citar (Fuente: nombre, URL) y referenciar [Chunk X]]

## QUE HACER
[Pasos concretos y ejecutables basados en la evidencia]

## QUE NO HACER
[Errores comunes a evitar]

## SENALES DE ALERTA
[Cuando consultar un profesional]

## FUENTES
[Lista numerada de fuentes con URLs]
```

Rules A (correctness): Only from documents, cite sources, present debates.
Rules B (action): Concrete steps, real examples, alert signals.

**2E. Evidence Loop Correction**
After generating the answer, parse it for chunk references ([Chunk X]). Verify each referenced chunk actually exists in the provided context. If a claim references a non-existent chunk or has no backing, regenerate with a corrective prompt that strips the unsupported claim. Max 1 retry.

**2F. Answerability Gate**
Before generating the answer, check if the average similarity of top chunks is below 0.45. If so, return "No tengo evidencia suficiente para esta consulta" immediately.

**2G. Latency Logging**
Wrap the entire query pipeline in `Date.now()` timing. Store `latency_ms`, `chunks_retrieved`, and `reranked_count` in rag_query_log.

### Phase 3 -- Edge Function: Domain Intelligence Persistence

When `analyzeDomain` runs, also insert/upsert the structured result into `rag_domain_intelligence` (in addition to domain_map in rag_projects for backward compatibility).

### Phase 4 -- UI: Ingestion Console

New component `src/components/rag/RagIngestionConsole.tsx` integrated as a new tab "Ingestion" in RagBuildProgress:

- Table of rag_sources: URL (truncated), status badge, tier badge (Gold/Silver/Bronze), word_count, authority_score
- Summary counters for rag_jobs by status: PENDING, RUNNING, DONE, FAILED, DLQ
- "Retry DLQ" button: resets DLQ jobs to PENDING
- "Purge DONE" button: calls purge_completed_jobs RPC
- Auto-refresh every 5s when jobs are active

New hook methods in `useRagArchitect`:
- `fetchSources(ragId)`: direct Supabase query on rag_sources
- `fetchJobStats(ragId)`: count jobs grouped by status
- `retryDlqJobs(ragId)`: update DLQ jobs to PENDING via edge function
- `purgeJobs(ragId)`: call purge_completed_jobs RPC via edge function

### Phase 5 -- UI: Evidence Inspector in RagChat

Update `RagChat.tsx` to display enriched response data:

- Update `ChatMessage` interface to include: `evidence_chunks` (with rrf_score, similarity, source_tier, authority_score, chunk_id), `claim_map` (claim text -> chunk_id)
- Each assistant message gets a collapsible "Inspector de Evidencia" panel showing:
  - Chunks used with RRF scores and similarity percentages
  - Source tier badge (Gold = green, Silver = blue, Bronze = gray)
  - Authority score bar
  - Claim Map section: which claim came from which chunk
- Update `onQuery` return type to include the extended data from the backend

### Phase 6 -- Deploy and Verify

Deploy updated rag-architect edge function and verify end-to-end.

## Files Affected

| File | Change |
|------|--------|
| New SQL migration | rag_domain_intelligence, rag_jobs_history, source columns, query_log columns, updated RPCs (jitter, hybrid with authority), purge RPC, indices |
| `supabase/functions/rag-architect/index.ts` | handleQuery rewrite (query rewriting, boosts, MMR, A+B prompt, evidence loop, answerability gate, latency), analyzeDomain persistence |
| `src/components/rag/RagIngestionConsole.tsx` | NEW: sources table + jobs status dashboard |
| `src/components/rag/RagBuildProgress.tsx` | Add "Ingestion" tab |
| `src/components/rag/RagChat.tsx` | Evidence Inspector panel, enriched message types |
| `src/hooks/useRagArchitect.tsx` | New methods: fetchSources, fetchJobStats, retryDlqJobs, purgeJobs |

## Execution Sequence

1. SQL migration (all tables, columns, RPCs, indices)
2. Edge function: Query pipeline (rewriting + boosts + MMR + A+B + evidence loop + answerability + latency)
3. Edge function: Domain Intelligence persistence
4. Frontend: RagIngestionConsole
5. Frontend: Evidence Inspector in RagChat
6. Deploy edge function + test

## Technical Considerations

- Query Rewriting adds ~2-3s but runs in parallel (3 embeddings + 3 searches via Promise.all)
- MMR is computed in-memory on the top 15 candidates, not a DB operation -- negligible cost
- Evidence Loop retry adds ~5s worst case (only triggers if hallucination detected, max 1 retry)
- Jitter in mark_job_retry prevents thundering herd when multiple workers restart simultaneously
- The updated search_rag_hybrid eliminates N+1 queries by returning all source metadata in a single JOIN
- Source Cap (max 2 per source_id) ensures diverse evidence even without full MMR embedding comparison

