

## Plan: Fix bottom nav JARVIS button + hide TopBar on tablet

### Issue 1: JARVIS button opens POTUS chat instead of original floating JARVIS

Currently `BottomNavBar` navigates to `/chat`, which renders `PotusChatMvp` (POTUS — a different agent). The original floating JARVIS lives in `src/components/agent/AgentChatFloat.tsx` and is NOT mounted anywhere in the app right now.

**Fix:**
- Mount `<AgentChatFloat />` globally inside `AppLayout` (so it's available on every page like before).
- Add internal open/close state to `AgentChatFloat` controlled via a tiny event bus (`window.dispatchEvent(new CustomEvent('jarvis:open'))`) so the bottom nav can trigger it without prop drilling.
- Change `BottomNavBar.handleJarvis` to dispatch that event instead of navigating to `/chat`. No more redirect to POTUS.
- Keep `/chat` route untouched (POTUS still accessible from menu if needed).

### Issue 2: TopBar visible on iPad/tablet + content not full width

Current breakpoints in `AppLayout`:
- `TopBar`: `hidden md:block` → shows from 768px (iPad shows it ❌)
- Sidebar padding: `lg:pl-72` → only from 1024px (iPad has no sidebar ✓)
- `BottomNavBar`: `lg:hidden` → shows on iPad ✓

So on iPad we get **both** the TopBar AND the bottom nav, which is wrong. The TopBar should only appear when the desktop sidebar appears (≥ lg).

**Fix:**
- Change TopBar wrapper from `hidden md:block` → `hidden lg:block` in `AppLayout.tsx`. Now mobile + tablet both get the clean full-width layout with only the bottom nav, matching the mobile experience exactly.
- `MobileMenu` page (`/menu`) already uses full width — no change needed there, just verify it stretches now that TopBar is gone on iPad.

### Files to edit

1. `src/components/layout/AppLayout.tsx` — change `hidden md:block` → `hidden lg:block` on the TopBar wrapper, and mount `<AgentChatFloat />` (excluded on login/wizard).
2. `src/components/layout/BottomNavBar.tsx` — `handleJarvis` dispatches `window.dispatchEvent(new CustomEvent('jarvis:toggle'))` instead of `navigate('/chat')`.
3. `src/components/agent/AgentChatFloat.tsx` — add a `useEffect` listener for `'jarvis:toggle'` that toggles the panel open.

### Out of scope
- Don't touch POTUS routes/components.
- Don't change desktop (lg+) behaviour — sidebar + TopBar remain unchanged.

