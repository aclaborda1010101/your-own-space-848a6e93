

User wants 3 things:
1. JARVIS button on bottom nav (mobile/iPad) → open as full PAGE, not floating popup. Hide floating FAB on those breakpoints.
2. `/menu` page → use full width on iPad (currently constrained).
3. Tasks page → pending tasks should be full-width ABOVE completed tasks (currently side-by-side and hard to read).

Let me check the relevant files.

I already know:
- `BottomNavBar.tsx` dispatches `jarvis:toggle` event → opens `AgentChatFloat` popup
- `AgentChatFloat` is mounted globally in `AppLayout`
- `AgentChatFloat` renders a fixed-position floating panel + FAB

Need to check:
- Tasks page layout (uses two columns?)
- MobileMenu page width constraint
- Existing JARVIS full-page route candidate

Quick reads needed before finalizing.

Plan:

## Plan

### 1. JARVIS as full page on mobile/iPad

- Create new route `/jarvis` rendering a full-page version of the JARVIS chat (reuse `AgentChatFloat` chat logic extracted into a `JarvisChatView` component, or render `AgentChatFloat` inline as a page).
- Simpler: create `src/pages/JarvisPage.tsx` that mounts an always-open, non-floating version of the JARVIS chat (same streaming + history logic from `AgentChatFloat`), wrapped in `AppLayout` with full-width container.
- Register `/jarvis` in `App.tsx`.
- `BottomNavBar` JARVIS button → `navigate('/jarvis')` instead of dispatching `jarvis:toggle`.
- In `AppLayout`, only mount floating `<AgentChatFloat />` on `lg+` (desktop). On mobile/iPad it's hidden — JARVIS lives at `/jarvis`.

### 2. `/menu` full width on iPad

- `MobileMenu` page currently constrained (likely `max-w-md` or similar). Remove width cap on tablet so it stretches to full width while keeping comfortable max width on very wide screens (e.g. `max-w-3xl mx-auto` → full width with sensible padding).

### 3. Tasks page: pending full-width above completed

- `Tasks.tsx` currently renders pending and completed side by side (grid). Change to single column: pending list full-width on top, completed list full-width below.
- Keep mobile behaviour intact (already stacked); fix tablet/desktop where columns appear.

### Files to edit

1. `src/pages/JarvisPage.tsx` (new) — full-page JARVIS chat view.
2. `src/components/agent/AgentChatFloat.tsx` — extract chat body into reusable `JarvisChatBody` (or accept `mode="page"` prop), keep FAB for desktop only.
3. `src/components/layout/BottomNavBar.tsx` — JARVIS button navigates to `/jarvis`.
4. `src/components/layout/AppLayout.tsx` — render `AgentChatFloat` only on `lg+` screens (`hidden lg:block` wrapper).
5. `src/App.tsx` — register `/jarvis` route.
6. `src/pages/MobileMenu.tsx` — remove width cap, use full width with padding.
7. `src/pages/Tasks.tsx` — switch pending/completed grid to single column stack.

### Out of scope
- Don't change desktop floating JARVIS behaviour.
- Don't touch POTUS routes or any other page layout.
- Don't change task data/logic — pure layout fix.

