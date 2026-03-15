

# Plan: Fix WHOOP Data Loading

## Problems Found

1. **WHOOP API only returns data for completed cycles** — querying `start=today&end=today` returns empty records because today's recovery/sleep cycle hasn't closed yet. Need to also query yesterday's date.

2. **`onConflict: "user_id"` is wrong** — the `whoop_data` table has a composite unique on `user_id,data_date`, so the upsert fails silently or overwrites the wrong row. Must be `"user_id,data_date"`.

3. **No refresh_token** — the current token expires at 20:19 UTC and cannot be renewed. The `exchange_code` step didn't receive a refresh_token from WHOOP. This is a WHOOP API limitation for certain app types, but we should handle it gracefully (prompt reconnection when expired).

4. **`fetch_data` only queries today** — should also fetch yesterday (most likely source of actual data) and store both days.

## Changes

### 1. Fix `whoop-auth/index.ts` — `fetch_data` action

- Change date range to query **yesterday AND today** (`start=yesterday&end=today`)
- Fix `onConflict` from `"user_id"` to `"user_id,data_date"`
- Store data for both days if available
- Add console.log for API responses to aid debugging

### 2. Fix `whoop-sync/index.ts` — same `onConflict` fix

- The sync function already uses `"user_id,data_date"` — confirm it's correct (it is)

### 3. Fix `useWhoop.tsx` — handle empty today data

- After `fetchData`, if today's data is all null, try loading yesterday's cached data from DB as fallback display

### 4. Redeploy `whoop-auth`

## Scope
- Edit `supabase/functions/whoop-auth/index.ts` (fetch_data action: date range + onConflict fix + logging)
- Edit `src/hooks/useWhoop.tsx` (fallback to yesterday's data for display)
- Redeploy edge function

