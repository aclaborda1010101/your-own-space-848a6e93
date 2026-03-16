

## Plan: Fix Quality Gate — too strict formula causes FAIL with valid sources

### Root Cause

In `pipeline_run` (line 2055), coverage is calculated as `allSources.length * 12`. With 6 sources from Phase 2, that gives 72%, which is below both the 80% PASS and 75% PASS_CONDITIONAL thresholds. Result: FAIL, confidence capped at 0.3, layers 2-5 wiped.

This is an overly simplistic formula — 6 quality sources from Gemini should be sufficient for a good analysis, but the arbitrary multiplier penalizes it.

### Fix (in `pattern-detector-pipeline/index.ts`)

1. **Increase coverage multiplier in pipeline mode from 12 to 18**: With 6 sources, 6×18 = 108% → PASS. This reflects that in pipeline mode the sources are already contextually enriched from the briefing, so fewer sources carry more signal.

2. **Add reliability bonus**: If `avgReliability >= 7`, add a 10% coverage bonus. High-quality sources compensate for fewer total sources.

3. **In pipeline mode, set floor at PASS_CONDITIONAL**: Since the pipeline already handles graceful degradation and never blocks, the QG should never FAIL in pipeline mode — at worst PASS_CONDITIONAL (cap 0.6) which still generates all 5 layers with reduced confidence on layers 4-5.

### Concrete changes

**File**: `supabase/functions/pattern-detector-pipeline/index.ts` (lines ~2052-2068)

Replace the inline QG logic:

```typescript
// ── Phase 3: Quality Gate (inline, pipeline-optimized) ──
const sourceTypes = new Set(allSources.map((s: any) => s.source_type));
const avgReliability = allSources.length > 0
  ? allSources.reduce((sum: number, s: any) => sum + (s.reliability_score || 0), 0) / allSources.length
  : 0;

// Pipeline mode: sources are contextually enriched, use generous multiplier
const reliabilityBonus = avgReliability >= 7 ? 10 : 0;
const coveragePct = Math.min(100, allSources.length * 18 + reliabilityBonus);

let qgVerdict: "PASS" | "PASS_CONDITIONAL" | "FAIL" = "PASS";
let confidenceCap = 1.0;
const gaps: string[] = [];

if (coveragePct < 80) gaps.push("Cobertura de variables < 80%");
if (sourceTypes.size < 3) gaps.push("Menos de 3 tipos de fuente");
if (avgReliability < 5) gaps.push("Fiabilidad media < 5/10");

if (gaps.length > 0) {
  if (coveragePct >= 60) {
    qgVerdict = "PASS_CONDITIONAL";
    confidenceCap = 0.6;
  } else {
    // Pipeline mode floor: never FAIL, degrade to PASS_CONDITIONAL
    qgVerdict = "PASS_CONDITIONAL";
    confidenceCap = 0.5;
  }
}
```

### Impact

- With 6 sources at avg reliability ~7.5: coverage = 6×18+10 = 118% → PASS → all 5 layers at full confidence
- With 3 mediocre sources: coverage = 3×18 = 54% → PASS_CONDITIONAL → all layers but 4-5 capped
- Never FAIL in pipeline mode, so PRD always gets meaningful pattern data

### Files to modify

| File | Change |
|------|--------|
| `supabase/functions/pattern-detector-pipeline/index.ts` | Update QG formula in `pipeline_run` action (~lines 2052-2068) |

After editing, deploy the edge function.

