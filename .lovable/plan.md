

## Plan: Fix truncated Gemini response causing empty briefing

### Root Cause
The Gemini 2.5 Flash response is being **truncated** — the JSON is cut off mid-field. This causes `JSON.parse` to fail, and the fallback stores `{ raw_text: ..., parse_error: true }`. The UI receives this and shows empty fields because none of the expected briefing keys exist.

The truncation happens because the input is very large (~13K tokens) and the response JSON is also large. Gemini 2.5 Flash's default `maxOutputTokens` may be too low.

### Changes

1. **`supabase/functions/project-wizard-step/index.ts`** — In the `callGeminiFlash` function, add `generationConfig.maxOutputTokens: 8192` to the request body to prevent truncation.

2. **Same file, JSON parsing** — Improve the fallback: if `parse_error` occurs, attempt to salvage partial JSON by closing brackets, and add `response_format: "application/json"` (or `responseMimeType`) to force Gemini to return clean JSON without markdown fences.

3. **Same file, prompt** — Add `responseMimeType: "application/json"` in the Gemini `generationConfig` to eliminate markdown code fences from the response entirely.

### Technical Detail
The Gemini API supports `generationConfig.responseMimeType: "application/json"` which forces structured JSON output without markdown wrappers. Combined with increasing `maxOutputTokens`, this eliminates both the truncation and the parsing issues.

