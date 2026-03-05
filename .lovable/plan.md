

# JARVIS Pipeline — Fixes F2→F6 Implementation Plan (Confirmed)

## Overview

13 prompt fixes + tag system across 2 edge functions. No DB changes, no UI changes.

## File 1: `supabase/functions/generate-document/index.ts`

### Tag System (lines ~1219-1229)

Insert 3 processing functions + apply them between `stripChangelog` and `translateForClient`:

```text
Current flow:    stripChangelog → translateForClient → render
New flow:        stripChangelog → stripInternalOnly → processPendingTags → processNeedsClarification → translateForClient → render
```

- `stripInternalOnly(text)`: Regex removes lines/paragraphs starting with `[[INTERNAL_ONLY]]` up to next double newline or heading — **only in non-internal mode**
- `processPendingTags(text, isClientMode)`: Client mode replaces `[[PENDING:X]]` with `________________` (signature line); internal keeps as-is
- `processNeedsClarification(text, isClientMode)`: Client mode replaces `[[NEEDS_CLARIFICATION:X]]` with `[Por confirmar]`

Applied at line ~1223 (after changelog strip, before client dictionary).

## File 2: `supabase/functions/project-wizard-step/index.ts`

### F2 — Extract (line ~264, append to systemPrompt)

**B-01** + **B-02**: ~15 lines of rules for client name verification (`[[PENDING:nombre_comercial]]`) and urgency-timeline alert (`gravedad: "alta"`).

### F3 — Scope (line ~422, append to systemPrompt)

**D-01** through **D-06**: ~50 lines covering MVP reconciliation protocol, identity consistency, AI metrics formatting, changelog propagation, `[[INTERNAL_ONLY]]` block list, and Phase 0 recurring costs note.

### F4 — Audit (line ~1364, prepend to systemPrompt)

**A-01** + **A-02** + **A-03**: ~30 lines with anti-false-positive protocol (3 checks before OMISSION), score as text field with bands, and mandatory urgency/timeline CRITICAL finding.

### F6 — AI Leverage (line ~1418, append to systemPrompt)

**I-01** + **I-02** + **I-03**: ~20 lines for textual dedup validation, existing infrastructure reading, and ROI unlock condition format.

## Implementation Order

1. Tag system in `generate-document` (enables all `[[INTERNAL_ONLY]]`/`[[PENDING]]`/`[[NEEDS_CLARIFICATION]]` rendering)
2. F4 A-01/A-02/A-03 (anti-false-positives — immediate quality improvement)
3. F3 D-01 + D-05 (structural: MVP reconciliation + INTERNAL_ONLY tagging)
4. F2 B-01 + B-02 (input quality for downstream phases)
5. F3 D-02, D-03, D-04, D-06 (refinements)
6. F6 I-01, I-02, I-03 (output polish)

All changes are prompt text appended/prepended to existing system prompts — no logic refactoring needed. Both edge functions auto-deploy.

