

## Plan: RAG Quality Fixes + Three Tiers

Two specs implemented together since the tiers depend on the quality fixes. This is a large change touching `rag-architect/index.ts` (main), `rag-job-runner/index.ts` (dedup threshold), prompts, frontend, and DB schema.

---

### Part A: Quality Fixes (applied to all tiers)

**1. Windowed chunking** (`rag-architect/index.ts` lines 654-746)
- Rename current `chunkRealContent` body to `chunkWindow(content, subdomain, level)` (no truncation)
- Rewrite `chunkRealContent`: if content <= 30K, call `chunkWindow` directly. If > 30K, split into 28K windows with 2K overlap, process each window independently with `chunkWindow`, mechanical fallback per window on failure, 500ms delay between windows

**2. Less aggressive `cleanScrapedContent`** (line 609)
- Change min length filter from 40 to 15 chars
- Keep lines starting with digits, bullets, or containing numbers
- Relax table row filter from 100 to 50 chars (line 615)
- Lower minimum result threshold from 200 to 100 chars (line 620)

**3. Dedup threshold 0.92 -> 0.96** 
- `rag-architect/index.ts` line 1607: `similarity_threshold: 0.92` -> `0.96`
- `rag-job-runner/index.ts`: same change (search for `similarity_threshold: 0.92`)
- SQL migration: update `check_chunk_duplicate` function default parameter from 0.92 to 0.96

**4. `smartScrape` function** (new, all tiers benefit)
- Try `directFetch` first (free). If result > 500 chars, use it. Otherwise fall back to `scrapeUrl` (Firecrawl). Saves 40-60% Firecrawl credits on Pro tier.

**5. URL dedup across batches** (new)
- Before scraping any URL, check `rag_sources` for existing entry with same `source_url` for this `rag_id`. Skip if found.

**6. `resilientSearch` function** (new)
- Cascading fallback: Perplexity -> Firecrawl (domain-specific fallback URLs) -> Gemini knowledge -> empty
- Replace direct `searchWithPerplexity` calls in `handleBuildBatch` (lines ~1474-1476 and ~1519-1523) with `resilientSearch`
- Add `generateFallbackUrls(subdomain, domain, level)` helper for domain-aware URL generation

---

### Part B: Three Tiers

**7. DB schema** (SQL migration)
- `ALTER TABLE rag_projects ADD COLUMN rag_tier TEXT DEFAULT 'normal' CHECK (rag_tier IN ('basic', 'normal', 'pro'));`

**8. Tier constants and budget config** (`rag-architect/index.ts`)
- Add `RESEARCH_LEVELS_BASIC = ["surface", "academic"]`, `RESEARCH_LEVELS_NORMAL = ["surface", "academic", "datasets", "frontier"]`, `RESEARCH_LEVELS_PRO` = current full 7 levels
- Add `getResearchLevels(tier)` function
- Rewrite `getBudgetConfig(tier)` to return: `maxSubdomains`, `maxPerplexityQueries`, `maxFirecrawlUrls`, `useFirecrawl`, `useSemanticScholar`, `postBuildSteps`, `injectProjectDocs`
- Basic: 5 subdomains, 1 perplexity query, no Firecrawl, no Scholar, postbuild = quality_gate only
- Normal: 8 subdomains, 2 queries, 3 Firecrawl URLs, Scholar on, postbuild = KG + quality_gate
- Pro: 15 subdomains, 3 queries, 5 URLs, Scholar + PDFs, postbuild = all 4 steps

**9. `handleCreate` receives `tier`** (line 901)
- Extract `tier` from body, default `"normal"`, save as `rag_tier` in insert

**10. `handleConfirm` filters subdomains** (line 1085)
- Read `rag.rag_tier`, get budget config
- Filter `getActiveSubdomains` by relevance (critical > high > medium) and cap to `budget.maxSubdomains`
- Use tier-specific research levels for `totalBatches` calculation

