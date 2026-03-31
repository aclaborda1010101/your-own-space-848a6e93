

# Plan: Fix PRD Pipeline Stalling After Pattern Detection

## Root Cause Analysis

Two issues prevent the PRD from completing:

**Bug 1: Audit output truncated** — `callGeminiPro` has `maxTokens: 16384`. The audit JSON exceeded this limit (`finish_reason=length` at 16,380 tokens), causing missing required sections (`demo`, `funcionalidades excluidas`).

**Bug 2: Wall-clock timeout** — The chained pipeline runs sequentially: Scope (~60s) + Audit (~90s) + Pattern Detection (~158s) = ~308s. This leaves insufficient time for PRD generation (which needs 5-6 LLM calls, ~180s+). The Supabase Edge Function wall-clock limit (~400s) kills the process.

## Changes

### 1. Increase audit maxTokens in `llm-helpers.ts`

Change `callGeminiPro` from `maxTokens: 16384` to `maxTokens: 32768` to prevent audit truncation. Also increase the fallback Flash call to match.

### 2. Make Pattern Detection non-blocking in `index.ts` (lines 1573-1635)

Instead of `await`ing the full pattern-detector-pipeline response (which takes 2-3 minutes), fire it asynchronously and don't wait for it. The pattern detector already saves its output to `project_wizard_steps` step 12, so:

- Replace the synchronous `await fetch(pattern-detector-pipeline)` with a fire-and-forget call
- Read the detector output from DB later if available, otherwise proceed without it
- This saves ~150 seconds of wall-clock time

New logic:
```
// Fire pattern detection in background (don't await)
fetch(`${SUPABASE_URL}/functions/v1/pattern-detector-pipeline`, { ... })
  .catch(e => console.warn("Pattern detector fire-and-forget error:", e));

// Continue immediately to PRD generation
// The PRD prompt already handles detectorOutput being null
```

### 3. Add timeout to pattern detection fetch (safety net)

If we decide to keep it blocking, add an `AbortController` with a 120s timeout. But non-blocking is preferred since the PRD already handles `detectorOutput = null`.

## Files Modified
1. `supabase/functions/project-wizard-step/llm-helpers.ts` — increase `callGeminiPro` maxTokens to 32768
2. `supabase/functions/project-wizard-step/index.ts` — make pattern detection non-blocking (lines 1587-1614)

## Impact
- Audit will no longer truncate (32K tokens is enough for the JSON output)
- PRD phase will start ~150s earlier, well within the wall-clock limit
- Pattern detection continues running independently; its results are available for future regenerations

