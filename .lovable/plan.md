
User wants:
1. Remove the manual daily check-in card (energía/ánimo/foco) from dashboard — it should auto-fill from health data.
2. Fix CommandCenterCard showing "sin datos de WHOOP" on dashboard when /health does load data (with a delay).

Investigation needed: CommandCenterCard uses `useJarvisWhoopData` (queries `jarvis_whoop_data`). Health page uses `useWhoop` (queries `whoop_data`). Different tables — likely the bug. POTUS syncs into `jarvis_whoop_data`, but if last sync is stale or empty, the dashboard shows "sin datos" while `/health` reads `whoop_data` directly.

## Plan

**1. Hide manual check-in card from dashboard**
- In `useDashboardLayout.tsx`: change default `visible: true` → `false` for `check-in` card so new/reset profiles don't show it.
- In `Dashboard.tsx` / `DEFAULT_LAYOUT`: remove `check-in` from default `leftColumn`/`rightColumn` so it doesn't render by default.
- Keep the card available in settings (user can re-enable manually if they want override).
- The auto-derivation from WHOOP already exists in `useCheckIn` (`mapWhoopToCheckIn`) — check-in still gets registered silently in background when WHOOP data is present.

**2. Fix "salud sin datos" on dashboard CommandCenterCard**
- Root cause: `CommandCenterCard` reads from `jarvis_whoop_data` only. If POTUS hasn't mirrored recent data there but `whoop_data` has it (Health page source), card shows empty.
- Fix: make `useJarvisWhoopData` fall back to `whoop_data` table when `jarvis_whoop_data` is empty or stale (>24h old). Single source-of-truth resolution: try `jarvis_whoop_data` first, then `whoop_data`, return whichever has the most recent `data_date`.
- Also surface a tiny loading skeleton instead of premature "sin datos" while `isLoading` is true (verify `CommandCenterCard` respects `isLoading`).

**3. Fix `/health` "pensando y luego carga" delay**
- Likely `useWhoop` runs `checkConnection` → `loadAvailableDates` → `loadDateData` sequentially on mount, each awaiting Supabase round-trip.
- Optimization: parallelize initial `loadDateData(today)` and `loadAvailableDates()` with `Promise.all`, and render whatever data exists in `whoop_data` immediately without waiting for `checkConnection`.

## Files to change
- `src/hooks/useDashboardLayout.tsx` — default visibility/columns for `check-in`.
- `src/hooks/useJarvisWhoopData.tsx` — fallback to `whoop_data` table.
- `src/components/dashboard/CommandCenterCard.tsx` — confirm loading state handled before "sin datos".
- `src/hooks/useWhoop.tsx` — parallelize initial load to remove perceived delay.

## Out of scope this turn
- Executive summary card (next turn, block 1 continuation).
- Auto check-in registration writing to DB on dashboard load (block 5).

No schema changes. No model changes. JARVIS stays the only visible identity.
