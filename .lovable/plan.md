
# Voice-Enabled Coaching Sessions

## What changes
The "Session" tab in the Life Coach page will get a voice mode, allowing you to have real-time spoken conversations with the AI coach -- press a button to talk, the AI listens, thinks, and responds with voice (like a real coaching session).

## How it works

1. **New microphone button** next to the text input in the Session tab -- tap to record your voice message
2. **Voice Mode toggle** -- when enabled, the coach automatically speaks its responses aloud using the JARVIS voice (ElevenLabs TTS)
3. **Visual feedback** -- an animated indicator shows the current state: listening (pulsing green), processing (spinning), speaking (waving), idle

The existing pipeline is reused:
- Groq Whisper (STT) transcribes your voice
- `jarvis-coach` edge function processes the message
- ElevenLabs (TTS) speaks the response back

## Technical Details

### Files modified

**`src/pages/CoachLife.tsx`**
- Import `useVoiceRecognition` and `useJarvisTTS` hooks
- Add a "Voice Mode" toggle (Switch component) in the Session tab header
- Add a microphone button (Mic icon) next to the Send button
- When mic is pressed: record audio, transcribe via STT, send transcription as chat message, if Voice Mode is on then speak the response via TTS
- Show visual state indicators (recording pulse, processing spinner, speaking wave)
- Voice messages appear in chat with a small Mic icon badge

### No new files or edge functions needed
All infrastructure (`useVoiceRecognition`, `useJarvisTTS`, `speech-to-text`, `text-to-speech` edge functions) already exists and is deployed.

### UI additions
- Mic button with recording animation (red pulsing ring when active)
- "Voice Mode" switch with speaker icon in the card header
- State badge showing "Escuchando...", "Procesando...", "Hablando..." during voice flow
