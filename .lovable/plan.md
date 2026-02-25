

## Plan: Query Expansion, Deep Pagination, Dedup & Time-Budget

### Overview

Replace the hardcoded psychology-only query generator with an LLM-powered, domain-agnostic query expansion engine. Add in-memory deduplication, increased paper capacity, and a time-budget safety mechanism with self-kick.

All changes are in a single file: `supabase/functions/rag-architect/index.ts`. No DB migrations needed.

---

### Step 1: Delete `getAcademicQueries` + `KEY_AUTHOR_QUERIES`, create `generateExpandedQueries`

**Lines 216-310**: Delete the entire `getAcademicQueries` function and `KEY_AUTHOR_QUERIES` constant. Replace with:

```typescript
async function generateExpandedQueries(
  subdomain: string, domain: string, level: string,
  domainMap?: Record<string, unknown>
): Promise<{ scholarQueries: string[]; perplexityQueries: string[] }> {
  const fallback = {
    scholarQueries: [
      `${subdomain} ${domain} systematic review`,
      `${subdomain} ${domain} meta-analysis`,
      `${subdomain} ${domain} peer-reviewed`,
      `${subdomain} recent advances ${domain}`,
      `${subdomain} ${domain} longitudinal study`,
    ],
    perplexityQueries: [
      `${subdomain} ${domain} mejores prácticas guía experta`,
      `${subdomain} ${domain} best practices expert guide`,
      `${subdomain} ${domain} resources recommendations ${level}`,
    ],
  };

  try {
    const domainContext = domainMap
      ? `\nDomain intelligence: ${JSON.stringify(domainMap).slice(0, 2000)}`
      : "";

    const result = await chatWithTimeout([
      { role: "system", content: "You generate optimized search queries for academic and web research. Return ONLY valid JSON, no markdown." },
      { role: "user", content: `Generate search queries for subdomain "${subdomain}" in domain "${domain}" (level: ${level}).${domainContext}

Return JSON: { "scholarQueries": ["q1",...], "perplexityQueries": ["p1",...] }
Rules:
- scholarQueries: up to 5 queries for Semantic Scholar API. English, technical terms, include key author names from domain intelligence if available. Include terms like "systematic review", "meta-analysis", "RCT" where appropriate.
- perplexityQueries: up to 3 queries for web search. Mix languages if domain is non-English. Broader terms, practical guides, expert resources.` }
    ], { model: "gemini-flash", responseFormat: "json", temperature: 0.4, maxTokens: 1024 }, 10000);

    const parsed = JSON.parse(result);
    return {
      scholarQueries: (Array.isArray(parsed.scholarQueries) ? parsed.scholarQueries : fallback.scholarQueries).slice(0, 5),
      perplexityQueries: (Array.isArray(parsed.perplexityQueries) ? parsed.perplexityQueries : fallback.perplexityQueries).slice(0, 3),
    };
  } catch (err) {
    console.warn("[QueryExpansion] LLM failed, using mechanical fallback:", err);
    return fallback;
  }
}
```

### Step 2: Rewrite `searchWithSemanticScholar` (lines 312-398)

New signature and body:

```typescript
async function searchWithSemanticScholar(
  subdomain: string, domain: string, level: string,
  domainMap?: Record<string, unknown>,
  scholarQueries?: string[],
  timeBudgetMs: number = 80000
): Promise<{ papers: Array<{...}>; urls: string[] }> {
  const startTime = Date.now();
  const queries = scholarQueries ? [...scholarQueries] : [
    `${subdomain} ${domain} peer-reviewed`
  ];

  // Keep domain-map author/work expansion (lines 324-337 logic preserved)
  if (domainMap) {
    const subdomains = (domainMap as Record<string, unknown>).subdomains as Array<Record<string, unknown>> || [];
    for (const sub of subdomains) {
      for (const author of ((sub.key_authors as string[]) || []).slice(0, 3)) {
        const q = `${author} ${subdomain}`;
        if (!queries.includes(q)) queries.push(q);
      }
      for (const work of ((sub.fundamental_works as string[]) || []).slice(0, 2)) {
        if (!queries.includes(work)) queries.push(work);
      }
    }
  }

  // Technical suffixes
  for (const suffix of ["systematic review", "meta-analysis", "longitudinal study", "intervention effectiveness"]) {
    const q = `${subdomain} ${domain} ${suffix}`;
    if (!queries.includes(q)) queries.push(q);
  }
  if (level === "frontier") {
    queries.push(`${subdomain} 2024 2025 recent advances`);
    queries.push(`${subdomain} preprint emerging research`);
  }

  const finalQueries = queries.slice(0, 12);
  // ... loop with 1500ms delay, time budget check, cap at 50 papers
  // NO KEY_AUTHOR_QUERIES block
```

