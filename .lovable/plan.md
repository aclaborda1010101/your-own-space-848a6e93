

# SQL Migration: Fix Index, Upgrade search_rag_hybrid V2, Add rag_job_stats

## Problem Analysis

The user's SQL has 3 column name mismatches with the actual database schema that must be corrected before applying:

| User's SQL references | Actual column in rag_sources | Fix needed |
|---|---|---|
| `rs.source_tier` | `tier` | Use `rs.tier AS source_tier` |
| `rs.url` | `source_url` | Use `rs.source_url` |
| `rs.authority_score` | Does not exist | Add column first |
| `rs.evidence_level` | Does not exist | Add column first |

Additionally, the current `search_rag_hybrid` RPC has parameter order `(query_embedding, query_text, ...)` and the edge function calls it with named params. The user's SQL flips the order to `(query_text, query_embedding, ...)`. Since edge function code uses named parameters (`query_embedding: ..., query_text: ...`), this is safe -- named params work regardless of declaration order.

## What will be done (single SQL migration)

### 1. Add missing columns to rag_sources
- `authority_score NUMERIC(5,2) DEFAULT 0.00`
- `evidence_level TEXT`
- `peer_reviewed BOOLEAN DEFAULT FALSE`

### 2. Create index
- `idx_rag_sources_source_tier ON rag_sources(rag_id, source_tier)` -- corrected to use actual column name `tier` since `source_tier` doesn't exist as a column: `idx_rag_sources_tier ON rag_sources(rag_id, tier)`

### 3. Replace search_rag_hybrid RPC
Drop and recreate with the user's V2 logic, but with column name fixes:
- `rs.url` changed to `rs.source_url`
- `rs.source_tier` changed to `rs.tier AS source_tier`
- Returns: id, content, source_name, source_url, source_tier, evidence_level, authority_score, quality, similarity, embedding, rrf_score

Key upgrade: This V2 returns the actual embedding vectors so the Edge Function can compute real MMR (cosine distance between candidate embeddings) instead of heuristic approximation.

### 4. Create rag_job_stats RPC
New function to aggregate job counts by status for a given rag_id -- eliminates multiple frontend queries.

### 5. No edge function changes needed
The edge function already calls `search_rag_hybrid` with named parameters, so the parameter order change is transparent. The new return fields (`embedding`, `similarity`, `source_tier`, `evidence_level`, `authority_score`) will be available for the existing MMR and boost logic.

## Files affected

| File | Change |
|------|--------|
| New SQL migration | Add columns, index, replace RPC, add rag_job_stats |
| `src/integrations/supabase/types.ts` | Auto-updated by migration |

No edge function or frontend changes are needed for this migration -- the existing code already handles these fields via the named-param RPC calls.
