

## Fix Timeout Consistency

### Changes

**1. `src/hooks/useProjectWizard.ts`**
- Change `pollForStepCompletion` default from `300000` to `600000` (600s) on line 399
- This ensures all callers (including `generateScope` and auto-resume) get adequate time

**2. `supabase/functions/project-wizard-step/index.ts`**
- Add a `FETCH_TIMEOUT_MS = 380_000` constant (matching `idea-pipeline-step` pattern)
- Create a `createTimeoutSignal()` helper that returns an `AbortController` + cleanup
- Pass the `signal` to all `fetch()` calls to LLM APIs (Anthropic, OpenAI, Gemini) so they abort cleanly before hitting Supabase's 400s wall clock limit
- This prevents hanging requests from consuming edge function runtime indefinitely

### Impact
- No UX changes — just more consistent and resilient timeout behavior
- Prevents silent hangs on LLM API calls
- Ensures frontend polling always outlasts backend processing

