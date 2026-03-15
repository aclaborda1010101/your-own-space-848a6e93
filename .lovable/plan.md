

# Plan: Plaud Delete + Health Page Overhaul

## Part 1: Plaud Transcription Delete

### Problem
No way to permanently delete unwanted Plaud transcriptions. They keep reappearing because the system re-fetches from email.

### Solution
1. **Add "Eliminar" button** next to each transcription in `src/pages/DataImport.tsx` (alongside the existing "Procesar" button)
2. **Add `deletePlaudTranscription` function** that:
   - Deletes the row from `plaud_transcriptions`
   - Inserts the `source_email_id` into a new `plaud_dismissed_emails` table so that `plaud-fetch-transcriptions` skips it on future syncs
3. **Database migration**: Create `plaud_dismissed_emails` table (`id`, `user_id`, `source_email_id`, `created_at`) with RLS
4. **Update `supabase/functions/plaud-fetch-transcriptions/index.ts`**: When checking for existing transcriptions, also query `plaud_dismissed_emails` to exclude dismissed email IDs from re-import

### Files
- `src/pages/DataImport.tsx` — add delete button + handler
- `supabase/functions/plaud-fetch-transcriptions/index.ts` — filter out dismissed emails
- Migration SQL for `plaud_dismissed_emails` table

---

## Part 2: Health Page Overhaul

### Problem
Current Health page shows only today's snapshot (recovery, strain, sleep, HRV, resting HR) as static cards. No historical view, no period selector, no charts, and critically — no AI-readable summary for the system to use in coaching/task decisions.

### Solution

#### 2A. Multi-day sync + historical data
- **Update `useWhoop` hook** (or create `useWhoopHistory`) to fetch multiple days from `whoop_data` table
- **Add period selector** (7/14/30 days) like the Analytics page
- **Trigger `whoop-sync` with `action: "sync_user"` + `days` param** when user changes period, to backfill missing days

#### 2B. Rich Health Dashboard UI (`src/pages/Health.tsx`)
Replace current single-day cards with:
- **Summary cards** (today): Recovery, Strain, Sleep Performance, HRV, Resting HR (keep existing style)
- **Recovery trend chart** (line chart over selected period)
- **Sleep chart** (bar chart: hours slept per day + sleep performance line overlay)
- **Strain chart** (bar chart over period)
- **HRV trend chart** (line chart, important for readiness tracking)
- All using existing `recharts` + `ChartContainer` components from `src/components/ui/chart.tsx`

#### 2C. AI Health Summary generation
- **New edge function `whoop-health-summary`**: Takes last 7 days of `whoop_data`, generates a structured markdown summary (trends, warnings, recommendations) using Gemini Flash
- **Store in `jarvis_memory`** with `agent_type: 'health_summary'` so JARVIS, Coach, and POTUS can read it
- **Auto-trigger** on each sync, or manually from Health page
- **Existing consumers already read `whoop_data`** (jarvis-coach, potus-core, jarvis-gateway, telegram-webhook) — the summary enriches their context

The summary structure:
```
Estado físico actual: [bueno/moderado/bajo]
Recuperación promedio 7d: X%
Tendencia: [mejorando/estable/deteriorando]
Sueño: X.Xh promedio (necesidad estimada: Xh)
HRV tendencia: [subiendo/estable/bajando] (baseline: Xms)
Strain acumulado: [alto/moderado/bajo]
Recomendaciones: [push/mantener/recuperar]
Alertas: [lista si aplica]
```

### Files to modify/create
- `src/pages/Health.tsx` — complete overhaul with charts + period selector
- `src/hooks/useWhoopHistory.ts` — new hook for multi-day data
- `src/components/health/RecoveryChart.tsx` — recovery trend
- `src/components/health/SleepChart.tsx` — sleep hours + performance
- `src/components/health/StrainChart.tsx` — strain trend
- `src/components/health/HrvChart.tsx` — HRV trend
- `src/components/health/HealthAISummary.tsx` — display AI summary
- `supabase/functions/whoop-health-summary/index.ts` — AI summary generator
- No schema changes needed for `whoop_data` (already has all fields + `raw_data` JSONB)

