

# Plan: Auto-resolve phone numbers from Evolution API contacts

## Problem
"Mi Nena" has 300+ WhatsApp messages imported from a backup, but no `wa_id` or `phone_numbers` because backup imports don't capture phone numbers. The user expects the system to use the phone number that Evolution API / their phone already knows for this contact name.

## Root Cause
WhatsApp backup imports only capture contact names, not phone numbers. The evolution webhook only sets `wa_id` when it receives a **live** message. There's no mechanism to backfill phone numbers for contacts imported from backups.

## Solution

### 1. Enhance `send-whatsapp` to query Evolution API for the contact's phone

**File**: `supabase/functions/send-whatsapp/index.ts`

Before returning the "no phone number" error, add a new fallback step:
- Query the Evolution API's contacts endpoint (`GET /chat/findContacts/{instance}`) searching by the contact's name
- If a match is found, use that phone number AND update `people_contacts.wa_id` so future sends don't need this lookup
- This leverages the phone numbers already synced to the Evolution API instance

### 2. Enhance `evolution-webhook` to match incoming messages to backup contacts

**File**: `supabase/functions/evolution-webhook/index.ts`

When the webhook finds a contact by name (the existing name-matching logic), also update `phone_numbers` array even when it's `[]` (currently it only updates when `phone_numbers IS NULL`, but backup imports set it to `[]`).

Change the update condition from `.is("phone_numbers", null)` to also handle empty arrays:
```sql
-- Current: only updates when phone_numbers IS NULL
.is("phone_numbers", null)

-- New: also update when phone_numbers is empty array
-- Use a raw filter or two separate update attempts
```

### 3. Fix the frontend pre-send validation

**Files**: `src/pages/StrategicNetwork.tsx`, `src/components/contacts/ContactTabs.tsx`

Remove the frontend pre-send block that prevents calling the edge function when `wa_id` and `phone_numbers` are empty. Instead, let the edge function handle resolution (since it now has the Evolution API fallback). Show the error only if the edge function itself returns an error.

This way, the system will:
1. Try `wa_id` / `phone_numbers` from DB (fast path)
2. Try Evolution API contact lookup by name (new fallback)
3. Try `platform_users` lookup (existing fallback)
4. Only then return the "no phone" error

### Technical Details

Evolution API contact search endpoint:
```
GET {EVOLUTION_API_URL}/chat/findContacts/{INSTANCE_NAME}
Header: apikey: {EVOLUTION_API_KEY}
Body: { where: { id: phoneNumber } }
```

Alternative approach - use the `fetchProfilePictureUrl` or contacts list to search by name. The exact API depends on Evolution API version, but the contacts are synced to the instance.

If the Evolution API doesn't support name-based search reliably, the simpler approach is:
- Remove frontend blocking
- In `send-whatsapp`, when no phone found, query `contact_messages` for any message with a `source = 'whatsapp'` (not `whatsapp_backup`) that has metadata with a phone number
- Or simply let the user use the inline phone editor (already implemented) but make it more prominent

### Simplest reliable fix (recommended)

Since Evolution API contact search by name is unreliable, the most practical fix is:

1. **In `evolution-webhook`**: Fix the `phone_numbers` update to also handle empty arrays `[]`, not just `NULL`. This ensures that when "Mi Nena" sends a live message, her `wa_id` gets saved properly.

2. **Remove frontend send blocking**: Let `send-whatsapp` handle the resolution. The edge function's error message is already user-friendly.

3. **Make the inline phone editor more visible**: Show it in the WhatsApp tab (ContactTabs), not just StrategicNetwork.

