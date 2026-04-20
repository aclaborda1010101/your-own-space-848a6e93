

The user wants:
1. Mobile/iPad JARVIS button (BottomNavBar + QuickActions) currently routes to `/chat` which renders `PotusChatMvp`. Wrong — should go to JARVIS chat.
2. Web (desktop): JARVIS must be a **floating** widget (like the old `AgentChatFloat` / `JarvisFloatingPanel`).
3. Mobile/iPad: floating widget hidden, instead a **dedicated full page** with the same JARVIS chat (same component reused).
4. Remove POTUS chat pages (`/chat` currently = Potus, `/potus-chat`) — obsolete.
5. Remove "Comunicaciones" from the menu permanently.
6. Inside JARVIS chat: add a mic button → Whisper STT (already have `speech-to-text` edge function + `useVoiceRecognition`).
7. Optional: real-time voice via OpenAI Realtime (already have `useJarvisRealtime` + `jarvis-voice` edge function) — integrated inside the chat.

Let me check current wiring quickly to be precise.

Findings:
- `BottomNavBar.tsx` → `handleJarvis` navigates to `/chat`.
- `QuickActions.tsx` → "JARVIS" button navigates to `/chat`.
- `/chat` route renders `Chat.tsx` → `PotusChatMvp` (wrong).
- `PotusFloatingChat` is the floating widget but uses `PotusCompactChat` (Potus, not Jarvis).
- Existing JARVIS floating widget candidates: `AgentChatFloat` (streams `jarvis-agent`, has history `agent_chat_messages`) and `JarvisFloatingPanel` (voice + chat with `useJarvisCoach`/`useJarvisVoice`).
- Existing JARVIS hooks: `useJarvisRealtimeVoice`, `useJarvisRealtime`, `useVoiceRecognition` (Whisper via Groq), `speech-to-text` and `jarvis-stt` (OpenAI Whisper) edge functions.
- `MenuVisibilityCard` lists "POTUS" → /chat and "Comunicaciones" → /communications.
- `MobileMenu.tsx` likely also lists them.
- `App.tsx` has routes for `/chat`, `/potus-chat`, `/communications`, plus `ChatSimple`.

## Plan

### 1. New unified JARVIS chat component
Create `src/components/jarvis/JarvisChat.tsx` — a single self-contained chat UI that works in two layout modes:
- `variant="floating"` → used by desktop floating widget
- `variant="page"` → fills viewport, used on mobile/iPad full page

Features inside:
- Text input + send
- Mic button → uses `useVoiceRecognition` (Whisper) to transcribe, fills input or auto-sends
- Toggle "Modo voz en tiempo real" → uses `useJarvisRealtime` (OpenAI Realtime) for live conversation
- Markdown rendering of responses
- Streams from `jarvis-agent` edge function (reuse current pattern from `AgentChatFloat`)
- Persists in `agent_chat_messages` (existing table)

### 2. New floating wrapper for desktop only
`src/components/jarvis/JarvisFloatingChat.tsx`:
- Renders FAB + popup (similar shape to `PotusFloatingChat`)
- **Hidden on mobile/iPad** via `lg:` classes (`hidden lg:block`) or `useIsMobile`
- Inside popup → `<JarvisChat variant="floating" />`
- Replaces `PotusFloatingChat` mount in `AppLayout`

### 3. New full page for mobile/iPad (and accessible from desktop too)
`src/pages/JarvisChat.tsx` → renders `<JarvisChat variant="page" />` filling `h-[calc(100vh-4rem)]`.

### 4. Routing changes (`src/App.tsx`)
- `/chat` → now renders `JarvisChat` page (was Potus)
- Remove `/potus-chat` route (or redirect to `/chat`)
- Remove `/communications` route (redirect to `/dashboard` or just delete)
- Keep `/chat-simple` only if user wants — otherwise leave

### 5. Navigation fixes
- `BottomNavBar.handleJarvis` → keep `/chat` (now correct)
- `QuickActions` JARVIS button → keep `/chat`
- Remove "Comunicaciones" from `MenuVisibilityCard`
- Remove "Comunicaciones" and "POTUS" entries from `MobileMenu.tsx` sections (replace POTUS label with "JARVIS" → /chat)

### 6. Cleanup (delete obsolete files)
- `src/pages/PotusChat.tsx`
- `src/pages/Communications.tsx`
- `src/components/potus/PotusFloatingChat.tsx` mount removed from layout (component file can stay if used elsewhere — will check; if not, delete)
- `src/pages/Chat.tsx` repurposed → renders new JarvisChat page
- Old `Chat.tsx` Potus reference removed

### 7. AppLayout
Replace `<PotusFloatingChat />` with `<JarvisFloatingChat />` (which auto-hides on mobile).

### Files to touch
**Create:**
- `src/components/jarvis/JarvisChat.tsx`
- `src/components/jarvis/JarvisFloatingChat.tsx`
- `src/pages/JarvisChat.tsx` (or repurpose `Chat.tsx`)

**Edit:**
- `src/App.tsx` (routes)
- `src/components/layout/AppLayout.tsx` (swap floating widget)
- `src/components/settings/MenuVisibilityCard.tsx` (remove Comunicaciones, rename POTUS→JARVIS)
- `src/pages/MobileMenu.tsx` (remove Comunicaciones, rename POTUS→JARVIS)

**Delete:**
- `src/pages/PotusChat.tsx`
- `src/pages/Communications.tsx`
- `src/components/potus/PotusFloatingChat.tsx` (only if not referenced elsewhere)

### Voice details
- **Mic button (Whisper)**: record with MediaRecorder → POST to `/functions/v1/speech-to-text` → returned text inserted into input + auto-send. Reuse `useVoiceRecognition` hook.
- **Real-time voice**: toggle button "🎙️ En vivo" inside chat → calls `useJarvisRealtime.startSession()` → WebRTC session with OpenAI Realtime via `jarvis-voice` function. Live transcript appears as user message; assistant response appears as assistant message. Stop button ends session.

### Result
- Desktop web: JARVIS floats as before, accessible everywhere.
- Mobile/iPad: tapping JARVIS in bottom bar opens `/chat` full-page with same component.
- POTUS chat completely removed from UI.
- "Comunicaciones" removed from menu.
- Mic + real-time voice integrated inside the JARVIS chat itself.

