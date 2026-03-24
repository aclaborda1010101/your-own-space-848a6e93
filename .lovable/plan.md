

## Problem

The `project-wizard-step` edge function calls the Google Gemini API directly using `GEMINI_API_KEY`. This key appears to be missing, expired, or invalid, causing `"GEMINI_API_KEY is not defined"` errors during PRD generation.

The project already has `LOVABLE_API_KEY` configured and many other edge functions successfully use the Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`). The fix is to migrate the LLM helpers to use the gateway instead of direct Google/Anthropic API calls.

## Plan

### Step 1: Rewrite `supabase/functions/project-wizard-step/llm-helpers.ts`

Replace the 4 exported functions (`callGeminiFlash`, `callGeminiFlashMarkdown`, `callClaudeSonnet`, `callGeminiPro`) to call the Lovable AI Gateway instead of direct provider APIs:

- Use `LOVABLE_API_KEY` from `Deno.env`
- Target `https://ai.gateway.lovable.dev/v1/chat/completions`
- Map current model names to gateway model identifiers:
  - `callGeminiFlash` → `google/gemini-2.5-flash` (JSON response format)
  - `callGeminiFlashMarkdown` → `google/gemini-2.5-flash` (text response)
  - `callClaudeSonnet` → `google/gemini-2.5-flash` (fallback equivalent)
  - `callGeminiPro` → `google/gemini-2.5-pro` (with fallback to flash on 429)
- Preserve the same return signature: `{ text, tokensInput, tokensOutput }`
- Keep timeout logic

### Step 2: Update `callPrdModel` in `index.ts`

Lines ~1088-1091 define an inline `callPrdModel` that also reads `GEMINI_API_KEY` directly. Refactor it to use the gateway-based `callGeminiPro` from the updated helpers, or replicate the same gateway call pattern inline.

Similarly fix the retry logic around line ~2370 that directly calls the Gemini API.

### Step 3: Redeploy

The function auto-deploys on save. No new secrets needed -- `LOVABLE_API_KEY` is already present.

## Technical details

- The Lovable AI Gateway uses OpenAI-compatible request/response format
- Token usage comes from `response.usage.prompt_tokens` / `completion_tokens`
- Handle 429 (rate limit) and 402 (payment required) errors explicitly
- Existing `GEMINI_API_KEY` and `GOOGLE_AI_KEY` secrets can remain for other functions that still use them directly