Key changes vs current:
- Receives `scholarQueries` from LLM instead of calling `getAcademicQueries`
- Delay increased from 1200ms to **1500ms**
- Time budget check: `if (Date.now() - startTime > timeBudgetMs) break;`
- Paper cap increased from 30 to **50**
- **Entire KEY_AUTHOR_QUERIES block (lines 368-385) removed**

### Step 3: In-Memory Dedup in `handleBuildBatch` (after line 1282)

Add:
```typescript
const batchStartTime = Date.now();
const seenUrls = new Set<string>();
const seenHashes = new Set<string>();
```

Then wrap the paper source insert loop (line 1310) with:
```typescript
if (seenUrls.has(paper.url)) continue;
seenUrls.add(paper.url);
if (paper.doi) seenUrls.add(paper.doi);
```

Same for abstract direct chunks (line 1342) — check `seenHashes` with content hash before insert.

Same for citation URL inserts (lines 1432, 1480) — check `seenUrls`.

### Step 4: Time-Budget + Self-Kick (in `handleBuildBatch`)

Insert before the Perplexity supplement call (~line 1428), before the non-academic Perplexity branch (~line 1458), and before chunking (~line 1530):

```typescript
if (Date.now() - batchStartTime > 90000) {
  console.warn(`[Batch ${idx}] Time budget exceeded at 90s, self-kicking...`);
  await supabase.from("rag_research_runs")
    .update({ status: "partial", completed_at: new Date().toISOString() })
    .eq("id", run?.id);
  EdgeRuntime.waitUntil(triggerBatch(ragId as string, idx));
  return { ragId, batchIndex: idx, status: "self_kicked_timeout" };
}
```

### Step 5: Wire `generateExpandedQueries` at batch start (after line 1279)

```typescript
const domainMapData = rag.domain_intelligence || (rag.metadata as Record<string, unknown>)?.domain_map;
const { scholarQueries, perplexityQueries } = await generateExpandedQueries(
  subdomainName, domain, level, domainMapData as Record<string, unknown> | undefined
);
console.log(`[Batch ${idx}] Expanded queries: ${scholarQueries.length} scholar, ${perplexityQueries.length} perplexity`);
```

Then on line 1308, pass the queries:
```typescript
const { papers, urls: scholarUrls } = await searchWithSemanticScholar(
  subdomainName, domain, level, undefined, scholarQueries, 80000
);
```

And replace the hardcoded `queryVariations` (lines 1460-1464) with `perplexityQueries`.

---

### Summary of Changes

| Area | Before | After |
|------|--------|-------|
| Query generation | Hardcoded psychology queries | LLM-powered, domain-agnostic |
| Scholar paper cap | 30 | 50 |
| Scholar delay | 1200ms | 1500ms |
| Author queries | 7 hardcoded authors | From domain intelligence via LLM |
| Perplexity queries | 3 hardcoded variations | LLM-generated |
| URL dedup | None (DB ON CONFLICT only) | In-memory Set before insert |
| Time safety | Per-phase 25-40s checks | 90s global budget + self-kick |

### Deployment

1. Deploy updated `rag-architect` — single file change
2. No database migrations required
3. Existing completed RAGs unaffected — changes only apply to new `build-batch` invocations

