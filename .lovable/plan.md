

## Plan: Ajustes finos de calibración

### Current state

- CHECK constraints are already valid SQL (lines 6-9 of first migration) -- no fix needed.
- Unique index exists on `diagnostic_id` only, not `(diagnostic_id, labeled_by)`.
- Metrics view already has `total_audits`, `labeled_audits`, `labeling_pct` but no percentile errors.
- Dashboard shows error badges but no interpretation text.

### Changes

**1. SQL Migration**

- Drop existing unique index on `diagnostic_id` alone, create new one on `(diagnostic_id, labeled_by)` to allow multiple labelers per diagnostic while preventing duplicates per user.
- Recreate `bl_calibration_metrics` view adding:
  - `p50_error_*` and `p90_error_*` for each of the 4 scores (using `PERCENTILE_CONT`)
  - Keep existing fields intact

**2. Dashboard UI (`CalibrationDashboard.tsx`)**

- Update `CalibrationMetrics` interface to include `p50_error_*` and `p90_error_*` fields.
- Add interpretation text below each error badge:
  - Green (<15): "Bien calibrado"
  - Amber (15-25): "Revisar pesos"
  - Red (>25): "Desalineación alta"
- Show p50/p90 as small secondary text in each error card.
- Update upsert `onConflict` to match new composite unique index.

### Tasks

1. SQL migration: update unique index + add percentile errors to view
2. Update CalibrationDashboard UI with interpretation text and percentile display

