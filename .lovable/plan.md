

# Evolution API Webhook + Response Drafts System

## Overview

Three interconnected systems: (1) Real-time WhatsApp ingestion via Evolution API, (2) AI-powered response draft generation, (3) Frontend UI for suggested responses in the contact detail panel.

---

## Part 1: SQL Migration

### New table: `suggested_responses`

```text
suggested_responses
  id                  UUID PK DEFAULT gen_random_uuid()
  user_id             UUID NOT NULL (FK auth.users -- for RLS)
  contact_id          UUID FK people_contacts(id) ON DELETE CASCADE
  original_message_id UUID FK contact_messages(id) ON DELETE SET NULL
  suggestion_1        TEXT   -- Strategic/Business
  suggestion_2        TEXT   -- Relational/Empathetic  
  suggestion_3        TEXT   -- Executive/Concise
  context_summary     TEXT   -- Brief context used for generation
  status              TEXT DEFAULT 'pending' (pending/accepted/rejected)
  created_at          TIMESTAMPTZ DEFAULT now()
```

RLS: Enable with policy `user_id = auth.uid()` for SELECT/UPDATE/DELETE.

No additional schema changes needed -- `contact_messages` and `people_contacts` already have the required columns (`wa_id`, `phone_numbers`, `direction`, `content`, `message_date`, `source`).

---

## Part 2: Edge Function `evolution-webhook`

**File:** `supabase/functions/evolution-webhook/index.ts`

**Config:** `verify_jwt = false` (external webhook)

### Flow:

1. **Receive POST** from Evolution API
2. **Extract** message data from `data.message`, `data.key`, `data.messageTimestamp`, `data.pushName`
3. **Validate:**
   - Skip if `key.remoteJid` contains `@g.us` (group messages)
   - Skip if no text content (`message.conversation` or `message.extendedTextMessage.text`)
4. **Identify contact:**
   - Extract `waId` from `key.remoteJid.split('@')[0]`
   - Query `people_contacts` WHERE `wa_id = waId` OR `waId = ANY(phone_numbers)`
   - If not found: INSERT new contact with `name = pushName`, `category = 'pendiente'`, `wa_id = waId`
   - Requires resolving `user_id` -- use a configurable secret `EVOLUTION_USER_ID` (single-user system) or look up via `platform_users`
5. **Persist message** in `contact_messages`:
   - `contact_id`, `user_id`, `source: 'whatsapp'`, `sender: pushName or 'Yo'`
   - `direction: key.fromMe ? 'outgoing' : 'incoming'`
   - `message_date: new Date(messageTimestamp * 1000)`
   - `content: textContent`
6. **Trigger intelligence** (conditional):
   - If incoming + content length > 20 chars, OR 5th message today from this contact
   - Fire `contact-analysis` asynchronously (fetch, don't await)
7. **Trigger response drafts** (conditional):
   - If incoming message, invoke `generate-response-draft` asynchronously
8. **Return** 200 OK always (webhook must never fail)

---

## Part 3: Edge Function `generate-response-draft`

**File:** `supabase/functions/generate-response-draft/index.ts`

**Config:** `verify_jwt = false` (called internally)

### Flow:

1. **Receive** `{ contact_id, user_id, message_id, message_content }`
2. **Gather context:**
   - Last 10 messages from `contact_messages` WHERE `contact_id` = X
   - `personality_profile` from `people_contacts`
   - Contact name, category, role
3. **Build prompt** for Gemini Pro:
   - System: "You are the personal assistant of a high-level consultant. Based on the psychological profile and message history, draft 3 response options in Spanish."
   - Option A (Strategic): Move the pipeline forward, close milestones
   - Option B (Relational): Focus on wellbeing, use profile pretexts (ask about health, family)
   - Option C (Executive): Short, direct response to buy time
   - Response format: JSON `{ suggestion_1, suggestion_2, suggestion_3 }`
4. **Insert** into `suggested_responses` table
5. **Return** the suggestions (Supabase Realtime will broadcast the INSERT automatically)

---

## Part 4: Frontend - Suggested Responses UI

**File:** New component `src/components/contacts/SuggestedResponses.tsx`

### Behavior:

- Subscribe to `suggested_responses` via Supabase Realtime (INSERT events for current contact)
- Display up to 3 response bubbles when `status = 'pending'`
- Each bubble shows:
  - Icon: Briefcase for suggestion_1 (strategic), Heart for suggestion_2 (empathetic), Zap for suggestion_3 (executive)
  - The text content
- On click: copy text to clipboard + toast confirmation
- On click "Use": update status to 'accepted'

**Integration point:** Render inside `ContactDetail` component in `StrategicNetwork.tsx`, below the existing tabs section, visible when a contact is selected.

---

## Part 5: Config Updates

**`supabase/config.toml`:** Add entries for both new functions:
```text
[functions.evolution-webhook]
verify_jwt = false

[functions.generate-response-draft]
verify_jwt = false
```

---

## User ID Resolution Strategy

Since this is a single-user system (the consultant), the `evolution-webhook` will:
1. First try to resolve via `platform_users` (WhatsApp platform binding)
2. If no platform user found, fall back to a hardcoded lookup: query the first user from `user_integrations` or use a secret `EVOLUTION_DEFAULT_USER_ID`

This avoids requiring authentication on an external webhook while still correctly attributing contacts to the right user.

---

## Execution Order

1. SQL migration: create `suggested_responses` table + RLS
2. Edge function: `evolution-webhook`
3. Edge function: `generate-response-draft`
4. Update `supabase/config.toml`
5. Frontend: `SuggestedResponses` component
6. Frontend: integrate into `StrategicNetwork.tsx` contact detail

---

## Files Affected

| File | Action |
|------|--------|
| New SQL migration | CREATE TABLE suggested_responses + RLS |
| `supabase/functions/evolution-webhook/index.ts` | NEW |
| `supabase/functions/generate-response-draft/index.ts` | NEW |
| `supabase/config.toml` | Add 2 function entries |
| `src/components/contacts/SuggestedResponses.tsx` | NEW |
| `src/pages/StrategicNetwork.tsx` | Import + render SuggestedResponses |
| `src/integrations/supabase/types.ts` | Auto-updated by migration |

