

## Plan: Fix Pattern Detector Phase 5 JSON parsing failure + ensure PRD consumes detector output

### Root Cause

The pattern detector **did execute** for this project (step 12 exists with status "review"), but **Phase 5 failed with a JSON parse error**:

```
SyntaxError: Unexpected non-whitespace character after JSON at position 5543
```

This caused the entire `pipeline_run` to catch the error at line 3006 and return the error fallback with empty `signals_by_layer`, empty `prd_injection`, and `model_verdict: "NOT_RELIABLE_YET"`. The hardcoded centros_comerciales signals never got injected because the error occurred during Phase 5 LLM parsing before the hardcoded injection code ran.

The enriched signal schema (with nested `concrete_data_source`, `variable_extracted`, `cross_with_internal`, etc.) makes the JSON output very complex (~5500+ chars), increasing the chance of malformed JSON from the LLM. The `safeParseJson` repair logic (close unmatched braces/brackets) is too basic for this.

### Two problems to fix

1. **Phase 5 JSON parsing is brittle** -- when `safeParseJson` fails, the error propagates and kills the entire pipeline (hardcoded signals never get injected either)
2. **No retry/fallback** -- Phase 5 should retry with a simpler prompt or use the hardcoded signals as minimum viable output

### Changes to `supabase/functions/pattern-detector-pipeline/index.ts`

#### Fix 1: Wrap Phase 5 LLM call in try/catch with fallback to empty layers (lines ~2321-2323)

Currently:
```ts
const p5Result = await chat(p5Messages, { model: "gemini-pro", responseFormat: "json", maxTokens: 12288 });
let phase5 = safeParseJson(p5Result) as any;
let layers = phase5?.layers || [];
```

Change to:
```ts
let layers: any[] = [];
try {
  const p5Result = await chat(p5Messages, { model: "gemini-pro", responseFormat: "json", maxTokens: 12288 });
  const phase5 = safeParseJson(p5Result) as any;
  layers = phase5?.layers || [];
  console.log(`[pipeline_run] Phase 5 LLM parsed: ${layers.length} layers`);
} catch (p5Err) {
  console.error("[pipeline_run] Phase 5 LLM parse failed, using empty layers (hardcoded will be injected):", p5Err);
  // Initialize with 5 empty layers so hardcoded injection works
  layers = [
    { layer_id: 1, layer_name: "Obvia", signals: [] },
    { layer_id: 2, layer_name: "Analítica Avanzada", signals: [] },
    { layer_id: 3, layer_name: "Señales Débiles", signals: [] },
    { layer_id: 4, layer_name: "Inteligencia Lateral", signals: [] },
    { layer_id: 5, layer_name: "Edge Extremo", signals: [] },
  ];
}
```

This ensures the hardcoded `centros_comerciales` signals at line 2326+ always get injected even if the LLM output is malformed.

#### Fix 2: Improve `safeParseJson` to handle more edge cases (lines 52-71)

Add additional repair strategies:
- Remove trailing incomplete key-value pairs more aggressively
- Handle concatenated JSON (two JSON objects stuck together, which is what "position 5543" suggests)
- Try extracting just the first valid JSON object if there are multiple

```ts
function safeParseJson(text: string): unknown {
  const cleaned = cleanJson(text);
  try {
    return JSON.parse(cleaned);
  } catch (_firstErr) {
    let repaired = cleaned;
    
    // Strategy 1: Try to find the first complete top-level JSON object
    let depth = 0;
    let firstObjEnd = -1;
    for (let i = 0; i < repaired.length; i++) {
      if (repaired[i] === '{') depth++;
      else if (repaired[i] === '}') { depth--; if (depth === 0) { firstObjEnd = i; break; } }
    }
    if (firstObjEnd > 0 && firstObjEnd < repaired.length - 1) {
      try { return JSON.parse(repaired.substring(0, firstObjEnd + 1)); } catch {}
    }
    
    // Strategy 2: Close unclosed structures
    repaired = repaired.replace(/,\s*"[^"]*$/, "");
    repaired = repaired.replace(/,\s*$/, "");
    const openBraces = (repaired.match(/{/g) || []).length;
    const closeBraces = (repaired.match(/}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/]/g) || []).length;
    for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += "]";
    for (let i = 0; i < openBraces - closeBraces; i++) repaired += "}";
    return JSON.parse(repaired);
  }
}
```

#### Fix 3: Add `result6` reference fix (line 1822)

Line 1822 references `result6` which doesn't exist in the 5-part pipeline:
```ts
let part6Text = result6.text;
```
This would cause a runtime error in the validation/linter phase. Need to check if `result6` is defined elsewhere or remove it.

### Deployment

Redeploy `pattern-detector-pipeline` edge function after changes.

### Expected Result
- Phase 5 JSON parse failures no longer kill the pipeline
- Hardcoded centros_comerciales signals always get injected as minimum viable output
- PRD receives non-empty `prd_injection` with patterns, RAGs, and integrations
- The `safeParseJson` handles concatenated JSON objects (the actual error case)
