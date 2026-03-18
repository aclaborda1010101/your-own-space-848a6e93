
# Plan: Fix draft generation quality + WhatsApp send error

## Problems identified

1. **Draft generation too concise**: The avg message length is 49 chars, which triggers the "corta (1-2 líneas)" bucket. The prompt then forces the AI to produce very short responses. Additionally, the `suggestion_3 (Ejecutiva)` explicitly says "Máximo 1-2 líneas", and the few-shot examples (short WhatsApp messages like "jajaja", "ok", "vale") are biasing the model toward ultra-short responses. The conversation history (25 messages) may not provide enough context.

2. **Context confusion**: Only 25 recent messages are fetched. For contacts with high message volume, this may not capture the full conversational thread. The AI is confusing who said what and what the conversation is about.

3. **Send error (blank screen)**: When `supabase.functions.invoke` returns a non-2xx response, the Supabase JS client puts the error body in `error.context` (a Response object). The current error handling calls `context.text()` but this may fail if the body was already consumed, or the error structure doesn't match. Additionally, if `error` is a `FunctionsHttpError`, the `data` will be `null` and the error details are in the error object. The `has_blank_screen: true` in the error report suggests an unhandled exception is crashing the UI.

## Changes

### 1. Improve `generate-response-draft` prompt and data gathering

**File**: `supabase/functions/generate-response-draft/index.ts`

- Increase recent messages from 25 to **50** for better conversation context
- Filter few-shot examples to exclude very short messages (<15 chars) like "ok", "jajaja", "vale" that skew the avg length down
- Compute avg length only from messages >15 chars to get a more representative "real message" length
- Increase minimum length for few-shot examples from 5 to 15 chars
- Remove the "Máximo 1-2 líneas" constraint from suggestion_3 - instead say "Respuesta concisa"
- Add explicit instruction: "Cada sugerencia debe tener al MENOS 2-3 frases que aporten valor y contexto. NUNCA respondas con menos de 20 palabras por sugerencia."
- Add more conversation context in the user prompt: include the last 3-5 incoming messages, not just the last one

### 2. Fix WhatsApp send error handling to prevent blank screens

**File**: `src/lib/edge-function-error.ts`

- Handle `FunctionsHttpError` properly by checking for `context` as a `Response` object and cloning before reading
- Add try/catch around the entire error parsing to always return a safe fallback

**Files**: `src/components/contacts/SuggestedResponses.tsx`, `src/components/contacts/ContactTabs.tsx`, `src/pages/StrategicNetwork.tsx`

- Before calling `send-whatsapp`, check if `data` returned contains the error (Supabase functions.invoke returns `{ data, error }` where `error` is set for network issues but `data` contains the body even for 4xx responses in some SDK versions)
- Wrap entire send flow in safer error handling
- Add pre-send validation: check if contact has `wa_id` or `phone_numbers` before attempting to send, show immediate toast instead of calling the edge function

### 3. Add phone number editing capability

**File**: `src/pages/StrategicNetwork.tsx`

- Add a small "add phone" button/input in the contact detail view when `wa_id` is null and `phone_numbers` is empty
- When saved, update `people_contacts.wa_id` directly so `send-whatsapp` can find the recipient

## Technical details

**Draft quality fix** - The core issue is that short "filler" messages (ok, jajaja, vale, sí, etc.) are included in the avg length calculation and few-shot examples, making the AI think the user writes 10-word messages. Filtering these out will give a realistic avg length of ~100-150 chars, triggering "media (2-3 líneas)" bucket instead.

**Error handling fix** - The `supabase.functions.invoke()` SDK returns `{ data: null, error: FunctionsHttpError }` for non-2xx responses. The error body is in `error.context` which is a Response. We need to properly read it with `.json()` not `.text()`, and handle already-consumed response bodies.

**Phone editing** - Simple inline edit that updates `wa_id` field on `people_contacts`, enabling the send-whatsapp function to find the recipient.
