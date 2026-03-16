

## Plan: Fix PRD not being sent to Expert Forge

### Diagnosis

After reading all relevant code, the extraction logic in `ProjectWizard.tsx` (line 340) and the Edge Function `publish-to-forge` both look structurally correct. The PRD is saved to DB step 3 with `output_data.document` key, and the wizard extracts it via `step3Out.document`.

The likely issue is a **data shape mismatch** — the `outputData` for step 3 may contain the PRD nested differently than expected (e.g., `outputData.text`, or the document key contains an object instead of a string, or the data arrives as a stringified JSON).

### Changes

**1. `ProjectWizard.tsx` (lines 337-358) — Robust PRD extraction with validation**
- Add deeper extraction: check `.text`, handle case where `.document` is an object
- Add minimum length validation (1000 chars)
- Add `console.log` for debugging PRD length
- Show char count in the button tooltip so user can verify

**2. `PublishToForgeDialog.tsx` (line 124) — Better validation**
- Add minimum length check (1000 chars instead of just truthy)
- Show PRD length warning if suspiciously short

**3. `publish-to-forge/index.ts` (lines 154-159) — Server-side validation + logging**
- Add explicit validation that `document_text.length >= 100` for `create_and_architect`
- Add diagnostic logging of `document_text` length before gateway call
- Log first 200 chars of document_text for debugging

### Files modified

| File | Change |
|------|--------|
| `src/pages/ProjectWizard.tsx` | Robust PRD extraction with fallback chain and length validation |
| `src/components/projects/wizard/PublishToForgeDialog.tsx` | Min-length validation and warning |
| `supabase/functions/publish-to-forge/index.ts` | Server-side validation + diagnostic logging |

