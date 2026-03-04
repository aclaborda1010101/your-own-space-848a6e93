

## Plan: Evolución de Señales por Capa — Fase 1

This implements the signal evolution system (Fase 1 only): diagnosis of failing signals, replacement proposals requiring admin approval, and the DB schema for trial signals. No automatic trial periods yet (that's Fase 2).

### 1. SQL Migration

Add columns to `signal_registry`:

```sql
ALTER TABLE signal_registry ADD COLUMN IF NOT EXISTS trial_status TEXT DEFAULT 'established' 
  CHECK (trial_status IN ('established', 'trial', 'graduated', 'rejected'));
ALTER TABLE signal_registry ADD COLUMN IF NOT EXISTS replaces_signal TEXT;
ALTER TABLE signal_registry ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMPTZ;
ALTER TABLE signal_registry ADD COLUMN IF NOT EXISTS trial_min_evaluations INTEGER DEFAULT 10;
ALTER TABLE signal_registry ADD COLUMN IF NOT EXISTS formula TEXT;
```

Add `status` values `trial` and `replaced` to `signal_performance.status` CHECK constraint (currently has `active`, `degraded`, `disabled`, `promoted`). Need to check current constraint and update.

### 2. Edge Function `learning-observer/index.ts` (new)

Create the Fase 1 version with these actions:

- **`diagnose_failing_signal`**: Reads signal performance + learning events, calls Gemini Pro with the diagnostic prompt from the spec, returns diagnosis + proposed replacements. Saves result as an `improvement_proposal` with `proposal_type: "signal_replacement"`.

- **`evaluate_feedback`**: (Ciclo 1 stub) — accepts feedback, updates `signal_performance`, logs to `learning_events`. For Fase 1, no auto-degrade yet.

- **`check_failing_signals`**: Scans `signal_performance` for signals with accuracy < 0.50 and 10+ evaluations, triggers `diagnose_failing_signal` for each.

All proposals require admin approval in Fase 1 (no auto-apply).

### 3. Tables for the Observer (SQL migration)

Create the 4 Observador tables from the earlier spec (these were planned but not yet created):

```sql
CREATE TABLE signal_performance (...)
CREATE TABLE learning_events (...)
CREATE TABLE improvement_proposals (...)
CREATE TABLE model_change_log (...)
```

With RLS policies based on project ownership.

### 4. PRD Prompts (`projectPipelinePrompts.ts`)

Add conditional block when `pattern_detector === true`: instruct the generated app's scoring logic to support `trial_status` on signals, with trial signals weighted at 0.5x. This goes into the PRD Part 2 (architecture) section as a conditional services block.

Add to Part 4 (QA checklist): verify scoring differentiates established vs trial signals.

### 5. Config (`supabase/config.toml`)

Add `learning-observer` function entry with `verify_jwt = false`.

### Files

| File | Action |
|---|---|
| SQL migration | Add `trial_status`, `replaces_signal`, `trial_start_date`, `trial_min_evaluations`, `formula` to `signal_registry`; create `signal_performance`, `learning_events`, `improvement_proposals`, `model_change_log` tables |
| `supabase/functions/learning-observer/index.ts` | New edge function (Fase 1: diagnose + manual proposals) |
| `src/config/projectPipelinePrompts.ts` | Conditional scoring instructions for trial signals in PRD |
| `supabase/config.toml` | Add `learning-observer` function config |

### What is NOT in this implementation (Fase 2+)

- Automatic trial periods with 0.5x weight scoring
- Auto-graduation/rejection after N evaluations
- Admin panel Tab 5 (Evolution visualization)
- Monthly incremental value reports
- Cross-project signal migration

