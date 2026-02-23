

# Optimization: Contact Indices + RAG Domain Intelligence Table

## 1. Contact Performance Indices

Current state: `people_contacts` has ONLY `pkey` + `user_id` index. Every filter by `category` or `is_favorite` triggers a sequential scan across the entire table.

### What will be created:

| Index | Type | Purpose |
|-------|------|---------|
| `idx_people_contacts_category` | B-tree on `(user_id, category)` | Fast filtering by category per user (composite is better than single-column for multi-tenant) |
| `idx_people_contacts_is_favorite` | Partial B-tree on `(user_id)` WHERE `is_favorite = true` | Only indexes the small subset of favorited contacts |
| `idx_people_contacts_personality_gin` | GIN on `personality_profile` | Enables `@>` operator queries inside the JSONB profile |

Note: The user proposed `category` alone, but since every query in `StrategicNetwork.tsx` already filters by `user_id` first, a composite `(user_id, category)` index is strictly better -- Postgres can use it for both `WHERE user_id = X` and `WHERE user_id = X AND category = Y`.

## 2. RAG Domain Intelligence Table

### Problem

The edge function (`rag-architect`, line 950) already tries to `upsert` into `rag_domain_intelligence` but the table was never created. This means every domain analysis silently fails to persist structured intelligence (caught by try/catch, logged as warning).

### Design Decision: Flat vs Per-Subdomain

The user proposed a **per-subdomain row** design. However, the edge function already writes a **single flat row per rag_id** with columns like `user_input`, `interpreted_intent`, `subdomains` (as JSONB array), `validation_queries`, `known_debates`, `recommended_config`. Changing the edge function to write per-subdomain would require significant refactoring.

**Solution:** Create the table matching what the edge function already writes (flat, one row per rag_id), BUT add the user's proposed fields (`expert_sources`, `taxonomy`) as additional JSONB columns for future enrichment. This way:
- The existing edge function code works immediately (no more silent failures)
- Domain intelligence becomes queryable
- Per-subdomain data lives inside the `subdomains` JSONB array (already structured with name, relevance, key_concepts per subdomain)

### Table schema:

```text
rag_domain_intelligence
  id              UUID PK
  rag_id          UUID FK -> rag_projects(id) ON DELETE CASCADE (UNIQUE)
  user_input      TEXT
  interpreted_intent JSONB
  subdomains      JSONB          -- Array of {name, relevance, key_concepts, ...}
  source_categories JSONB
  critical_variables JSONB
  validation_queries JSONB       -- Maps to user's "preguntas clave"
  known_debates   JSONB          -- Maps to user's "controversias del sector"
  recommended_config JSONB
  expert_sources  JSONB          -- NEW: user's proposed field
  taxonomy        JSONB          -- NEW: user's proposed field
  user_confirmed  BOOLEAN DEFAULT false
  created_at      TIMESTAMPTZ DEFAULT now()
```

### RLS Policy

Using the existing `user_owns_rag_project(rag_id)` function for all operations, consistent with all other `rag_*` tables.

## Files Affected

| File | Change |
|------|--------|
| New SQL migration | 3 indices on people_contacts + rag_domain_intelligence table + RLS + index |

No edge function or frontend changes needed -- the edge function already writes to this table (will stop silently failing), and the frontend reads domain_map from rag_projects (backward compatible).

## Execution

Single SQL migration with:
1. Three indices on `people_contacts`
2. `CREATE TABLE rag_domain_intelligence` with UNIQUE constraint on `rag_id`
3. RLS policy via `user_owns_rag_project`
4. Index on `rag_id`