**11. `injectProjectDocuments` function** (new)
- For all tiers (especially basic): fetch `project_wizard_steps` (steps 2,3,5,6,7) and `project_documents`, insert as `rag_sources` with tier `tier1_gold`, chunk via `chunkRealContent`, generate embeddings, insert as `rag_chunks`
- Called in `handleConfirm` when `budget.injectProjectDocs && rag.project_id`

**12. `handleBuildBatch` uses tier config** (lines 1259-1716)
- Read `rag.rag_tier`, get budget + research levels
- Replace `RESEARCH_LEVELS` with tier-specific levels for batch/level calculation
- Cap `perplexityQueries.slice(0, budget.maxPerplexityQueries)`
- Cap `urlsToScrape` to `budget.maxFirecrawlUrls`
- Use `smartScrape` vs `directFetch` based on `budget.useFirecrawl`
- Conditional Semantic Scholar based on `budget.useSemanticScholar`

**13. `handlePostBuild` respects tier** (lines 1723-1860)
- Read `budget.postBuildSteps` from tier config
- Skip steps not in the list (e.g., basic skips KG, taxonomy, contradictions)
- Adjust post-build chain to only trigger included steps

**14. `handleResumeBuild` uses tier levels** (line 1180)
- Replace `RESEARCH_LEVELS.length` with `getResearchLevels(rag.rag_tier).length`

---

### Part C: Frontend + Prompts

**15. `RagCreator.tsx`** - Replace moral modes with tiers
- Replace `MORAL_MODES` array: `basic` ("Básico", $0.50-1.50, 30-80 chunks, 2-5 min), `normal` ("Normal", $3-6, 100-300 chunks, 10-20 min), `pro` ("Pro", $12-20, 300-800 chunks, 30-60 min)
- `onStart` signature stays `(domain, moralMode)` for backwards compat but now passes tier value
- Update `handleCreate` in `useRagArchitect.tsx` to pass `tier` parameter alongside `moralMode`

**16. `AI_LEVERAGE_SYSTEM_PROMPT`** (projectPipelinePrompts.ts line 399)
- Add tier detection rules inside the RAG section: BASICO/NORMAL/PRO criteria
- Add `nivel` field to `services_decision.rag` in the JSON template

**17. `ProjectWizardGenericStep.tsx`** - Add tier selector
- In the `ServicesDecisionPanel`, when RAG is enabled, show 3 clickable tier chips (Basico/Normal/Pro) with cost/time info
- Save selected tier in `output_data.services_decision.rag.nivel`

**18. `useRagArchitect.tsx`** - Pass tier to create
- Update `createRag` to accept and forward `tier` parameter

---

### Files modified

| File | Changes |
|---|---|
| `supabase/functions/rag-architect/index.ts` | Windowed chunking, cleanScrapedContent fix, dedup 0.96, smartScrape, URL dedup, resilientSearch, tier constants, getBudgetConfig rewrite, handleCreate/Confirm/BuildBatch/PostBuild/Resume tier support, injectProjectDocuments |
| `supabase/functions/rag-job-runner/index.ts` | Dedup threshold 0.92 -> 0.96 |
| `src/config/projectPipelinePrompts.ts` | Tier detection rules in AI_LEVERAGE_SYSTEM_PROMPT, `nivel` field in services_decision.rag |
| `src/components/rag/RagCreator.tsx` | Replace moral modes with 3 tiers (basic/normal/pro) |
| `src/components/projects/wizard/ProjectWizardGenericStep.tsx` | Tier selector in ServicesDecisionPanel |
| `src/hooks/useRagArchitect.tsx` | Pass tier to create action |
| SQL migration | Add `rag_tier` column, update `check_chunk_duplicate` default |

### Implementation order
Due to file size, implement in 2-3 passes:
1. DB migration + quality fixes (dedup, cleanScrapedContent, windowed chunking)
2. Tier system in rag-architect (constants, budget, handleCreate/Confirm/BuildBatch/PostBuild, smartScrape, resilientSearch, injectProjectDocuments)
3. Frontend + prompts (RagCreator, ServicesDecisionPanel tier selector, AI_LEVERAGE_SYSTEM_PROMPT)

